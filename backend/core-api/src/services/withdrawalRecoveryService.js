import { listWithdrawals, attachTxHashAndStatus } from '../utils/withdrawalStore.js';
import { refundWithdrawal } from '../utils/balanceStore.js';

/**
 * Crash recovery for withdrawals.
 *
 * Rules:
 * - Never delete records; only update status.
 * - Refund is idempotent by withdrawalId.
 * - If a tx was broadcast and receipt is unknown, we keep it BROADCASTED
 *   to avoid double-paying (refund + later confirm).
 */
export async function recoverPendingWithdrawals({ logger, signerService }) {
  const provider = signerService?.provider || null;
  const rows = await listWithdrawals();
  const candidates = rows.filter(
    (r) => r && (r.status === 'PENDING' || r.status === 'BROADCASTED' || r.status === 'QUEUED'),
  );

  if (candidates.length === 0) {
    logger.info('withdrawal recovery: no pending withdrawals');
    return;
  }

  logger.warn('withdrawal recovery: scanning', { count: candidates.length });

  for (const r of candidates) {
    const id = String(r.id || '');
    const userAddress = String(r.userAddress || '');
    const txHash = r.txHash ? String(r.txHash) : '';
    const status = String(r.status || '');

    try {
      if (!id || !userAddress) continue;

      if (status === 'QUEUED' && !txHash) {
        const ageMs = Date.now() - Number(r.createdAt || r.at || 0);
        const staleMs = Number(process.env.WITHDRAW_QUEUE_STALE_MS || 3_600_000);
        if (ageMs < staleMs) {
          logger.info('withdrawal recovery: skipping fresh QUEUED (async pipeline)', { id, ageMs });
          continue;
        }
        await refundWithdrawal({ address: userAddress, withdrawalId: id });
        await attachTxHashAndStatus(id, '', 'FAILED');
        logger.warn('withdrawal recovery: stale QUEUED refunded', { id, userAddress });
        continue;
      }

      if (status === 'PENDING' && !txHash) {
        // Debit may have happened; tx was never broadcast. Refund and fail.
        await refundWithdrawal({ address: userAddress, withdrawalId: id });
        await attachTxHashAndStatus(id, '', 'FAILED');
        logger.warn('withdrawal recovery: refunded PENDING', { id, userAddress });
        continue;
      }

      if (status === 'BROADCASTED' && txHash) {
        if (!provider) {
          logger.warn('withdrawal recovery: cannot resolve BROADCASTED (no provider)', { id, txHash });
          continue;
        }
        const receipt = await provider.getTransactionReceipt(txHash);
        if (receipt && receipt.status === 1) {
          await attachTxHashAndStatus(id, txHash, 'CONFIRMED');
          logger.info('withdrawal recovery: confirmed', { id, txHash });
          continue;
        }
        if (receipt && receipt.status !== 1) {
          await refundWithdrawal({ address: userAddress, withdrawalId: id });
          await attachTxHashAndStatus(id, txHash, 'FAILED');
          logger.warn('withdrawal recovery: failed+refunded', { id, txHash });
          continue;
        }

        // No receipt yet: keep BROADCASTED (do not refund to avoid double pay).
        logger.warn('withdrawal recovery: still pending on-chain', { id, txHash });
        continue;
      }

      // Edge: PENDING with txHash or BROADCASTED without txHash → refund+fail.
      await refundWithdrawal({ address: userAddress, withdrawalId: id });
      await attachTxHashAndStatus(id, txHash, 'FAILED');
      logger.warn('withdrawal recovery: repaired inconsistent record', { id, status, txHash });
    } catch (e) {
      logger.error('withdrawal recovery error', { id, txHash, message: e?.message });
    }
  }
}

