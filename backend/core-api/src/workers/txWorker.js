import dotenv from 'dotenv';
import { Worker } from 'bullmq';

dotenv.config();

import { getBullRedisConnection } from '../infra/redisClient.js';
import { createLogger } from '../utils/logger.js';
import { createSignerService } from '../services/signerService.js';
import { TX_QUEUE_NAME, WITHDRAW_JOB_NAME } from '../queues/txQueue.js';
import { processWithdrawJob } from '../queues/withdrawJobProcessor.js';

const logger = createLogger();

let signerService;
try {
  signerService = createSignerService({ logger });
} catch (e) {
  logger.error('tx_worker_signer_init_failed', { message: e?.message });
  process.exit(1);
}

const connection = getBullRedisConnection();
if (!connection) {
  logger.error('tx_worker_missing_redis', { hint: 'Set REDIS_URL' });
  process.exit(1);
}

const concurrency = Math.max(1, Number(process.env.TX_WORKER_CONCURRENCY || 2));

const worker = new Worker(
  TX_QUEUE_NAME,
  async (job) => {
    await processWithdrawJob(job, { signerService, logger });
  },
  { connection, concurrency },
);

worker.on('completed', (job) => {
  if (job?.name === WITHDRAW_JOB_NAME) logger.info('tx_worker_job_completed', { id: job.id });
});

worker.on('failed', (job, err) => {
  logger.error('tx_worker_job_failed', { id: job?.id, message: err?.message });
});

logger.info('tx_worker_started', { concurrency, queue: TX_QUEUE_NAME });
