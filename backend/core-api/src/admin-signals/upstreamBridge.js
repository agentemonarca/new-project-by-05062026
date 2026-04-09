import { io as ioClient } from 'socket.io-client';
import { extractMesaFromPayload } from './signalNormalize.js';
import { adminSignalsRuntime } from './runtimeConfig.js';
import { expandDashboardUpdate } from './signalDashboardTransform.js';
import {
  adminSignalsFlowTrace,
  summarizeDashboardUpdatePayloadSafe,
  summarizePayloadForFlow,
} from './signalFlowDebug.js';
import { isWinxplayDebugStreamEnabled, tryWinxplayDashboardRelay } from '../services/winxplay-adapter.js';
import { logRawProviderSampleOnce } from './rawProviderSampleLog.js';
import { getSignalStreamInterpreter } from './signalStreamInterpreter.js';
import { getSignalSessionTracker } from './signalSessionTracker.js';

const EVENT_NEW_SIGNAL = 'NEW_SIGNAL';
const EVENT_NEW_RESULT = 'NEW_RESULT';
const EVENT_DASHBOARD_UPDATE = 'dashboardUpdate';

/**
 * @typedef {{
 *   logger?: object,
 *   url: string,
 *   apiKey: string,
 *   onAdminEvent: (ev: { type: string, payload: unknown, ts: number }) => void,
 *   io?: import('socket.io').Server,
 * }} BridgeOpts
 */

export function createUpstreamBridge({ logger, url, apiKey, onAdminEvent, io }) {
  /** @type {import('socket.io-client').Socket | null} */
  let socket = null;
  let stopped = false;
  const upstreamTraceOn = String(process.env.ADMIN_SIGNALS_UPSTREAM_TRACE ?? '').trim() === '1';
  /** Phase 2: frequency by top-level key signature at emitSafe (ADMIN_SIGNALS_SHAPE_AUDIT=1). */
  const shapeCounts = new Map();

  /** @param {unknown} payload */
  function shapeKeyFromPayload(payload) {
    if (payload == null) return 'null';
    const t = typeof payload;
    if (t !== 'object') return t;
    if (Array.isArray(payload)) return 'array';
    try {
      return Object.keys(/** @type {Record<string, unknown>} */ (payload))
        .sort()
        .join(',');
    } catch {
      return 'object[keys_error]';
    }
  }

  function shouldForward(type, payload) {
    if (!adminSignalsRuntime.upstreamEnabled) return false;
    if (!adminSignalsRuntime.visibilityEnabled && type === EVENT_NEW_SIGNAL) {
      /* aún reenviamos a operadores admin namespace vía callback; "visibility" afecta solo fan-out futuro */
    }
    const want = String(adminSignalsRuntime.filters.mesa || '').trim();
    if (!want) return true;
    const mesa = extractMesaFromPayload(payload);
    return mesa === want;
  }

  function schedule(ev) {
    const ms = Math.max(0, adminSignalsRuntime.delayMs || 0);
    if (ms > 0) {
      adminSignalsFlowTrace(logger, 'relay_scheduled_delay', { type: ev.type, delayMs: ms });
      setTimeout(() => {
        if (!stopped) onAdminEvent(ev);
      }, ms);
    } else {
      onAdminEvent(ev);
    }
  }

  /**
   * @param {string} type
   * @param {unknown} payload
   * @param {string} [shapeSource] — observability only (Phase 2); does not change relay data.
   */
  function emitSafe(type, payload, shapeSource = 'unknown') {
    const ts = Date.now();
    if (!adminSignalsRuntime.upstreamEnabled) {
      adminSignalsFlowTrace(logger, 'relay_blocked_upstream_disabled', { type });
      return;
    }
    if (!shouldForward(type, payload)) {
      adminSignalsFlowTrace(logger, 'relay_blocked_mesa_filter', {
        type,
        mesa: extractMesaFromPayload(payload),
        filterWanted: String(adminSignalsRuntime.filters.mesa || '').trim(),
      });
      return;
    }
    // Phase 2 shape audit: ADMIN_SIGNALS_SHAPE_AUDIT=1
    const shapeAuditOn = String(process.env.ADMIN_SIGNALS_SHAPE_AUDIT ?? '').trim() === '1';
    if (shapeAuditOn && (type === EVENT_NEW_SIGNAL || type === EVENT_NEW_RESULT)) {
      const shapeKey = shapeKeyFromPayload(payload);
      const next = (shapeCounts.get(shapeKey) ?? 0) + 1;
      shapeCounts.set(shapeKey, next);
      console.log('[SHAPE_DETECTED]', shapeKey);
      try {
        console.log('[SHAPE_SAMPLE]', JSON.stringify(payload, null, 2));
      } catch {
        console.log('[SHAPE_SAMPLE]', String(payload));
      }
      console.log('[SHAPE_COUNT]', shapeKey, next);
      console.log('[SHAPE_SOURCE]', { eventType: type, source: shapeSource, shapeKey });
    }
    // Phase 1 forensic input (pre-normalize): ADMIN_SIGNALS_PRENORMALIZE_LOG=1
    const prenormalizeLog = String(process.env.ADMIN_SIGNALS_PRENORMALIZE_LOG ?? '').trim() === '1';
    if (prenormalizeLog && (type === EVENT_NEW_SIGNAL || type === EVENT_NEW_RESULT)) {
      let serialized = '';
      try {
        serialized = JSON.stringify(payload, null, 2);
      } catch {
        serialized = String(payload);
      }
      if (type === EVENT_NEW_SIGNAL) {
        console.log('[RAW_SIGNAL]', serialized);
        console.log('[TRACE_RAW_SIGNAL]', serialized);
      } else {
        console.log('[RAW_RESULT]', serialized);
        console.log('[TRACE_RAW_RESULT]', serialized);
      }
      console.log('[TRACE_ROUND_PATHS]', {
        mesa: payload?.data?.mesa,
        round_direct: payload?.round,
        ronda_root: payload?.data?.ronda,
        ronda_nested: payload?.data?.data?.signal?.ronda_actual,
        ronda_result: payload?.data?.data?.results?.mesa_info?.ronda_objetivo,
      });
    }
    schedule({ type, payload, ts });
  }

  function connect() {
    if (!url || !apiKey || stopped) return;
    socket = ioClient(url, {
      transports: ['websocket'],
      auth: { apiKey },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 20_000,
      randomizationFactor: 0.5,
      timeout: 25_000,
    });

    // RAW upstream tap (no engine, no filters, no classification): print everything.
    socket.onAny((event, data) => {
      try {
        console.log('🔥 UPSTREAM RAW:', event);
        try {
          console.log(JSON.stringify(data, null, 2));
        } catch {
          console.log(String(data));
        }
      } catch {
        /* ignore */
      }
    });
    // Some providers send unnamed messages.
    socket.on('message', (data) => {
      try {
        console.log('🔥 UPSTREAM MESSAGE:', data);
      } catch {
        /* ignore */
      }
    });

    socket.on('connect', () => {
      console.log('🟢 upstream_ws_connected', { id: socket?.id, transport: socket?.io?.engine?.transport?.name });
      console.log('🟢 UPSTREAM CONNECTED', socket?.id);
      if (upstreamTraceOn) console.log('UPSTREAM CONNECTED');
      adminSignalsFlowTrace(logger, 'upstream_ws_connected', {
        socketId: socket?.id,
        transport: socket?.io?.engine?.transport?.name,
      });
      logger?.info?.('admin_signals_upstream_connected', { url: url.replace(/:\/\/[^@]+@/, '://***@') });

      // Optional subscription probe (env-gated). Does not change engine/relay behavior.
      if (String(process.env.ADMIN_SIGNALS_UPSTREAM_SUBSCRIBE ?? '').trim() === '1') {
        const payloadRaw = String(process.env.ADMIN_SIGNALS_UPSTREAM_SUBSCRIBE_PAYLOAD ?? '').trim();
        /** @type {unknown} */
        let subPayload = { tables: 'ALL' };
        if (payloadRaw) {
          try {
            subPayload = JSON.parse(payloadRaw);
          } catch {
            subPayload = payloadRaw;
          }
        }
        try {
          console.log('UPSTREAM SUBSCRIBE → emit subscribe', subPayload);
          socket?.emit?.('subscribe', subPayload);
        } catch (e) {
          console.warn('UPSTREAM SUBSCRIBE failed', e instanceof Error ? e.message : String(e));
        }
      }
    });
    socket.on('connect_error', (err) => {
      const msg = err?.message || String(err);
      console.error('❌ upstream error:', msg);
      logger?.warn?.('admin_signals_upstream_error', { message: msg });
    });
    socket.on('disconnect', (reason) => {
      console.log('[UPSTREAM] disconnect:', String(reason));
      logger?.info?.('admin_signals_upstream_disconnect', { reason: String(reason) });
    });

    socket.io.on('reconnect_attempt', (n) => {
      console.log('[UPSTREAM] Caso B: reconnect_attempt #', n, '(cliente socket.io reintenta automáticamente)');
    });
    socket.io.on('reconnect', (attempt) => {
      console.log('🟢 upstream_ws_connected (reconnect)', { attempt });
    });
    socket.io.on('reconnect_error', (err) => {
      console.error('❌ upstream reconnect_error:', err?.message || err);
    });

    socket.onAny((eventName, ...args) => {
      const payload = args.length ? args[0] : undefined;

      if (upstreamTraceOn) {
        try {
          console.log('TRACE: RAW UPSTREAM EVENT', JSON.stringify({ eventName, payload }, null, 2));
        } catch {
          console.log('TRACE: RAW UPSTREAM EVENT', '[non-serializable]');
        }
        const pObj = payload && typeof payload === 'object' ? /** @type {any} */ (payload) : null;
        console.log(
          'TRACE: UPSTREAM TYPE',
          (pObj && (pObj.type || pObj.eventName)) ? String(pObj.type || pObj.eventName) : 'UNKNOWN',
        );
        console.log('TRACE: BEFORE ENGINE', { eventName: String(eventName), payload });
      }

      if (process.env.ADMIN_SIGNALS_LOG_UPSTREAM_EVENTS === '1') {
        const preview =
          args.length && typeof args[0] === 'object'
            ? Object.keys(/** @type {object} */ (args[0]) || {}).slice(0, 8)
            : args.length;
        console.log('[UPSTREAM EVENT]', eventName, preview);
      }

      try {
        getSignalStreamInterpreter().ingestProviderOnAny(String(eventName), payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger?.warn?.('signal_stream_interpreter_provider', { message: msg });
      }

      try {
        getSignalSessionTracker().ingestProviderEvent(String(eventName), payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger?.warn?.('signal_session_tracker', { message: msg });
      }

      if (eventName === EVENT_NEW_SIGNAL) {
        logRawProviderSampleOnce('NEW_SIGNAL', payload);
        adminSignalsFlowTrace(logger, 'upstream_recv_new_signal', { summary: summarizePayloadForFlow(payload) });
        emitSafe(EVENT_NEW_SIGNAL, payload, 'provider_socket:NEW_SIGNAL');
        return;
      }
      if (eventName === EVENT_NEW_RESULT) {
        logRawProviderSampleOnce('NEW_RESULT', payload);
        adminSignalsFlowTrace(logger, 'upstream_recv_new_result', { summary: summarizePayloadForFlow(payload) });
        emitSafe(EVENT_NEW_RESULT, payload, 'provider_socket:NEW_RESULT');
        return;
      }
      if (eventName === EVENT_DASHBOARD_UPDATE) {
        logRawProviderSampleOnce('dashboardUpdate', payload);
        adminSignalsFlowTrace(logger, 'upstream_recv_dashboard_update', {
          ...summarizeDashboardUpdatePayloadSafe(payload),
        });

        try {
          const relayed = tryWinxplayDashboardRelay(payload);
          if (upstreamTraceOn) {
            console.log('TRACE: ENGINE CLASSIFICATION', {
              isSignal: Boolean(relayed && relayed.type === 'NEW_SIGNAL'),
              isResult: Boolean(relayed && relayed.type === 'NEW_RESULT'),
              data: relayed,
            });
          }
          if (relayed) {
            const { type, data } = relayed;
            console.log('[WINX]', type);
            emitSafe(type, data, 'winxplay_adapter:dashboardUpdate');
            if (io && isWinxplayDebugStreamEnabled()) {
              try {
                io.of('/admin-signals').emit('DEBUG_STREAM', payload);
              } catch {
                /* silent */
              }
            }
            return;
          }
        } catch {
          /* vacío: seguir con expand genérico */
        }

        const { signals, results } = expandDashboardUpdate(payload);
        if (upstreamTraceOn) {
          console.log('TRACE: ENGINE CLASSIFICATION', {
            isSignal: signals.length > 0,
            isResult: results.length > 0,
            data: { signalsCount: signals.length, resultsCount: results.length },
          });
        }
        adminSignalsFlowTrace(logger, 'dashboard_update_expanded', {
          newSignalRaws: signals.length,
          newResultRaws: results.length,
        });
        if (signals.length + results.length > 0) {
          logger?.info?.('admin_signals_dashboard_update', {
            signals: signals.length,
            results: results.length,
          });
        }
        for (const raw of signals) emitSafe(EVENT_NEW_SIGNAL, raw, 'dashboard_expand:signal');
        for (const raw of results) emitSafe(EVENT_NEW_RESULT, raw, 'dashboard_expand:result');
      }
    });
  }

  return {
    start() {
      stopped = false;
      connect();
    },
    stop() {
      stopped = true;
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
      }
    },
    isRunning() {
      return Boolean(socket?.connected);
    },
  };
}
