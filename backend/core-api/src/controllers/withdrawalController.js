import * as ethers from 'ethers';
import {
  attachTxHashAndStatus,
  createWithdrawalRecord,
  findWithdrawalByUserAmount,
} from '../utils/withdrawalStore.js';
import { debitWithdrawal, refundWithdrawal } from '../utils/balanceStore.js';
import { recordTxOutcome } from '../services/txMetricsStore.js';
import { executeWithdrawalOnChain } from '../services/withdrawalChainService.js';
import { enqueueWithdrawJob, isTxQueueEnabled } from '../queues/txQueue.js';
import { createCircuitBreaker } from '../infra/circuitBreaker.js';
import { emitTxUpdate } from '../socket/socketHub.js';

function badRequest(res, reason, meta) {
  return res.status(400).json({ success: false, reason, ...(meta || {}) });
}

const ACTIVE_DUP_STATUSES = new Set(['PENDING', 'BROADCASTED', 'CONFIRMED', 'QUEUED']);
const ALLOWED_QUEUE_STRATEGY = new Set(['normal', 'balanced', 'safe']);
const ALLOWED_RETRY_POLICY = new Set(['standard', 'conservative']);

function sanitizeAdaptationFields(body) {
  const q = String(body?.queuePriorityStrategy || 'normal').toLowerCase();
  const r = String(body?.retryPolicy || 'standard').toLowerCase();
  return {
    queuePriorityStrategy: ALLOWED_QUEUE_STRATEGY.has(q) ? q : 'normal',
    retryPolicy: ALLOWED_RETRY_POLICY.has(r) ? r : 'standard',
  };
}

// In-memory lock to prevent concurrent withdrawals per user.
const processingWithdrawals = new Set();

export function createWithdrawalController({ logger, withdrawalService, signerService, authService, txQueue = null }) {
  const queueCircuit =
    txQueue && isTxQueueEnabled()
      ? createCircuitBreaker({ name: 'bullmq_withdraw', threshold: 8, coolDownMs: 20_000, logger })
      : null;

  return {
    /**
     * POST /api/request-withdraw
     * Body: { userAddress, amount, async?: boolean, queuePriorityStrategy?: 'normal'|'balanced'|'safe', retryPolicy?: 'standard'|'conservative', priority?: number }
     * Headers: X-Gpulse-Async: 1 — enqueue and return { status: 'processing', requestId } when Redis queue available.
     */
    async requestWithdraw(req, res) {
      const body = req?.body || {};
      const userAddressRaw = body?.userAddress;
      const amountRaw = body?.amount;

      const authHeader = String(req?.headers?.authorization || '');
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
      let session = authService?.getSession ? authService.getSession(token) : null;
      if (!session && req.session?.address) {
        session = { address: req.session.address };
      }

      logger.info('requestWithdraw request', {
        userAddress: userAddressRaw ? String(userAddressRaw) : null,
        amount: amountRaw,
        asyncRequested: Boolean(body?.async) || String(req.headers['x-gpulse-async'] || '').trim() === '1',
      });

      let userAddress;
      try {
        userAddress = ethers.getAddress(String(userAddressRaw || ''));
      } catch {
        return badRequest(res, 'INVALID_USER_ADDRESS');
      }

      if (!session) {
        return res.status(401).json({ success: false, reason: 'AUTH_REQUIRED' });
      }
      if (String(session.address) !== String(userAddress)) {
        return res.status(403).json({ success: false, reason: 'AUTH_ADDRESS_MISMATCH' });
      }

      if (processingWithdrawals.has(userAddress)) {
        logger.warn('Withdrawal already in progress', { userAddress });
        return res.status(409).json({ success: false, reason: 'Withdrawal already in progress' });
      }
      processingWithdrawals.add(userAddress);

      let amountWei;
      try {
        amountWei = ethers.parseEther(String(amountRaw));
        if (amountWei <= 0n) return badRequest(res, 'INVALID_AMOUNT');
      } catch {
        return badRequest(res, 'INVALID_AMOUNT');
      }

      let record = null;
      let metricsActive = false;

      const wantsAsync =
        Boolean(body?.async) ||
        String(req.headers['x-gpulse-async'] || '').trim() === '1' ||
        String(process.env.GPULSE_DEFAULT_ASYNC_WITHDRAW || '').trim() === '1';

      let useAsync = Boolean(wantsAsync && txQueue && queueCircuit);
      if (wantsAsync && (!txQueue || !isTxQueueEnabled())) {
        logger.warn('async_withdraw_fallback_sync', { hasQueue: Boolean(txQueue) });
        useAsync = false;
      }

      try {
        const balanceWei = await withdrawalService.getBalanceWei(userAddress);
        if (amountWei > balanceWei) {
          return badRequest(res, 'INSUFFICIENT_BALANCE');
        }

        if (!signerService?.wallet || !signerService?.provider) {
          logger.error('Withdrawal signer not available');
          return res.status(503).json({ success: false, reason: 'SIGNER_NOT_AVAILABLE' });
        }

        const existing = await findWithdrawalByUserAmount(userAddress, amountWei);
        if (existing && ACTIVE_DUP_STATUSES.has(String(existing.status || '').toUpperCase())) {
          logger.warn('Duplicate withdrawal blocked (tracked)', {
            userAddress,
            amountWei: String(amountWei),
            status: existing.status,
          });
          return res.status(409).json({ success: false, reason: 'DUPLICATE_WITHDRAWAL' });
        }

        if (useAsync) {
          const adaptation = sanitizeAdaptationFields(body);
          record = await createWithdrawalRecord({
            userAddress,
            amountWei,
            status: 'QUEUED',
          });
          await debitWithdrawal({ address: userAddress, amountWei, withdrawalId: record.id });

          await queueCircuit.exec(() =>
            enqueueWithdrawJob(txQueue, {
              withdrawalId: record.id,
              userAddress,
              amountWei: String(amountWei),
              priority: body?.priority,
              queuePriorityStrategy: adaptation.queuePriorityStrategy,
              retryPolicy: adaptation.retryPolicy,
            }),
          );

          emitTxUpdate({
            withdrawalId: record.id,
            status: 'QUEUED',
            userAddress,
            amountWei: String(amountWei),
          });

          logger.info('requestWithdraw enqueued', { userAddress, withdrawalId: record.id });
          return res.json({
            success: true,
            status: 'processing',
            requestId: record.id,
          });
        }

        record = await createWithdrawalRecord({
          userAddress,
          amountWei,
          status: 'PENDING',
        });
        metricsActive = true;
        await debitWithdrawal({ address: userAddress, amountWei, withdrawalId: record.id });

        const { txHash } = await executeWithdrawalOnChain({
          recordId: record.id,
          userAddress,
          amountWei,
          signerService,
          logger,
        });

        logger.info('requestWithdraw confirmed', { userAddress, txHash, amountWei: String(amountWei) });
        return res.json({ success: true, txHash });
      } catch (e) {
        if (metricsActive) recordTxOutcome({ success: false });
        logger.error('requestWithdraw error', { userAddress, message: e?.message });
        if (String(e?.message) === 'DAILY_WITHDRAW_LIMIT_EXCEEDED') {
          return badRequest(res, 'DAILY_WITHDRAW_LIMIT_EXCEEDED');
        }
        if (String(e?.message)?.startsWith('Invalid network')) {
          return badRequest(res, 'INVALID_NETWORK');
        }
        if (String(e?.message) === 'CIRCUIT_OPEN_bullmq_withdraw') {
          return res.status(503).json({ success: false, reason: 'QUEUE_OVERLOADED' });
        }
        try {
          if (record?.id) {
            await attachTxHashAndStatus(record.id, '', 'FAILED');
            await refundWithdrawal({ address: userAddress, withdrawalId: record.id });
          }
        } catch (err) {}
        return res.status(500).json({ success: false, reason: 'WITHDRAW_FAILED' });
      } finally {
        processingWithdrawals.delete(userAddress);
      }
    },
  };
}
