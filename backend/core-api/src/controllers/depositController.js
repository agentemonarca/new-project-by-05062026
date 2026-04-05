import { getAddress, isHexString, parseEther } from 'ethers';
import {
  getTransaction,
  getTransactionFromHash,
  waitForConfirmations,
  sumErc20TransfersToRecipient,
} from '../services/blockchainService.js';
import { validateDeposit, validateErc20DepositAgainstMaster } from '../services/validationService.js';
import { loadProcessedTxs, saveProcessedTx } from '../utils/processedTxStore.js';
import { creditDeposit } from '../utils/balanceStore.js';
import {
  getDepositAssetConfig,
  parseErc20DepositAmountRaw,
  parseNativeDepositAmountWei,
} from '../utils/tokenAmount.js';

// Persistent anti-replay store (JSON file) with in-memory cache.
let processedTxsCache = null; // Set<string>
async function getProcessedTxsCache() {
  if (processedTxsCache) return processedTxsCache;
  const rows = await loadProcessedTxs();
  processedTxsCache = new Set(rows);
  return processedTxsCache;
}

// In-memory lock to prevent concurrent processing per txHash.
const processingTxs = new Set();

function badRequest(res, reason, meta) {
  return res.status(400).json({ success: false, reason, ...(meta || {}) });
}

export function createDepositController({
  logger,
  depositVerificationService,
  validationService,
  onDepositVerified,
} = {}) {
  return {
    /**
     * POST /api/verify-deposit
     * Body: { txHash, amount, userAddress, referrerAddress?, binarySide? }
     * Native: amount is ETH-style decimal string (parseEther). ERC-20: human amount with DEPOSIT_TOKEN_DECIMALS (default 6 for USDT).
     */
    async verifyDeposit(req, res) {
      const body = req?.body || {};
      const txHash = String(body?.txHash || '').trim();
      const amountRaw = body?.amount;
      const userAddressRaw = body?.userAddress;

      logger.info('verifyDeposit request', {
        txHash,
        amount: amountRaw,
        userAddress: userAddressRaw ? String(userAddressRaw) : null,
      });

      if (!txHash || !isHexString(txHash, 32)) {
        return badRequest(res, 'INVALID_TX_HASH');
      }

      const assetCfg = getDepositAssetConfig();
      let expectedAmountWei;
      try {
        if (assetCfg.asset === 'erc20') {
          if (!assetCfg.tokenAddress) {
            return badRequest(res, 'DEPOSIT_TOKEN_ADDRESS_REQUIRED');
          }
          expectedAmountWei = parseErc20DepositAmountRaw(amountRaw, assetCfg.tokenDecimals);
          if (expectedAmountWei <= 0n) return badRequest(res, 'INVALID_AMOUNT');
        } else {
          expectedAmountWei = parseNativeDepositAmountWei(amountRaw);
          if (expectedAmountWei <= 0n) return badRequest(res, 'INVALID_AMOUNT');
        }
      } catch {
        return badRequest(res, 'INVALID_AMOUNT');
      }

      let userAddress = null;
      try {
        if (!userAddressRaw) return badRequest(res, 'USER_ADDRESS_REQUIRED');
        userAddress = getAddress(String(userAddressRaw));
      } catch {
        return badRequest(res, 'INVALID_USER_ADDRESS');
      }

      if (processingTxs.has(txHash)) {
        logger.warn('Transaction already being processed', { txHash, userAddress });
        throw new Error('Transaction already being processed');
      }
      processingTxs.add(txHash);

      try {
        const processedTxs = await getProcessedTxsCache();
        if (processedTxs.has(txHash)) {
          logger.warn('Duplicate transaction blocked', { txHash, userAddress });
          throw new Error('Duplicate transaction');
        }

        if (assetCfg.asset === 'native') {
          const tx = await getTransaction(txHash);

          const fromAddress = tx?.from ? String(tx.from).toLowerCase() : '';
          const userAddr = userAddress ? String(userAddress).toLowerCase() : '';
          if (!fromAddress || !userAddr || fromAddress !== userAddr) {
            throw new Error('Transaction sender does not match user');
          }

          validateDeposit(tx, expectedAmountWei, null);
          logger.info('verifyDeposit validation ok', { txHash, asset: 'native' });
        } else {
          const txQuick = await getTransactionFromHash(txHash);
          if (!txQuick?.from) throw new Error('Transaction not found');
          const masterRaw = String(process.env.MASTER_WALLET_ADDRESS || '').trim();
          if (!masterRaw) throw new Error('ENV_MISSING_MASTER_WALLET_ADDRESS');
          const master = getAddress(masterRaw);
          const { totalRaw } = await sumErc20TransfersToRecipient({
            txHash,
            tokenAddress: assetCfg.tokenAddress,
            recipientAddress: master,
          });
          validateErc20DepositAgainstMaster({
            userAddress: String(userAddress).toLowerCase(),
            txFrom: String(txQuick.from).toLowerCase(),
            totalRaw,
            expectedMinRaw: expectedAmountWei,
          });
          logger.info('verifyDeposit validation ok', { txHash, asset: 'erc20' });
        }

        const receipt = await waitForConfirmations(txHash, 2);
        if (!receipt) return badRequest(res, 'Transaction not found');
        if (receipt.status !== 1) return badRequest(res, 'TX_FAILED');

        await creditDeposit({ address: userAddress, amountWei: expectedAmountWei, txHash });

        await saveProcessedTx(txHash);
        processedTxs.add(txHash);
        logger.info('verifyDeposit success', { txHash, userAddress });

        let compensationSync = 'skipped';
        if (typeof onDepositVerified === 'function') {
          try {
            await onDepositVerified({
              userAddress,
              amountWei: expectedAmountWei,
              txHash,
              referrerAddress: body.referrerAddress,
              binarySide: body.binarySide,
            });
            compensationSync = 'ok';
          } catch (e) {
            compensationSync = 'failed';
            logger.error('compensation_post_deposit_failed', {
              txHash,
              message: String(e?.message || e),
            });
          }
        }

        return res.json({ success: true, compensationSync, depositAsset: assetCfg.asset });
      } catch (err) {
        const msg = String(err?.message || 'UNKNOWN_ERROR');
        logger.error('verifyDeposit error', { txHash, userAddress, message: msg, code: err?.code });

        if (msg === 'Duplicate transaction') {
          return res.status(409).json({ success: false, reason: msg });
        }
        if (msg === 'Transaction already being processed') {
          return res.status(409).json({ success: false, reason: msg });
        }

        if (msg === 'Transaction not found' || msg === 'Invalid destination' || msg === 'Insufficient amount') {
          return badRequest(res, msg);
        }
        if (msg === 'Transaction sender does not match user') {
          return badRequest(res, msg);
        }
        if (msg === 'TX_FAILED') return badRequest(res, 'TX_FAILED');
        if (msg === 'TX_NOT_FOUND') return badRequest(res, 'Transaction not found');
        if (msg === 'INVALID_DESTINATION') return badRequest(res, 'Invalid destination');
        if (msg === 'INVALID_AMOUNT') return badRequest(res, 'Insufficient amount');

        return res.status(500).json({ success: false, reason: 'INTERNAL_ERROR' });
      } finally {
        processingTxs.delete(txHash);
      }
    },

    /**
     * POST /api/deposit
     */
    async createDeposit(req, res) {
      if (!validationService || !depositVerificationService) {
        return res.status(501).json({ ok: false, error: 'deposit_legacy_not_configured' });
      }
      try {
        const input = validationService.validateDepositBody(req.body);
        const result = await depositVerificationService.verifyDeposit(input);
        return res.json({ ok: true, ...result });
      } catch (err) {
        logger.error('Deposit verification failed', {
          message: err?.message,
          code: err?.code,
        });
        return res.status(400).json({
          ok: false,
          error: err?.message || 'BAD_REQUEST',
        });
      }
    },
  };
}
