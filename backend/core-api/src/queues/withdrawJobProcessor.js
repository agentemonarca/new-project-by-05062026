import { recordTxOutcome } from '../services/txMetricsStore.js';
import { executeWithdrawalOnChain } from '../services/withdrawalChainService.js';
import { findWithdrawalById, attachTxHashAndStatus } from '../utils/withdrawalStore.js';
import { refundWithdrawal } from '../utils/balanceStore.js';
import { emitTxUpdate } from '../socket/socketHub.js';
import { WITHDRAW_JOB_NAME } from './txQueue.js';

/**
 * @param {import('bullmq').Job} job
 * @param {{ signerService: object, logger: object }} deps
 */
export async function processWithdrawJob(job, { signerService, logger }) {
  if (job.name !== WITHDRAW_JOB_NAME) return;
  const { withdrawalId, userAddress, amountWei } = job.data;
  const row = await findWithdrawalById(withdrawalId);
  if (!row) throw new Error('WITHDRAWAL_NOT_FOUND');

  const st = String(row.status || '').toUpperCase();
  if (st === 'CONFIRMED') {
    logger?.info?.('withdraw_job_skip_confirmed', { withdrawalId });
    return;
  }
  if (st === 'FAILED') {
    logger?.info?.('withdraw_job_skip_failed', { withdrawalId });
    return;
  }
  if (st !== 'QUEUED' && st !== 'PENDING') {
    logger?.warn?.('withdraw_job_skip_status', { withdrawalId, status: st });
    return;
  }

  try {
    await executeWithdrawalOnChain({
      recordId: withdrawalId,
      userAddress,
      amountWei: BigInt(String(amountWei)),
      signerService,
      logger,
    });
  } catch (e) {
    recordTxOutcome({ success: false });
    logger?.error?.('withdraw_job_chain_error', { withdrawalId, message: e?.message });
    try {
      await attachTxHashAndStatus(withdrawalId, '', 'FAILED');
      await refundWithdrawal({ address: userAddress, withdrawalId });
    } catch (err) {
      logger?.error?.('withdraw_job_refund_error', { withdrawalId, message: err?.message });
    }
    emitTxUpdate({
      withdrawalId,
      status: 'FAILED',
      userAddress,
      error: String(e?.message || 'WITHDRAW_FAILED'),
    });
    throw e;
  }
}
