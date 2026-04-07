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

  function emitSafe(type, payload) {
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

    socket.on('connect', () => {
      console.log('🟢 upstream_ws_connected', { id: socket?.id, transport: socket?.io?.engine?.transport?.name });
      adminSignalsFlowTrace(logger, 'upstream_ws_connected', {
        socketId: socket?.id,
        transport: socket?.io?.engine?.transport?.name,
      });
      logger?.info?.('admin_signals_upstream_connected', { url: url.replace(/:\/\/[^@]+@/, '://***@') });
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
        emitSafe(EVENT_NEW_SIGNAL, payload);
        return;
      }
      if (eventName === EVENT_NEW_RESULT) {
        logRawProviderSampleOnce('NEW_RESULT', payload);
        adminSignalsFlowTrace(logger, 'upstream_recv_new_result', { summary: summarizePayloadForFlow(payload) });
        emitSafe(EVENT_NEW_RESULT, payload);
        return;
      }
      if (eventName === EVENT_DASHBOARD_UPDATE) {
        logRawProviderSampleOnce('dashboardUpdate', payload);
        adminSignalsFlowTrace(logger, 'upstream_recv_dashboard_update', {
          ...summarizeDashboardUpdatePayloadSafe(payload),
        });

        try {
          const relayed = tryWinxplayDashboardRelay(payload);
          if (relayed) {
            const { type, data } = relayed;
            console.log('[WINX]', type);
            emitSafe(type, data);
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
        for (const raw of signals) emitSafe(EVENT_NEW_SIGNAL, raw);
        for (const raw of results) emitSafe(EVENT_NEW_RESULT, raw);
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
