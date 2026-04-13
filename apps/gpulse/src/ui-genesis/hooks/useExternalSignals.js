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
import { redirectToAdminLogin } from '../lib/adminAuthRedirect.js';
import { addRawEvent } from '../stores/rawEventsStore.js';
import { isGpulseFullFlowEnabled, postFullFlowRow } from '../../utils/gpulseFullFlowClient.js';
import { logPipeCheck } from '../../utils/iaRealPipelineDiagnostics.js';
import { isGpulseRealityAuditEnabled } from '../../utils/gpulseRealityAudit.js';
import { nextOpaqueId } from '../../utils/gpulseRngPolicy.js';
import { normalizeNewResultPayload, normalizeNewSignalPayload } from '../lib/externalSignalsTypes.js';
import {
  coalesceSocketEventPayload,
  extractVectorResultadoAndWinFromResultRaw,
  mergeResultEnvelopeForExtract,
  PROVIDER_MARTINGALE_STEPS,
} from '../../utils/providerMartingaleRead.js';

const EVENT_NEW_SIGNAL = 'NEW_SIGNAL';
const EVENT_NEW_RESULT = 'NEW_RESULT';

const CYCLE_DEBUG = String(import.meta.env.VITE_CYCLE_DEBUG ?? '').trim() === '1';

/** Fase 2: contadores demostrables (solo con VITE_GPULSE_REALITY_AUDIT=1). */
const realityAuditSocketCounts = { NEW_SIGNAL: 0, NEW_RESULT: 0, signal_stream_frame_result: 0 };

/** @param {string} eventName */
function logRealityAuditRawSocket(eventName, payload) {
  if (!isGpulseRealityAuditEnabled()) return;
  if (eventName === EVENT_NEW_SIGNAL) realityAuditSocketCounts.NEW_SIGNAL += 1;
  if (eventName === EVENT_NEW_RESULT) realityAuditSocketCounts.NEW_RESULT += 1;
  console.log('📡 RAW SOCKET', payload);
  console.info('[REALITY-AUDIT Fase2]', eventName, 'acum.', { ...realityAuditSocketCounts });
}

/** @param {unknown} payload */
function pipeAfterSocketNewSignal(payload) {
  const st = useExternalSignalsStore.getState();
  const norm = normalizeNewSignalPayload(payload);
  const last = st.activeSignals[st.activeSignals.length - 1];
  logPipeCheck({
    layer: 'socket',
    event: 'NEW_SIGNAL',
    socket: payload,
    normalized: norm,
    storeRow: last,
    activeRow: last,
  });
}

/** @param {unknown} payload */
function pipeAfterSocketNewResult(payload) {
  const st = useExternalSignalsStore.getState();
  let norm = null;
  try {
    norm = normalizeNewResultPayload(payload);
  } catch {
    norm = null;
  }
  const storeRow = st.history[0] ?? st.activeSignals[st.activeSignals.length - 1];
  logPipeCheck({
    layer: 'socket',
    event: 'NEW_RESULT',
    socket: payload,
    normalized: norm,
    storeRow,
    activeRow: storeRow,
  });
}

function logCycleSocketNewSignalIfEnabled(raw) {
  if (!CYCLE_DEBUG) return;
  console.log('🔥 SOCKET NEW_SIGNAL RAW', JSON.stringify(raw, null, 2));
}

function logCycleSocketNewResultIfEnabled(raw) {
  if (!CYCLE_DEBUG) return;
  console.log('🔥 SOCKET NEW_RESULT RAW', JSON.stringify(raw, null, 2));
}

function logCycleStreamFrameResultIfEnabled(frame, raw) {
  if (!CYCLE_DEBUG) return;
  console.log('🔥 STREAM FRAME RESULT RAW', {
    eventName: frame?.eventName,
    raw,
  });
}

/** @param {unknown} v */
function coalesceRondaNumber(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
  const n = Number(String(v).replace(/[^\d.-]/g, '') || NaN);
  return Number.isFinite(n) ? n : null;
}

/** @param {unknown} o */
function tryRondaFromObject(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  const rec = /** @type {Record<string, unknown>} */ (o);
  for (const k of ['ronda_actual', 'ronda', 'Ronda', 'round', 'roundId', 'gameRound', 'hand']) {
    if (rec[k] != null && rec[k] !== '') {
      const n = coalesceRondaNumber(rec[k]);
      if (n != null) return n;
    }
  }
  return null;
}

/**
 * Ronda del último NEW_SIGNAL (`payload.ronda` o equivalente normalizado) — validar vs NEW_RESULT.
 * También guarda `providerSignalId` y `mesa` del normalizado para correlación con NEW_RESULT.
 */
function syncSignalRoundRefFromNewSignalPayload(payload, signalRoundRef, signalProviderIdRef, signalMesaRef) {
  const p = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? /** @type {Record<string, unknown>} */ (payload)
    : null;
  const norm = normalizeNewSignalPayload(payload);
  signalProviderIdRef.current = norm.providerSignalId;
  signalMesaRef.current = String(norm.mesa ?? '').trim();
  if (p && p.ronda != null) {
    const n = Number(p.ronda);
    signalRoundRef.current = Number.isFinite(n) ? n : null;
    return;
  }
  const n = Number(norm.round);
  signalRoundRef.current = norm.round !== '' && Number.isFinite(n) ? n : null;
}

/**
 * `ronda_actual` / ronda en NEW_RESULT: raíz, `mergeResultEnvelopeForExtract`, `data`/`data.data`, `results`, `mesa_info`.
 * @param {unknown} payload
 * @returns {number | null}
 */
function pickRondaActualFromNewResultPayload(payload) {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const r = /** @type {Record<string, unknown>} */ (payload);

  let flat = {};
  try {
    flat = mergeResultEnvelopeForExtract(payload);
  } catch {
    flat = {};
  }

  const fromRoot = tryRondaFromObject(r);
  if (fromRoot != null) return fromRoot;
  const fromFlat = tryRondaFromObject(flat);
  if (fromFlat != null) return fromFlat;

  const d1 =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  const d2 =
    d1?.data != null && typeof d1.data === 'object' && !Array.isArray(d1.data)
      ? /** @type {Record<string, unknown>} */ (d1.data)
      : null;

  for (const layer of [d1, d2]) {
    const t = tryRondaFromObject(layer);
    if (t != null) return t;
  }

  const nestedResults = [r.results, d1?.results, d2?.results, flat.results].filter(Boolean);
  for (const nr of nestedResults) {
    if (nr != null && typeof nr === 'object' && !Array.isArray(nr)) {
      const t = tryRondaFromObject(nr);
      if (t != null) return t;
      const mi = /** @type {Record<string, unknown>} */ (nr).mesa_info;
      const t2 = tryRondaFromObject(mi);
      if (t2 != null) return t2;
    }
  }

  const mesaInfos = [r.mesa_info, d1?.mesa_info, d2?.mesa_info, flat.mesa_info];
  for (const mi of mesaInfos) {
    const t = tryRondaFromObject(mi);
    if (t != null) return t;
  }

  return null;
}

/**
 * @param {unknown} payload
 * @param {{ current: number | null }} signalRoundRef
 * @param {{ current: string | null }} signalProviderIdRef
 * @param {{ current: string }} signalMesaRef
 * @returns {boolean}
 */
function shouldIngestNewResultByRound(payload, signalRoundRef, signalProviderIdRef, signalMesaRef) {
  const expected = signalRoundRef.current;
  const actual = pickRondaActualFromNewResultPayload(payload);
  let norm;
  try {
    norm = normalizeNewResultPayload(payload);
  } catch {
    norm = null;
  }
  const sigId = signalProviderIdRef.current;
  const resId = norm?.providerSignalId ?? null;
  const normRoundNum =
    norm?.round != null && String(norm.round).trim() !== ''
      ? coalesceRondaNumber(norm.round)
      : null;
  const sigMesa = String(signalMesaRef.current ?? '').trim();
  const resMesa = String(norm?.mesa ?? '').trim();
  const mesaAligned = !sigMesa || !resMesa || sigMesa === resMesa;
  let mesaWindowOk = false;
  if (mesaAligned && expected != null && actual != null) {
    const lo = expected + 1;
    const hi = expected + PROVIDER_MARTINGALE_STEPS;
    mesaWindowOk = actual >= lo && actual <= hi;
  }
  if (sigId && resId && sigId === resId) {
    console.log('✅ RESULT MATCH OK (providerSignalId)');
    return true;
  }
  if (expected != null && normRoundNum != null) {
    if (normRoundNum === expected || normRoundNum === expected + 1) {
      console.log('✅ RESULT MATCH OK (norm.round vs signal round)');
      return true;
    }
  }
  if (mesaWindowOk) {
    console.log('✅ RESULT MATCH OK (mesa + ronda window)');
    return true;
  }
  if (actual == null) {
    console.log('❌ RESULT MISMATCH');
    return false;
  }
  if (expected == null) {
    console.log('❌ RESULT MISMATCH');
    return false;
  }
  if (actual === expected + 1 || actual === expected) {
    console.log('✅ RESULT MATCH OK');
    return true;
  }
  console.log('❌ RESULT MISMATCH');
  return false;
}

/** Mismo paso martingala: evita doble ingesta si NEW_RESULT llega por evento y por `signal_stream_frame`. */
const resultIngestFingerprints = new Set();

function fingerprintNewResultPayload(raw) {
  const n = normalizeNewResultPayload(raw);
  const flat = mergeResultEnvelopeForExtract(raw);
  const { vector_resultado } = extractVectorResultadoAndWinFromResultRaw(flat);
  return `${n.correlationKey}|${String(n.winStatus)}|${vector_resultado.join('\x1e')}`;
}

/**
 * @param {(p: unknown, o?: { ingestSource?: 'socket_NEW_RESULT' | 'signal_stream_frame' }) => void} ingestNewResult
 * @param {unknown} raw
 * @param {{ ingestSource?: 'socket_NEW_RESULT' | 'signal_stream_frame' }} [opts]
 */
function tryIngestNewResultOnce(ingestNewResult, raw, opts) {
  let fp;
  try {
    fp = fingerprintNewResultPayload(raw);
  } catch {
    fp = `fp_err_${Date.now()}_${nextOpaqueId('e')}`;
  }
  if (resultIngestFingerprints.has(fp)) return;
  resultIngestFingerprints.add(fp);
  if (resultIngestFingerprints.size > 500) {
    resultIngestFingerprints.clear();
  }
  ingestNewResult(raw, opts);
}

/**
 * `signal_stream_frame` puede traer `eventName` upstream (p. ej. dashboardUpdate), no solo NEW_RESULT
 * (evidencia NDJSON: eventName dashboardUpdate + layers.raw).
 */
function streamFrameRawLooksLikeNewResult(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return false;
  try {
    const flat = mergeResultEnvelopeForExtract(raw);
    const typeStr = String(
      /** @type {Record<string, unknown>} */ (raw).type ?? flat.type ?? '',
    ).toUpperCase();
    /** Muchos relays marcan explícitamente; sin esto `dashboardUpdate` + cuerpo mínimo no pasa el heurístico. */
    if (typeStr === 'NEW_RESULT' || typeStr.includes('NEW_RESULT')) return true;
    const { vector_resultado, vector_win } = extractVectorResultadoAndWinFromResultRaw(flat);
    if (vector_win.length > 0 || vector_resultado.length > 0) return true;
    const n = normalizeNewResultPayload(raw);
    if (n.winStatus === true || n.winStatus === false) return true;
    if (String(n.correlationKey ?? '').trim() !== '' && (String(n.mesa ?? '').trim() !== '' || String(n.round ?? '').trim() !== '')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Marco `signal_stream_frame`: el backend usa `layers.raw`; algunos clientes ponen el mismo objeto en `payload`.
 * @param {unknown} frame
 * @returns {Record<string, unknown> | null}
 */
function resolveSignalStreamFrameRawObject(frame) {
  const fromLayers = frame?.layers?.raw;
  if (fromLayers != null) {
    if (typeof fromLayers === 'object' && !Array.isArray(fromLayers)) {
      return /** @type {Record<string, unknown>} */ (fromLayers);
    }
    if (typeof fromLayers === 'string') {
      const t = fromLayers.trim();
      if (t.startsWith('{') || t.startsWith('[')) {
        try {
          const parsed = JSON.parse(t);
          const inner = coalesceSocketEventPayload(parsed);
          if (inner != null && typeof inner === 'object' && !Array.isArray(inner)) {
            return /** @type {Record<string, unknown>} */ (inner);
          }
        } catch {
          /* noop */
        }
      }
    }
  }
  const p = frame?.payload;
  if (p != null && typeof p === 'object' && !Array.isArray(p)) {
    return /** @type {Record<string, unknown>} */ (p);
  }
  return null;
}

/**
 * Ingesta resultados desde `signal_stream_frame`: el relay puede usar `eventName` distinto de NEW_RESULT
 * (p. ej. `dashboardUpdate`) con `layers.raw` que sí contiene vectores / winStatus.
 *
 * @param {unknown} frame
 * @param {(p: unknown) => void} ingestNewResult
 * @param {(msg: string) => void} pushEvent
 * @param {{ current: number | null }} signalRoundRef
 * @param {{ current: string | null }} signalProviderIdRef
 * @param {{ current: string }} signalMesaRef
 * @param {(type: string, raw: unknown) => void} logAdminRaw — misma fila que `NEW_RESULT` por socket (`adminRawFeed` para IA Real augment).
 */
function handleSignalStreamFrameForResults(
  frame,
  ingestNewResult,
  pushEvent,
  signalRoundRef,
  signalProviderIdRef,
  signalMesaRef,
  logAdminRaw,
) {
  const raw = resolveSignalStreamFrameRawObject(frame);
  if (raw == null) return;

  const ev = String(frame?.eventName ?? '');
  const evU = ev.toUpperCase();
  if (evU === EVENT_NEW_SIGNAL || evU === 'NEW_SIGNAL') return;

  const nominal = evU === EVENT_NEW_RESULT;
  const heuristic = !nominal && streamFrameRawLooksLikeNewResult(raw);
  if (!nominal && !heuristic) return;

  logCycleStreamFrameResultIfEnabled(frame, raw);
  try {
    if (isGpulseRealityAuditEnabled()) {
      realityAuditSocketCounts.signal_stream_frame_result += 1;
      console.log('📡 RAW SOCKET', raw);
      console.info('[REALITY-AUDIT Fase2] signal_stream_frame (resultado) acum.', realityAuditSocketCounts.signal_stream_frame_result, {
        eventName: frame?.eventName,
      });
    }
    /** Paridad con `onNewResult`: sin esto `adminRawFeed` queda vacío para resultados que solo llegan por `signal_stream_frame` (relay BFF). */
    logAdminRaw(EVENT_NEW_RESULT, raw);
    if (!shouldIngestNewResultByRound(raw, signalRoundRef, signalProviderIdRef, signalMesaRef)) return;
    tryIngestNewResultOnce(ingestNewResult, raw, { ingestSource: 'signal_stream_frame' });
    pipeAfterSocketNewResult(raw);
  } catch (e) {
    pushEvent('parse_error', String(e?.message || e));
  }
}

function logRelayDiagnosticsFromApi() {
  if (String(import.meta.env.VITE_ADMIN_SIGNALS_DEBUG ?? '').trim() !== '1') return;
  const base = (getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  if (!base) return;
  const adminKey = String(import.meta.env.VITE_GENESIS_ADMIN_API_KEY || '').trim();
  /** Misma cabecera que exige `apiSessionAuthMiddleware` para `/api/admin/signals/*` (el socket usa `auth.apiKey`). */
  const headers = adminKey ? { 'x-admin-api-key': adminKey } : undefined;
  fetch(`${base}/api/admin/signals/config`, { credentials: 'include', headers })
    .then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn('[admin-signals] relayDiagnostics fetch failed', r.status, j?.error || j);
        return;
      }
      if (j?.relayDiagnostics) {
        console.warn('[admin-signals] relayDiagnostics (sin secretos)', j.relayDiagnostics);
      }
    })
    .catch((e) => {
      console.warn('[admin-signals] relayDiagnostics fetch error', e?.message || e);
    });
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
  const signalRoundRef = useRef(/** @type {number | null} */ (null));
  const signalProviderIdRef = useRef(/** @type {string | null} */ (null));
  const signalMesaRef = useRef('');

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
        logRelayDiagnosticsFromApi();
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
        logRealityAuditRawSocket(EVENT_NEW_SIGNAL, payload);
        if (isGpulseFullFlowEnabled()) {
          console.log('🔥 FRONT RECEIVED SIGNAL', payload);
          void postFullFlowRow({ pipeline: 'front_socket', type: 'NEW_SIGNAL', payload });
        }
        logAdminRaw(EVENT_NEW_SIGNAL, payload);
        logCycleSocketNewSignalIfEnabled(payload);
        try {
          syncSignalRoundRefFromNewSignalPayload(payload, signalRoundRef, signalProviderIdRef, signalMesaRef);
          ingestNewSignal(payload);
          pipeAfterSocketNewSignal(payload);
        } catch (e) {
          pushEvent('parse_error', String(e?.message || e));
        }
      };

      const onNewResult = (payload) => {
        logRealityAuditRawSocket(EVENT_NEW_RESULT, payload);
        if (isGpulseFullFlowEnabled()) {
          console.log('🔥 FRONT RECEIVED RESULT', payload);
          void postFullFlowRow({ pipeline: 'front_socket', type: 'NEW_RESULT', payload });
        }
        logAdminRaw(EVENT_NEW_RESULT, payload);
        logCycleSocketNewResultIfEnabled(payload);
        try {
          if (!shouldIngestNewResultByRound(payload, signalRoundRef, signalProviderIdRef, signalMesaRef)) return;
          tryIngestNewResultOnce(ingestNewResult, payload);
          pipeAfterSocketNewResult(payload);
        } catch (e) {
          pushEvent('parse_error', String(e?.message || e));
        }
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

      const onSignalStreamFrame = (frame) => {
        handleSignalStreamFrameForResults(
          frame,
          ingestNewResult,
          pushEvent,
          signalRoundRef,
          signalProviderIdRef,
          signalMesaRef,
          logAdminRaw,
        );
      };
      socket.on('signal_stream_frame', onSignalStreamFrame);

      return () => {
        manualCloseRef.current = true;
        socket.off('signal_stream_frame', onSignalStreamFrame);
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

    const adminKey = String(import.meta.env.VITE_GENESIS_ADMIN_API_KEY || '').trim();
    const socket = io(`${base}/admin-signals`, {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      ...(adminKey ? { auth: { apiKey: adminKey } } : {}),
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
      logRelayDiagnosticsFromApi();
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
      logRealityAuditRawSocket(EVENT_NEW_SIGNAL, payload);
      if (isGpulseFullFlowEnabled()) {
        console.log('🔥 FRONT RECEIVED SIGNAL', payload);
        void postFullFlowRow({ pipeline: 'front_socket', type: 'NEW_SIGNAL', payload });
      }
      logAdminRaw(EVENT_NEW_SIGNAL, payload);
      logCycleSocketNewSignalIfEnabled(payload);
      try {
        syncSignalRoundRefFromNewSignalPayload(payload, signalRoundRef, signalProviderIdRef, signalMesaRef);
        ingestNewSignal(payload);
        pipeAfterSocketNewSignal(payload);
      } catch (e) {
        pushEvent('parse_error', String(e?.message || e));
      }
    };

    const onNewResult = (payload) => {
      logRealityAuditRawSocket(EVENT_NEW_RESULT, payload);
      if (isGpulseFullFlowEnabled()) {
        console.log('🔥 FRONT RECEIVED RESULT', payload);
        void postFullFlowRow({ pipeline: 'front_socket', type: 'NEW_RESULT', payload });
      }
      logAdminRaw(EVENT_NEW_RESULT, payload);
      logCycleSocketNewResultIfEnabled(payload);
      try {
        if (!shouldIngestNewResultByRound(payload, signalRoundRef, signalProviderIdRef, signalMesaRef)) return;
        tryIngestNewResultOnce(ingestNewResult, payload);
        pipeAfterSocketNewResult(payload);
      } catch (e) {
        pushEvent('parse_error', String(e?.message || e));
      }
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

    const onSignalStreamFrameBff = (frame) => {
      handleSignalStreamFrameForResults(
        frame,
        ingestNewResult,
        pushEvent,
        signalRoundRef,
        signalProviderIdRef,
        signalMesaRef,
        logAdminRaw,
      );
    };
    socket.on('signal_stream_frame', onSignalStreamFrameBff);

    return () => {
      manualCloseRef.current = true;
      socket.off('signal_stream_frame', onSignalStreamFrameBff);
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
