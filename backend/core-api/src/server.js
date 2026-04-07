import 'dotenv/config';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import express from 'express';
import cors from 'cors';
import { Worker } from 'bullmq';

import { createLogger } from './utils/logger.js';
import { getMongoHealthSummary, isGenesisMongoReady } from '../dist/db/connect.js';
import { connectMongo } from './db/mongo.js';
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
  rateLimitUnless,
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
import { adminAuthRoutes, adminLoginHandler } from './routes/adminAuthRoutes.js';
import { registerAdminSignalsApiRoutes, attachAdminSignalsIo } from './admin-signals/index.js';
import { startSignalMetricsDailyAggregation } from './admin-signals/signalMetricsDailyJob.js';
import { startSignalAutoResponseScheduler } from './admin-signals/signalAutoResponseService.js';
import { runMongoStartupVerify } from './db/mongoStartupVerify.js';
import { runAdminSignalsHttpSmoke } from './db/adminSignalsHttpSmoke.js';

console.log('🧠 Mongo URI loaded:', !!process.env.MONGO_URI);

const logger = createLogger();

/**
 * Comprueba que ningún proceso esté escuchando en `port` antes de crear HTTP/Socket.IO.
 * @param {number} port
 * @returns {Promise<void>}
 */
function assertListenPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', (err) => {
      probe.removeAllListeners();
      reject(err);
    });
    probe.listen({ port, host: '0.0.0.0', exclusive: true }, () => {
      probe.close(() => resolve());
    });
  });
}

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('unhandledRejection', { message: err.message, stack: err.stack });
});

process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { message: err?.message, stack: err?.stack });
  process.exit(1);
});

async function main() {
  await connectMongo(logger);

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
  const sessionMiddleware = session({
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
  });
  app.use(sessionMiddleware);

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
    const summary = getMongoHealthSummary();
    const body = { ok: true };
    if (summary.configured && summary.sources?.genesis?.uriConfigured) {
      body.mongo = isGenesisMongoReady() ? 'connected' : 'disconnected';
    } else if (summary.configured) {
      body.mongo = summary.ready ? 'connected' : 'disconnected';
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

  /** POST /admin/login (sin prefijo /api) — mismo handler que POST /api/admin/auth/login. */
  app.post('/admin/login', adminLoginHandler);

  const IS_DEV_API = process.env.NODE_ENV !== 'production';

  /**
   * Admin email/cookie: montar antes del límite “API general” para orden de middleware predecible.
   * Además, el límite general excluye `/api/admin/auth/*`, `/api/admin/session/*` y `/api/admin/signals/*`.
   */
  app.use('/api', adminAuthRoutes());

  /** Rutas que no deben consumir el cubo “API general” (tienen cubo propio o van desacopladas). */
  function shouldSkipGeneralApiRateLimit(req) {
    const path = String(req.originalUrl || req.url || '').split('?')[0] || '';
    if (path === '/admin/login' || path.startsWith('/admin/login/')) return true;
    if (path === '/api/admin/auth' || path.startsWith('/api/admin/auth/')) return true;
    if (path === '/api/admin/login' || path.startsWith('/api/admin/login/')) return true;
    if (path === '/api/admin/session' || path.startsWith('/api/admin/session/')) return true;
    if (path === '/api/admin/signals' || path.startsWith('/api/admin/signals/')) return true;
    return false;
  }

  const generalApiMax = Math.max(
    50,
    Number(process.env.API_GENERAL_RATE_LIMIT_MAX ?? (IS_DEV_API ? 2500 : 600)),
  );
  const generalApiWindowMs = Math.max(
    60_000,
    Number(process.env.API_GENERAL_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  );
  const generalApiLimit = rateLimit({
    windowMs: generalApiWindowMs,
    max: generalApiMax,
    keyGenerator: keyByIpAndOptionalAuthAddress({ authService }),
  });
  app.use(
    rateLimitUnless({
      skip: shouldSkipGeneralApiRateLimit,
      limit: generalApiLimit,
    }),
  );

  /** SIWE / firma cartera: en desarrollo, límite alto; en producción, estricto (env sobreescribe). */
  const authWalletRequestMax = Math.max(
    1,
    Number(process.env.API_AUTH_WALLET_REQUEST_MESSAGE_MAX ?? (IS_DEV_API ? 2000 : 10)),
  );
  const authWalletVerifyMax = Math.max(
    1,
    Number(process.env.API_AUTH_WALLET_VERIFY_MAX ?? (IS_DEV_API ? 2000 : 10)),
  );

  app.use(
    '/api/auth/request-message',
    rateLimit({
      windowMs: 5 * 60 * 1000,
      max: authWalletRequestMax,
      keyGenerator: (req) => `auth_wallet:request_msg:${getClientIp(req)}`,
    }),
  );
  app.use(
    '/api/auth/verify-signature',
    rateLimit({
      windowMs: 5 * 60 * 1000,
      max: authWalletVerifyMax,
      keyGenerator: (req) => `auth_wallet:verify:${getClientIp(req)}`,
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

  /** Admin signals: cubo alto (por minuto) separado del API general. */
  const adminSignalsReadMax = Math.max(
    60,
    Number(process.env.ADMIN_SIGNALS_READ_RATE_LIMIT_PER_MIN ?? (IS_DEV_API ? 1200 : 400)),
  );
  const adminSignalsReadLimit = rateLimit({
    windowMs: 60_000,
    max: adminSignalsReadMax,
    keyGenerator: (req) => `admin_signals_read:${getClientIp(req)}`,
  });

  const adminSignalsConfigLimit = rateLimit({
    windowMs: 60_000,
    max: Math.max(20, Number(process.env.ADMIN_SIGNALS_CONFIG_RATE_LIMIT_PER_MIN || 40)),
    keyGenerator: (req) => `admin_signals_cfg:${getClientIp(req)}`,
  });
  const adminSignalsCtx = await registerAdminSignalsApiRoutes({
    app,
    logger,
    configRateLimit: adminSignalsConfigLimit,
    signalsRateLimit: adminSignalsReadLimit,
  });

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

  try {
    await assertListenPortAvailable(PORT);
  } catch (e) {
    const err = /** @type {NodeJS.ErrnoException} */ (e);
    if (err?.code === 'EADDRINUSE') {
      console.warn(`\n[core-api] Puerto ${PORT} ya está en uso.`);
      console.warn('Otra instancia del Core API (u otro servicio) está escuchando ahí.');
      console.warn('Libera el puerto:  npm run dev:clean');
      console.warn(`Comprueba el proceso:  lsof -i :${PORT}\n`);
      process.exit(1);
    }
    throw e;
  }

  const httpServer = createServer(app);

  const isProd = process.env.NODE_ENV === 'production';
  const socketCors = String(process.env.SOCKET_CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let corsOriginForIo =
    socketCors.length > 0 ? socketCors : isProd ? false : '*';
  if (isProd && socketCors.length === 0) {
    logger.warn(
      'production: SOCKET_CORS_ORIGIN unset — Socket.IO CORS origin disabled (set comma-separated origins)',
    );
  }
  const io = createSocketServer(httpServer, {
    logger,
    corsOrigin: corsOriginForIo,
  });
  setSocketHub(io);

  attachAdminSignalsIo({
    io,
    processor: adminSignalsCtx.processor,
    logger,
    sessionMiddleware,
  });

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
    if (err.code === 'EADDRINUSE') {
      console.warn(`\n[core-api] Puerto ${PORT} ocupado al iniciar listen (¿carrera?).`);
      console.warn('Libera el puerto:  npm run dev:clean');
      console.warn(`Ver:  lsof -i :${PORT}\n`);
    }
    logger.error('http_server_error', { message: err.message, code: err.code });
    process.exit(1);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('✔ Core API running on', PORT);
    console.log('PID:', process.pid);
    logger.info('Server started', {
      port: PORT,
      env: process.env.NODE_ENV || 'development',
      txQueue: Boolean(txQueue),
      inlineWorker: Boolean(inlineWorker),
      node: process.version,
    });
    startSignalMetricsDailyAggregation({ logger });
    const arRaw = process.env.SIGNAL_AUTO_RESPONSE_INTERVAL_MS;
    const arMs =
      arRaw === '0'
        ? 0
        : Math.max(0, Number(arRaw !== undefined && String(arRaw).trim() !== '' ? arRaw : 300_000));
    startSignalAutoResponseScheduler({
      persistence: adminSignalsCtx.persistence,
      logger,
      intervalMs: arMs,
    });

    const smokeMs = Math.max(0, Number(process.env.MONGO_STARTUP_VERIFY_DELAY_MS || 800));
    setTimeout(async () => {
      try {
        await runMongoStartupVerify(logger);
        await runAdminSignalsHttpSmoke({ port: PORT, logger });
      } catch (e) {
        logger.warn('startup_mongo_smoke_failed', {
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }, smokeMs);
  });
}

main().catch((err) => {
  logger.error('startup_failed', { message: err?.message, stack: err?.stack });
  process.exit(1);
});
