import { createSignalsProcessor } from './processorState.js';
import { createUpstreamBridge } from './upstreamBridge.js';
import { adminSignalsApi } from './adminSignalsApi.js';
import { attachAdminSignalsNamespace } from './attachAdminSignalsNamespace.js';
import { setSignalStreamInterpreterIo } from './signalStreamInterpreter.js';
import { setSignalSessionTrackerIo } from './signalSessionTracker.js';
import { createSignalPersistence } from './signalPersistenceService.js';
import { adminSignalsFlowTrace } from './signalFlowDebug.js';
import { relayAdminSignalsToClients, resolveTestEmitIntervalMs } from './relayAdminSignalsToClients.js';

/**
 * Fase 1 — registra REST en `/api/admin/signals/*` (antes de otros routers /api que no hagan `next()`).
 *
 * @param {{
 *   app: import('express').Application,
 *   logger: object,
 *   configRateLimit?: import('express').RequestHandler,
 *   signalsRateLimit?: import('express').RequestHandler,
 * }} ctx
 */
export async function registerAdminSignalsApiRoutes({ app, logger, configRateLimit, signalsRateLimit }) {
  const persistence = createSignalPersistence({ logger });
  await persistence.bootstrapRuntimeFromDb();

  if (!persistence.isReady()) {
    console.warn(
      'Mongo not connected',
      '- admin-signals: no persistence (signal_events / signal_metrics_daily). Set MONGO_URI and restart.',
    );
    logger.warn?.('admin_signals_mongo_off', { mongoReady: false });
  } else {
    console.log('Admin signals: mongoReady=true — persisting signal_events, signal_metrics, signal_metrics_daily');
    logger.info?.('admin_signals_mongo_ready', { mongoReady: true });
  }

  const processor = createSignalsProcessor({
    logger,
    hooks: persistence.getProcessorHooks(),
  });

  app.use(
    '/api',
    adminSignalsApi({
      processor,
      logger,
      configRateLimit,
      persistence,
      signalsRateLimit,
    }),
  );
  return { processor, persistence };
}

/**
 * Fase 2 — namespace Socket.IO + relay upstream (requiere `io`).
 *
 * @param {{
 *   io: import('socket.io').Server,
 *   processor: ReturnType<typeof createSignalsProcessor>,
 *   logger: object,
 *   sessionMiddleware: import('express').RequestHandler,
 * }} ctx
 */
export function attachAdminSignalsIo({ io, processor, logger, sessionMiddleware }) {
  setSignalStreamInterpreterIo(io);
  setSignalSessionTrackerIo(io);
  attachAdminSignalsNamespace(io, { sessionMiddleware, logger });

  const upstreamUrl =
    String(process.env.EXTERNAL_SIGNALS_WS || process.env.EXTERNAL_SIGNALS_URL || '').trim() ||
    'wss://appserver.winxplay.io:3000/external-signals';
  const upstreamKey = String(process.env.EXTERNAL_SIGNALS_API_KEY || '').trim();

  console.log('[CHECK] API KEY:', !!process.env.EXTERNAL_SIGNALS_API_KEY);
  console.log('[CHECK] WS URL:', process.env.EXTERNAL_SIGNALS_WS || process.env.EXTERNAL_SIGNALS_URL || '(default)', '→', upstreamUrl);

  const relayCtx = { io, processor, logger };

  const bridge = createUpstreamBridge({
    logger,
    url: upstreamUrl,
    apiKey: upstreamKey,
    io,
    onAdminEvent: ({ type, payload }) => {
      relayAdminSignalsToClients(relayCtx, type, payload, { source: 'upstream' });
    },
  });

  if (!upstreamKey) {
    adminSignalsFlowTrace(logger, 'upstream_bridge_disabled', {
      reason: 'EXTERNAL_SIGNALS_API_KEY missing',
    });
    console.warn(
      '[ADMIN_SIGNALS] Caso A: EXTERNAL_SIGNALS_API_KEY ausente — relay Winxplay desactivado. Ver .env.example (fallback + test emit).',
    );
    logger.warn?.('admin_signals_upstream_disabled', {
      reason: 'EXTERNAL_SIGNALS_API_KEY missing — set backend env to relay provider signals',
    });
  } else {
    adminSignalsFlowTrace(logger, 'upstream_bridge_starting', {
      urlHost: upstreamUrl.split('/').slice(0, 3).join('/'),
    });
    bridge.start();
    logger.info?.('admin_signals_upstream_starting', {
      urlHost: upstreamUrl.split('/').slice(0, 3).join('/'),
    });
  }

  const testIntervalMs = resolveTestEmitIntervalMs(Boolean(upstreamKey));
  /** @type {ReturnType<typeof setInterval> | null} */
  let testInterval = null;
  if (testIntervalMs > 0) {
    console.log(
      '[ADMIN_SIGNALS] TEST EMIT activo cada',
      testIntervalMs,
      'ms | ALWAYS=',
      String(process.env.ADMIN_SIGNALS_TEST_EMIT_ALWAYS ?? '1'),
      '| proveedor opcional',
    );
    testInterval = setInterval(() => {
      relayAdminSignalsToClients(
        relayCtx,
        'NEW_SIGNAL',
        {
          mesa: 'TEST',
          recommendation: 'P',
          martingale: 1,
          round: Date.now(),
        },
        { source: 'test_emit' },
      );
    }, testIntervalMs);
    testInterval.unref?.();
  }

  return { bridge, stopTestEmitter: () => testInterval && clearInterval(testInterval) };
}
