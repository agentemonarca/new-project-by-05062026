import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Worker } from 'bullmq';

import { createLogger } from './utils/logger.js';
import { connectMongoIfConfigured, getMongoHealthSummary } from '../dist/db/connect.js';
import { depositRoutes } from './routes/depositRoutes.js';
import { withdrawRoutes } from './routes/withdrawRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { genesisDashboardRoutes } from './routes/genesisDashboardRoutes.js';
import { createDepositController } from './controllers/depositController.js';
import { createDepositVerificationService } from './services/depositVerificationService.js';
import { createValidationService } from './services/validationService.js';
import { createWithdrawalController } from './controllers/withdrawalController.js';
import { createWithdrawalService } from './services/withdrawalService.js';
import { createSignerService } from './services/signerService.js';
import { createAuthService } from './services/authService.js';
import { createAuthController } from './controllers/authController.js';
import { recoverPendingWithdrawals } from './services/withdrawalRecoveryService.js';
import {
  createRateLimiter,
  getClientIp,
  keyByAuthAddressOrIp,
  keyByIpAndOptionalAuthAddress,
} from './middlewares/rateLimitMiddleware.js';
import { computeSystemHealth } from './services/systemHealthService.js';
import { createTtlCache } from './infra/ttlCache.js';
import { createTxQueue, getQueueStats, isTxQueueEnabled, TX_QUEUE_NAME } from './queues/txQueue.js';
import { processWithdrawJob } from './queues/withdrawJobProcessor.js';
import { getBullRedisConnection } from './infra/redisClient.js';
import { createSocketServer } from './socket/createSocketServer.js';
import { setSocketHub, emitSystemHealth, emitQueueStats } from './socket/socketHub.js';
import { computeWorkerScaleSignal } from './infra/workerScaleAdvisor.js';
import { initCompensationKernel, getCompensationKernel } from './services/compensationKernelSingleton.js';
import { createDepositCompensationBridge } from './services/depositCompensationBridge.js';
import session from 'express-session';
import { siweAuthRoutes } from './routes/siweAuthRoutes.js';
import { createApiSessionAuthMiddleware } from './middlewares/apiSessionAuthMiddleware.js';

dotenv.config();

const logger = createLogger();

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('unhandledRejection', { message: err.message, stack: err.stack });
});

process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { message: err?.message, stack: err?.stack });
  process.exit(1);
});

async function main() {
  await connectMongoIfConfigured(logger);

  const app = express();

  app.set('trust proxy', true);
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );

  const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret';
  /** HTTPS deployments: set SESSION_COOKIE_SECURE=1 so the session cookie is not sent over plain HTTP. */
  const sessionCookieSecure = process.env.SESSION_COOKIE_SECURE === '1';
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
      name: 'gpulse.sid',
      cookie: {
        httpOnly: true,
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        secure: Boolean(sessionCookieSecure),
      },
    }),
  );

  app.use('/auth', express.json({ limit: '512kb' }));
  app.use('/auth', siweAuthRoutes());

  app.use((req, res, next) => {
    const t0 = Date.now();
    res.on('finish', () => {
      logger.metric('http_latency', {
        method: req.method,
        path: req.originalUrl?.split('?')[0] || req.path,
        status: res.statusCode,
        ms: Date.now() - t0,
      });
    });
    next();
  });

  app.get('/health', (_req, res) => {
    const mongo = getMongoHealthSummary();
    const body = { ok: true };
    if (mongo.configured) {
      body.mongo = mongo.ready ? 'connected' : 'disconnected';
    }
    res.json(body);
  });

  const depositVerificationService = createDepositVerificationService({ logger });
  const validationService = createValidationService();
  const withdrawalService = createWithdrawalService();
  const authService = createAuthService({ logger });
  const authController = createAuthController({ logger, authService });
  let signerService = null;
  const { rateLimit } = createRateLimiter({ logger });

  try {
    signerService = createSignerService({ logger });
  } catch (e) {
    logger.warn('Backend signer not initialized', { reason: e?.message });
  }

  try {
    if (signerService?.provider?.getNetwork) {
      const network = await signerService.provider.getNetwork();
      logger.info('Blockchain connection established', {
        chainId: network?.chainId?.toString?.() ?? String(network?.chainId),
      });
    }
  } catch (e) {
    logger.warn('Blockchain connection not established', { reason: e?.message });
  }

  const compensationOn = String(process.env.COMPENSATION_ENABLED || '') === '1';
  if (compensationOn) {
    try {
      await initCompensationKernel({ signerService, logger });
      logger.info('compensation_kernel_initialized');
    } catch (e) {
      logger.error('compensation_kernel_failed', { message: e?.message });
    }
  }

  const onDepositVerified = compensationOn
    ? createDepositCompensationBridge({ getKernel: getCompensationKernel, logger })
    : null;

  const depositController = createDepositController({
    logger,
    depositVerificationService,
    validationService,
    onDepositVerified,
  });

  const healthCache = createTtlCache('system-health');

  app.get('/system/health', async (_req, res) => {
    try {
      const ttlMs = Number(process.env.HEALTH_CACHE_TTL_MS || 8000);
      const cached = await healthCache.get('v1');
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }
      const raw = await computeSystemHealth({ signerService });
      const body = {
        network: raw.network,
        signer: raw.signer,
        mempool: raw.mempool,
        backend: raw.backend,
        riskLevel: raw.riskLevel,
      };
      await healthCache.set('v1', body, ttlMs);
      res.setHeader('X-Cache', 'MISS');
      res.json(body);
    } catch (e) {
      logger.warn('system/health failed', { message: e?.message });
      res.status(503).json({
        network: 'offline',
        signer: 'error',
        mempool: 'congested',
        backend: 'lagging',
        riskLevel: 'high',
      });
    }
  });

  const txQueue = createTxQueue({ logger });

  app.get('/system/queue-stats', async (_req, res) => {
    try {
      const stats = await getQueueStats(isTxQueueEnabled() ? txQueue : null);
      const scaleSignal = computeWorkerScaleSignal({
        waiting: stats.waiting,
        active: stats.active,
      });
      res.json({ ...stats, scaleSignal });
    } catch (e) {
      logger.warn('system/queue-stats failed', { message: e?.message });
      res.json({ waiting: 0, active: 0, completed: 0, failed: 0, scaleSignal: 'hold' });
    }
  });
  const withdrawalController = createWithdrawalController({
    logger,
    withdrawalService,
    signerService,
    authService,
    txQueue: isTxQueueEnabled() ? txQueue : null,
  });

  await recoverPendingWithdrawals({ logger, signerService });

  if (compensationOn && getCompensationKernel()) {
    const { compensationWebhookRoutes, compensationWebhookBodyParser } = await import(
      './routes/compensationWebhookRoutes.js'
    );
    const webhookLimit = rateLimit({
      windowMs: 60_000,
      max: Math.max(10, Number(process.env.COMPENSATION_WEBHOOK_RATE_LIMIT_PER_MIN || 40)),
      keyGenerator: (req) => `comp_webhook:${getClientIp(req)}`,
    });
    app.use(
      '/api/webhooks/compensation',
      webhookLimit,
      express.raw({ type: 'application/json', limit: '512kb' }),
      compensationWebhookBodyParser,
      compensationWebhookRoutes({ getKernel: getCompensationKernel, logger }),
    );
  }

  app.use(express.json({ limit: '1mb' }));

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      keyGenerator: keyByIpAndOptionalAuthAddress({ authService }),
    }),
  );

  app.use(
    '/api/auth/request-message',
    rateLimit({
      windowMs: 5 * 60 * 1000,
      max: 10,
      keyGenerator: (req) => `ip:${getClientIp(req)}`,
    }),
  );
  app.use(
    '/api/auth/verify-signature',
    rateLimit({
      windowMs: 5 * 60 * 1000,
      max: 10,
      keyGenerator: (req) => `ip:${getClientIp(req)}`,
    }),
  );

  app.use(
    '/api/request-withdraw',
    rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 5,
      keyGenerator: keyByAuthAddressOrIp({ authService }),
    }),
  );

  app.use('/api', createApiSessionAuthMiddleware({ authService }));

  app.use('/api', depositRoutes({ depositController }));
  app.use('/api', withdrawRoutes({ withdrawalController }));
  app.use('/api', authRoutes({ authController }));
  app.use('/genesis', genesisDashboardRoutes({ authService }));

  if (compensationOn && getCompensationKernel()) {
    const { compensationHttpRoutes } = await import('./routes/compensationHttpRoutes.js');
    app.use('/api', compensationHttpRoutes({ authService }));
  } else {
    const useEmptyMock = String(process.env.GENESIS_USE_EMPTY_MOCK || '').trim() === '1';
    if (useEmptyMock) {
      const { localGenesisMockRoutes } = await import('./routes/localGenesisMockRoutes.js');
      app.use('/api', localGenesisMockRoutes());
      logger.info('local_genesis_mock_api', { reason: 'GENESIS_USE_EMPTY_MOCK' });
    } else {
      const { createGenesisPlatformRouter } = await import('./genesis-platform/http/genesisPlatformRoutes.js');
      app.use('/api', createGenesisPlatformRouter({ authService, logger }));
      logger.info('genesis_platform_api', {
        reason: compensationOn ? 'compensation_kernel_unavailable' : 'compensation_disabled',
      });
    }
  }

  const PORT = Number(process.env.PORT || 5050);
  const httpServer = createServer(app);

  const socketCors = String(process.env.SOCKET_CORS_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const io = createSocketServer(httpServer, {
    logger,
    corsOrigin: socketCors.length ? socketCors : '*',
  });
  setSocketHub(io);

  const queueStatsBroadcastMs = Number(process.env.QUEUE_STATS_BROADCAST_MS || 8000);
  if (queueStatsBroadcastMs > 0) {
    setInterval(async () => {
      try {
        const stats = await getQueueStats(isTxQueueEnabled() ? txQueue : null);
        const scaleSignal = computeWorkerScaleSignal({
          waiting: stats.waiting,
          active: stats.active,
        });
        emitQueueStats({
          waiting: stats.waiting,
          active: stats.active,
          scaleSignal,
        });
      } catch (e) {
        logger.warn('queue_stats_broadcast_failed', { message: e?.message });
      }
    }, queueStatsBroadcastMs);
  }

  const broadcastMs = Number(process.env.SYSTEM_HEALTH_BROADCAST_MS || 12_000);
  if (broadcastMs > 0) {
    setInterval(async () => {
      try {
        const raw = await computeSystemHealth({ signerService });
        emitSystemHealth({
          network: raw.network,
          signer: raw.signer,
          mempool: raw.mempool,
          backend: raw.backend,
          riskLevel: raw.riskLevel,
        });
      } catch (e) {
        logger.warn('system_health_broadcast_failed', { message: e?.message });
      }
    }, broadcastMs);
  }

  let inlineWorker = null;
  if (String(process.env.RUN_INLINE_TX_WORKER || '') === '1' && isTxQueueEnabled()) {
    const conn = getBullRedisConnection();
    if (conn) {
      inlineWorker = new Worker(
        TX_QUEUE_NAME,
        (job) => processWithdrawJob(job, { signerService, logger }),
        {
          connection: conn,
          concurrency: Math.max(1, Number(process.env.TX_WORKER_CONCURRENCY || 1)),
        },
      );
      logger.info('inline_tx_worker_started', {
        concurrency: Math.max(1, Number(process.env.TX_WORKER_CONCURRENCY || 1)),
      });
    }
  }

  httpServer.on('error', (err) => {
    logger.error('http_server_error', { message: err.message, code: err.code });
    process.exit(1);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on ${PORT}`);
    logger.info('Server started', {
      port: PORT,
      env: process.env.NODE_ENV || 'development',
      txQueue: Boolean(txQueue),
      inlineWorker: Boolean(inlineWorker),
      node: process.version,
    });
  });
}

main().catch((err) => {
  logger.error('startup_failed', { message: err?.message, stack: err?.stack });
  process.exit(1);
});
