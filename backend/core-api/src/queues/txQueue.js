import { Queue } from 'bullmq';
import { getBullRedisConnection } from '../infra/redisClient.js';

export const TX_QUEUE_NAME = 'gpulse-tx';
export const WITHDRAW_JOB_NAME = 'withdraw';

export function isTxQueueEnabled() {
  return (
    String(process.env.REDIS_URL || '').trim() !== '' &&
    String(process.env.GPULSE_TX_QUEUE_DISABLED || '') !== '1'
  );
}

/**
 * @param {{ logger?: object }} opts
 * @returns {import('bullmq').Queue | null}
 */
export function createTxQueue({ logger } = {}) {
  const connection = getBullRedisConnection();
  if (!connection) return null;
  try {
    return new Queue(TX_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: 500,
        removeOnFail: 200,
      },
    });
  } catch (e) {
    logger?.error?.('tx_queue_create_failed', { message: e?.message });
    return null;
  }
}

/**
 * BullMQ: higher `priority` is processed first. Under load, "safe" / "balanced"
 * defer work slightly relative to "normal" without changing API contracts.
 *
 * @param {string} [strategy]
 * @param {number} [explicitPriority] legacy body.priority
 */
export function priorityForQueueStrategy(strategy, explicitPriority) {
  const p = Number(explicitPriority);
  if (Number.isFinite(p) && p > 0) {
    return Math.min(20, Math.max(1, Math.round(p)));
  }
  const s = String(strategy || 'normal').toLowerCase();
  if (s === 'safe') return 4;
  if (s === 'balanced') return 7;
  return 10;
}

/**
 * @param {string} [retryPolicy]
 * @returns {{ attempts: number, backoff: { type: string, delay: number } }}
 */
export function jobRetryOptionsForPolicy(retryPolicy) {
  const r = String(retryPolicy || 'standard').toLowerCase();
  if (r === 'conservative') {
    return { attempts: 6, backoff: { type: 'exponential', delay: 5000 } };
  }
  return { attempts: 4, backoff: { type: 'exponential', delay: 2500 } };
}

/**
 * @param {import('bullmq').Queue} queue
 * @param {{
 *   withdrawalId: string,
 *   userAddress: string,
 *   amountWei: string,
 *   priority?: number,
 *   queuePriorityStrategy?: string,
 *   retryPolicy?: string,
 * }} data
 */
/**
 * BullMQ queue metrics for observability (GET /system/queue-stats, socket).
 * Uses Queue#getWaitingCount, #getActiveCount, and #getJobCounts.
 *
 * @param {import('bullmq').Queue | null} queue
 * @returns {Promise<{ waiting: number, active: number, completed: number, failed: number }>}
 */
export async function getQueueStats(queue) {
  if (!queue) {
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }
  try {
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const counts = await queue.getJobCounts('completed', 'failed');
    return {
      waiting,
      active,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
    };
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }
}

export async function enqueueWithdrawJob(queue, data) {
  const payload = {
    withdrawalId: data.withdrawalId,
    userAddress: data.userAddress,
    amountWei: data.amountWei,
  };
  const priority = priorityForQueueStrategy(data.queuePriorityStrategy, data.priority);
  const { attempts, backoff } = jobRetryOptionsForPolicy(data.retryPolicy);
  await queue.add(WITHDRAW_JOB_NAME, payload, {
    jobId: data.withdrawalId,
    attempts,
    backoff,
    priority,
  });
}
