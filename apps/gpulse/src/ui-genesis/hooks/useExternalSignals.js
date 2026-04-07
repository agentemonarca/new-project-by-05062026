import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  getExternalSignalsSocketUrl,
  isExternalSignalsBffEnabled,
  isExternalSignalsEnabled,
  resolveExternalSignalsApiKey,
} from '../lib/externalSignalsConfig.js';
import { getApiBaseUrl } from '../api/genesisConfig.js';
import { useExternalSignalsStore } from '../stores/externalSignalsStore.js';
import { useAdminSignalsStore } from '../stores/adminSignalsStore.js';
import { redirectToAdminLogin } from '../lib/adminAuthRedirect.js';
import { addRawEvent } from '../stores/rawEventsStore.js';

const EVENT_NEW_SIGNAL = 'NEW_SIGNAL';
const EVENT_NEW_RESULT = 'NEW_RESULT';

function scheduleIngest(cb) {
  const ms = Math.max(0, Number(useAdminSignalsStore.getState().delayMs) || 0);
  if (ms > 0) {
    window.setTimeout(cb, ms);
    return;
  }
  cb();
}

/**
 * Conexión Socket.IO al proveedor externo o al relay BFF (`/admin-signals`).
 *
 * @param {{ enabled?: boolean, apiKeyOverride?: string | null, preferBff?: boolean }} [opts]
 */
export function useExternalSignals(opts = {}) {
  const envDirect = isExternalSignalsEnabled();
  const envBff = isExternalSignalsBffEnabled();
  const useBff =
    Boolean(opts.preferBff) || (envBff && (opts.apiKeyOverride == null || !String(opts.apiKeyOverride).trim()));
  const enabledDefault = envDirect || envBff;
  const enabled = opts.enabled !== undefined ? Boolean(opts.enabled) : enabledDefault;

  const socketRef = useRef(null);
  const manualCloseRef = useRef(false);

  const setMeta = useExternalSignalsStore((s) => s.setConnectionMeta);
  const ingestNewSignal = useExternalSignalsStore((s) => s.ingestNewSignal);
  const ingestNewResult = useExternalSignalsStore((s) => s.ingestNewResult);
  const pushEvent = useExternalSignalsStore((s) => s.pushEvent);
  const logAdminRaw = useExternalSignalsStore((s) => s.logAdminRawSocketEvent);

  useEffect(() => {
    if (!enabled) {
      setMeta({ connectionStatus: 'disabled', lastError: null });
      return undefined;
    }

    if (!useBff) {
      const url = getExternalSignalsSocketUrl();
      const apiKey =
        opts.apiKeyOverride != null && String(opts.apiKeyOverride).trim()
          ? String(opts.apiKeyOverride).trim()
          : resolveExternalSignalsApiKey();

      if (!apiKey) {
        setMeta({
          connectionStatus: 'error',
          lastError: 'external_signals_no_api_key',
        });
        pushEvent(
          'config',
          'Sin apiKey: activa VITE_EXTERNAL_SIGNALS_BFF=1 + proxy, o configura clave (solo dev)',
        );
        return undefined;
      }

      manualCloseRef.current = false;
      setMeta({ connectionStatus: 'connecting', lastError: null, reconnectAttempt: 0 });

      const socket = io(url, {
        transports: ['websocket'],
        auth: { apiKey },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15_000,
        timeout: 20_000,
      });

      socketRef.current = socket;

      const onConnect = () => {
        setMeta({
          connectionStatus: 'connected',
          lastError: null,
          lastConnectedAt: Date.now(),
          reconnectAttempt: 0,
        });
        pushEvent('socket', 'Conectado a señales externas (directo)');
      };

      const onDisconnect = (reason) => {
        if (manualCloseRef.current) return;
        setMeta((prev) => ({
          ...prev,
          connectionStatus: 'reconnecting',
          lastError: reason ? `disconnect:${reason}` : 'disconnect',
          reconnectAttempt: (prev.reconnectAttempt || 0) + 1,
        }));
      };

      const onConnectError = (err) => {
        const msg = err?.message || String(err);
        if (msg === 'unauthorized') {
          console.warn('🔐 sesión inválida');
          redirectToAdminLogin();
          return;
        }
        setMeta({ connectionStatus: 'error', lastError: msg });
        pushEvent('error', msg);
      };

      const onNewSignal = (payload) => {
        logAdminRaw(EVENT_NEW_SIGNAL, payload);
        scheduleIngest(() => {
          try {
            ingestNewSignal(payload);
          } catch (e) {
            pushEvent('parse_error', String(e?.message || e));
          }
        });
      };

      const onNewResult = (payload) => {
        logAdminRaw(EVENT_NEW_RESULT, payload);
        scheduleIngest(() => {
          try {
            ingestNewResult(payload);
          } catch (e) {
            pushEvent('parse_error', String(e?.message || e));
          }
        });
      };

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.io.on('reconnect_attempt', (n) => {
        setMeta({ connectionStatus: 'reconnecting', reconnectAttempt: n });
      });
      socket.io.on('reconnect', () => {
        setMeta({ connectionStatus: 'connected', lastError: null, lastConnectedAt: Date.now() });
      });

      socket.on(EVENT_NEW_SIGNAL, onNewSignal);
      socket.on(EVENT_NEW_RESULT, onNewResult);

      const onAnyRaw = (event, ...args) => {
        const payload = args.length <= 1 ? args[0] : args;
        addRawEvent(event, payload);
      };
      socket.onAny(onAnyRaw);

      return () => {
        manualCloseRef.current = true;
        socket.offAny(onAnyRaw);
        socket.off(EVENT_NEW_SIGNAL, onNewSignal);
        socket.off(EVENT_NEW_RESULT, onNewResult);
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('connect_error', onConnectError);
        socket.removeAllListeners();
        socket.disconnect();
        socketRef.current = null;
        setMeta({ connectionStatus: 'idle', lastError: null });
      };
    }

    const base = getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!base && typeof window === 'undefined') {
      return undefined;
    }

    manualCloseRef.current = false;
    setMeta({ connectionStatus: 'connecting', lastError: null, reconnectAttempt: 0 });

    const socket = io(`${base}/admin-signals`, {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15_000,
      timeout: 20_000,
    });

    socketRef.current = socket;

    const onConnect = () => {
      setMeta({
        connectionStatus: 'connected',
        lastError: null,
        lastConnectedAt: Date.now(),
        reconnectAttempt: 0,
      });
      pushEvent('socket', 'Conectado a Signals BFF (/admin-signals)');
    };

    const onDisconnect = (reason) => {
      if (manualCloseRef.current) return;
      setMeta((prev) => ({
        ...prev,
        connectionStatus: 'reconnecting',
        lastError: reason ? `disconnect:${reason}` : 'disconnect',
        reconnectAttempt: (prev.reconnectAttempt || 0) + 1,
      }));
    };

    const onConnectErrorBff = (err) => {
      const msg = err?.message || String(err);
      if (msg === 'unauthorized') {
        console.warn('🔐 sesión inválida');
        redirectToAdminLogin();
        return;
      }
      setMeta({ connectionStatus: 'error', lastError: msg });
      pushEvent('error', msg);
    };

    const onNewSignal = (payload) => {
      logAdminRaw(EVENT_NEW_SIGNAL, payload);
      scheduleIngest(() => {
        try {
          ingestNewSignal(payload);
        } catch (e) {
          pushEvent('parse_error', String(e?.message || e));
        }
      });
    };

    const onNewResult = (payload) => {
      logAdminRaw(EVENT_NEW_RESULT, payload);
      scheduleIngest(() => {
        try {
          ingestNewResult(payload);
        } catch (e) {
          pushEvent('parse_error', String(e?.message || e));
        }
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectErrorBff);
    socket.io.on('reconnect_attempt', (n) => {
      setMeta({ connectionStatus: 'reconnecting', reconnectAttempt: n });
    });
    socket.io.on('reconnect', () => {
      setMeta({ connectionStatus: 'connected', lastError: null, lastConnectedAt: Date.now() });
    });

    socket.on(EVENT_NEW_SIGNAL, onNewSignal);
    socket.on(EVENT_NEW_RESULT, onNewResult);

    const onAnyRaw = (event, ...args) => {
      const payload = args.length <= 1 ? args[0] : args;
      addRawEvent(event, payload);
    };
    socket.onAny(onAnyRaw);

    return () => {
      manualCloseRef.current = true;
      socket.offAny(onAnyRaw);
      socket.off(EVENT_NEW_SIGNAL, onNewSignal);
      socket.off(EVENT_NEW_RESULT, onNewResult);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectErrorBff);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setMeta({ connectionStatus: 'idle', lastError: null });
    };
  }, [
    enabled,
    useBff,
    opts.apiKeyOverride,
    setMeta,
    ingestNewSignal,
    ingestNewResult,
    pushEvent,
    logAdminRaw,
  ]);
}
