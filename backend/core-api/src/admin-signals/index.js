import { createSignalsProcessor } from './processorState.js';
import { createUpstreamBridge } from './upstreamBridge.js';
import { adminSignalsApi } from './adminSignalsApi.js';
import { attachAdminSignalsNamespace } from './attachAdminSignalsNamespace.js';
import { setSignalStreamInterpreterIo } from './signalStreamInterpreter.js';
import { setSignalSessionTrackerIo } from './signalSessionTracker.js';
import { createSignalPersistence } from './signalPersistenceService.js';
import { adminSignalsFlowTrace } from './signalFlowDebug.js';
import {
  getLastClientResultForTest,
  relayAdminSignalsToClients,
  resolveTestEmitIntervalMs,
} from './relayAdminSignalsToClients.js';
import { createSignalEngine } from './signalEngine.js';
import { startGpulseDemoMode } from './demoEngineBridge.js';

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
  const signalEngine = createSignalEngine();

  const demoModeForced = String(process.env.GPULSE_DEMO_MODE ?? '').trim() === '1';
  const demoFallbackMs = Math.max(0, Number(process.env.GPULSE_DEMO_FALLBACK_MS || 10_000));
  const demoFallbackEnabled = !demoModeForced && demoFallbackMs > 0;

  /** @type {number} */
  let lastUpstreamEventTs = Date.now();
  /** @type {{ stop: () => void, isRunning: () => boolean } | null} */
  let demoCtl = null;

  function ensureDemoStarted(reason) {
    if (demoCtl?.isRunning()) return;
    console.warn('[GPULSE_DEMO]', 'starting demo engine:', reason);
    demoCtl = startGpulseDemoMode(relayCtx);
  }

  function ensureDemoStopped(reason) {
    if (!demoCtl?.isRunning()) return;
    console.warn('[GPULSE_DEMO]', 'stopping demo engine:', reason);
    demoCtl.stop();
  }

  const bridge = createUpstreamBridge({
    logger,
    url: upstreamUrl,
    apiKey: upstreamKey,
    io,
    onAdminEvent: ({ type, payload }) => {
      // Upstream is alive if we receive anything meaningful.
      lastUpstreamEventTs = Date.now();
      if (!demoModeForced) ensureDemoStopped(`upstream_event:${String(type)}`);
      try {
        console.log('[FLOW] BEFORE ENGINE →', type);
      } catch {
        /* ignore */
      }
      signalEngine.onProviderEvent(type, payload, relayCtx);
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

  // Demo mode switch:
  // - Forced: always run demo regardless of upstream key.
  // - Fallback: if upstream stays silent for demoFallbackMs, start demo.
  if (demoModeForced) {
    ensureDemoStarted('GPULSE_DEMO_MODE=1');
  } else if (demoFallbackEnabled) {
    setInterval(() => {
      const idle = Date.now() - lastUpstreamEventTs;
      if (idle >= demoFallbackMs) ensureDemoStarted(`fallback idle ${idle}ms`);
    }, 1000).unref?.();
  }

  const testIntervalMs = resolveTestEmitIntervalMs(Boolean(upstreamKey));
  const traceOn = String(process.env.ADMIN_SIGNALS_TRACE ?? '').trim() === '1';
  const testJitterMs = Math.max(0, Number(process.env.ADMIN_SIGNALS_TEST_EMIT_JITTER_MS || 0));
  const testResultDelayMs = Math.max(0, Number(process.env.ADMIN_SIGNALS_TEST_RESULT_DELAY_MS || 650));
  /** @type {ReturnType<typeof setInterval> | null} */
  let testInterval = null;
  // If demo is forced, we avoid running the legacy test emitter in parallel.
  if (!demoModeForced && testIntervalMs > 0) {
    // Forma proveedor real (`data.signal`) — sin mesa/round en raíz; STRICT + formatter admin-core.
    // `ronda_actual` incrementa para no deduplicar en el processor.
    let testRoundSeq = 50;
    console.log(
      '[ADMIN_SIGNALS] TEST EMIT activo cada',
      testIntervalMs,
      'ms | ALWAYS=',
      String(process.env.ADMIN_SIGNALS_TEST_EMIT_ALWAYS ?? '1'),
      '| proveedor opcional',
    );
    testInterval = setInterval(() => {
      const last = getLastClientResultForTest();
      const lastMesa = last?.mesa != null && String(last.mesa).trim() !== '' ? String(last.mesa).trim() : null;
      const lastRoundRaw = last?.round != null ? Number(last.round) : NaN;
      const lastRoundOk = Number.isFinite(lastRoundRaw) && lastRoundRaw > 0 && lastRoundRaw <= 1_000_000_000;

      // Si hay resultado reciente válido, alinear la señal de prueba para que VistaLab pueda hacer match.
      const mesa = lastMesa ?? 'Baccarat 5';
      // Importante: avanzar la ronda para evitar dedupe del processor y mantener flujo continuo.
      const round = lastRoundOk ? Math.trunc(lastRoundRaw) + 1 : (testRoundSeq += 1);

      if (traceOn) {
        console.log('TRACE: SIGNAL CREATED', {
          type: 'NEW_SIGNAL',
          payload: {
            data: {
              signal: {
                nombre_mesa: mesa,
                ronda_actual: round,
                vector_forecast: ['B', 'P', 'B', 'B', 'P', 'B'],
                nombre_algoritmo: 'SIMETRIA_TEST',
              },
            },
          },
        });
      }

      relayAdminSignalsToClients(
        relayCtx,
        'NEW_SIGNAL',
        {
          data: {
            signal: {
              nombre_mesa: mesa,
              ronda_actual: round,
              vector_forecast: ['B', 'P', 'B', 'B', 'P', 'B'],
              nombre_algoritmo: 'SIMETRIA_TEST',
            },
          },
        },
        { source: 'test_emit' },
      );

      // Emitir también la forma "real" estilo proveedor (dashboardUpdate anidado) para pruebas end-to-end.
      try {
        io.of('/admin-signals').emit('dashboardUpdate', {
          type: 'NEW_SIGNAL',
          data: {
            mesa,
            data: {
              signal: {
                nombre_mesa: mesa,
                ronda_actual: round,
                vector_forecast: ['B', 'P', 'B', 'B', 'P', 'B'],
                nombre_algoritmo: 'SIMETRIA_TEST',
              },
            },
            tipo: 'SIGNAL',
            win: null,
            ronda: round,
            isOpen: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      } catch {
        /* ignore */
      }

      // Si el upstream no está enviando resultados, generamos uno sintético STRICT-safe
      // para que el ciclo pueda cerrar (sin tocar matcher ni store).
      const shouldEmitFakeResult = true;
      if (shouldEmitFakeResult) {
        const winner = Math.random() > 0.5 ? 'PLAYER' : 'BANKER';
        const scoreDetail =
          winner === 'PLAYER'
            ? { ganador: 'PLAYER', puntaje_player: '8', puntaje_banker: '6', cartas_player: ['K', '8'], cartas_banker: ['Q', '6'] }
            : { ganador: 'BANKER', puntaje_player: '5', puntaje_banker: '7', cartas_player: ['9', '6'], cartas_banker: ['K', '7'] };
        // Pequeña demora para simular latencia real (y asegurar que la señal esté ya en buffer).
        setTimeout(() => {
          relayAdminSignalsToClients(
            relayCtx,
            'NEW_RESULT',
            {
              mesa,
              round,
              winStatus: winner === 'PLAYER',
              scoreDetail,
              // El frontend recomputa correlationKey, pero lo incluimos para trazas.
              correlationKey: `mesa:${mesa}|round:${round}`,
            },
            { source: 'test_emit' },
          );

          // Forma "real" estilo proveedor: dashboardUpdate con data.data.results.mesa_info.
          try {
            io.of('/admin-signals').emit('dashboardUpdate', {
              type: 'NEW_RESULT',
              data: {
                mesa,
                data: {
                  results: {
                    nombre_mesa: mesa,
                    mesa_info: {
                      id_mesa: String(Math.floor(Math.random() * 9e10 + 1e10)),
                      ronda_actual: round + 1,
                      puntaje_player: scoreDetail.puntaje_player ?? null,
                      puntaje_banker: scoreDetail.puntaje_banker ?? null,
                      cartas_player: scoreDetail.cartas_player ?? null,
                      cartas_banker: scoreDetail.cartas_banker ?? null,
                      apostar_pendiente: false,
                      lado_objetivo: '0',
                      ronda_objetivo: round,
                      sesion: false,
                      pairs_bet: false,
                      apuesta_activa: false,
                      lado_apostado: null,
                      saldo_antes_apuesta: 0,
                      monto_apostado: 100,
                      cantidad_clics: 1,
                      valor_moneda: 100,
                      tablero: Array.isArray(scoreDetail.tablero) ? scoreDetail.tablero : [],
                      Accion: 'ORDEN DE FUEGO 1',
                      jugada_id: Math.floor(Math.random() * 1000),
                      caption: '',
                      martingala: {
                        active: false,
                        vector_forecast: ['B', 'P', 'B', 'B', 'P', 'B'],
                        contador_martingala: 0,
                        vector_win: [winner === 'PLAYER' ? 'W' : 'L'],
                        vector_resultado: [winner === 'PLAYER' ? 'P' : 'B'],
                        nombre_patron: 'SIMETRIA_TEST',
                      },
                      paroli: {
                        paroli_martingala: false,
                        active: false,
                        vector_forecast: null,
                        contador_paroli: 0,
                        vector_win: [],
                        vector_resultado: [],
                        nombre_patron: '',
                      },
                      ganador: String(scoreDetail.ganador ?? winner),
                      victorias: { player: 0, banker: 0, tie: 0 },
                    },
                  },
                },
                tipo: 'RESULT',
                win: true,
                isOpen: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              winStatus: winner === 'PLAYER',
              martingalaData: {
                active: false,
                vector_forecast: ['B', 'P', 'B', 'B', 'P', 'B'],
                contador_martingala: 0,
                vector_win: [winner === 'PLAYER' ? 'W' : 'L'],
                vector_resultado: [winner === 'PLAYER' ? 'P' : 'B'],
                nombre_patron: 'SIMETRIA_TEST',
              },
            });
          } catch {
            /* ignore */
          }
        }, testResultDelayMs);
      }
    }, testIntervalMs + (testJitterMs > 0 ? Math.floor(Math.random() * (testJitterMs + 1)) : 0));
    testInterval.unref?.();
  }

  return { bridge, stopTestEmitter: () => testInterval && clearInterval(testInterval) };
}
