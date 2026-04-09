import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  disposeSignalMiddleware,
  getActiveLabSignalPayloadForMesa,
  onLabSocketConnect,
  handleResult,
  handleSignal,
} from '../middleware/useSignalMiddleware.js';
import { useMetricsStore } from '../store/useMetricsStore.js';
import { useSocketHealthStore } from '../store/useSocketHealthStore.js';
import { useLabStore } from '../store/useLabStore.js';
import { resolveMesaIdForIntel } from '../store/useLabStore.js';
import { recordStreamResult, recordStreamSignal } from '../store/useValidationStore.js';
import { normalizeCorrelationKey } from '../utils/labCorrelationKey.js';
import { extractMesaKeyFromRaw, extractNestedMesaInfo } from '../utils/supplierIntelExtract.js';
import { gpulseLabLog } from '../utils/gpulseLabLog.js';
import { beginGpulseLabWarmupWindow } from '../utils/gpulseLabWarmup.js';
import { recordOutsideEvent } from '../utils/forensicObservability.js';
import { auditPayloadMapping, detectMismatch } from '../utils/payloadContractAudit.js';
import { deriveRecommendation, vectorForecastForDebug } from '../utils/deriveRecommendation.js';
import { deriveMartingaleFields } from '../utils/martingaleUi.js';

/**
 * Origen Engine — namespace Socket.IO `/admin-signals`.
 * Prioridad: `VITE_GPULSE_LAB_IO_ORIGIN` → `VITE_ADMIN_SIGNALS_IO_ORIGIN` → core-api local (5050).
 */
function resolveLabIoOrigin() {
  const lab = typeof import.meta.env.VITE_GPULSE_LAB_IO_ORIGIN === 'string' ? import.meta.env.VITE_GPULSE_LAB_IO_ORIGIN.trim() : '';
  if (lab !== '') return lab.replace(/\/$/, '');
  const admin = typeof import.meta.env.VITE_ADMIN_SIGNALS_IO_ORIGIN === 'string' ? import.meta.env.VITE_ADMIN_SIGNALS_IO_ORIGIN.trim() : '';
  if (admin !== '') return admin.replace(/\/$/, '');
  return 'http://localhost:5050';
}

const LAB_IO_ORIGIN = resolveLabIoOrigin();

const DISABLE_AUTH = import.meta.env.VITE_ADMIN_SIGNALS_DISABLE_AUTH === '1';

/**
 * @param {string} type
 * @param {unknown} payload
 * @param {{ mesa?: unknown, round?: unknown, correlationKey?: string | null } | null} normalized
 */
function logFlowTrace(type, payload, normalized) {
  const raw = payload != null && typeof payload === 'object' && !Array.isArray(payload) ? /** @type {Record<string, unknown>} */ (payload) : null;
  const mesa = normalized?.mesa ?? raw?.mesa;
  const round = normalized?.round ?? raw?.round;
  const correlationKey = normalized?.correlationKey ?? raw?.correlationKey;
  console.log('FLOW TRACE', { type, mesa, round, correlationKey, ts: Date.now() });
}

function resolveLabCurrentStateUrl() {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/admin/signals/current-state`;
  }
  return `${LAB_IO_ORIGIN}/api/admin/signals/current-state`;
}

/**
 * GET /api/admin/signals/current-state — alinea lab + middleware con señal pendiente o último resultado del relay.
 */
async function fetchAndApplyGpulseLabCurrentState() {
  const url = resolveLabCurrentStateUrl();
  const headers = new Headers();
  const apiKeyRaw = import.meta.env.VITE_GENESIS_ADMIN_API_KEY;
  if (typeof apiKeyRaw === 'string' && apiKeyRaw.trim() !== '') {
    headers.set('x-admin-api-key', apiKeyRaw.trim());
  }
  let res;
  try {
    res = await fetch(url, { credentials: 'include', headers });
  } catch (e) {
    gpulseLabLog.debug('[gpulse-lab] current-state fetch failed', e instanceof Error ? e.message : e);
    return;
  }
  if (!res.ok) {
    gpulseLabLog.debug('[gpulse-lab] current-state HTTP', res.status);
    return;
  }
  const json = await res.json().catch(() => null);
  if (json == null || json.ok !== true) return;

  const { currentSignal, currentResult, mesa } = json;

  if (currentSignal != null && typeof currentSignal === 'object') {
    const normalized = normalizeNewSignalPayload(currentSignal);
    if (normalized) {
      recordStreamSignal(normalized, { syncSource: 'bootstrap' });
      recordOutsideEvent({
        mesaId: normalized.mesa != null ? String(normalized.mesa) : null,
        kind: 'NEW_SIGNAL',
        raw: currentSignal,
        round: normalized.round,
        syncSource: 'bootstrap',
      });
      handleSignal(normalized, currentSignal);
      const id =
        normalized.mesa != null && String(normalized.mesa).trim() !== ''
          ? String(normalized.mesa)
          : resolveMesaIdForIntel(currentSignal);
      if (id) {
        const prev = useLabStore.getState().mesas[id];
        const cycleClosed = !prev || prev.estado === 'RESULT' || prev.estado === 'WAITING';
        useLabStore.getState().mergeSupplierIntelSignal(currentSignal, { mesaId: id, cycleClosed });
      }
      gpulseLabLog.operational('[gpulse-lab] initial state sync: open SIGNAL', {
        mesa: normalized.mesa,
        round: normalized.round,
      });
    }
  } else if (currentResult != null && typeof currentResult === 'object') {
    const normalized = normalizeNewResultPayload(currentResult);
    if (normalized) {
      const id =
        normalized.mesa != null && String(normalized.mesa).trim() !== ''
          ? String(normalized.mesa)
          : resolveMesaIdForIntel(currentResult);
      // Ensure stream timers do not fire for a state-synced completed result.
      recordStreamResult(normalized, { ...currentResult, _syncSource: 'bootstrap' }, { syncSource: 'bootstrap' });
      recordOutsideEvent({
        mesaId: normalized.mesa != null ? String(normalized.mesa) : null,
        kind: 'NEW_RESULT',
        raw: currentResult,
        round: normalized.round,
        syncSource: 'bootstrap',
      });
      useLabStore.getState().setResult(normalized);
      if (id) {
        useLabStore.getState().mergeSupplierIntelResult(currentResult, { mesaId: id });
      }
      gpulseLabLog.operational('[gpulse-lab] initial state sync: last RESULT', {
        mesa: normalized.mesa,
        round: normalized.round,
      });
    }
  }

  if (mesa != null && String(mesa).trim() !== '') {
    useLabStore.getState().setSelectedMesaId(String(mesa));
  }
}

/** Evita desconectar en el primer cleanup de React Strict Mode (remount rápido). */
const STRICT_MODE_DISCONNECT_DELAY_MS = 400;

/** NEW_SIGNAL → argumento de useLabStore.setSignal */
export function normalizeNewSignalPayload(payload) {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const p = /** @type {Record<string, unknown>} */ (payload);
  if (p.mesa == null || p.mesa === '') return null;
  if (p.round === null || p.round === undefined || p.round === '') return null;

  const recommendation = deriveRecommendation(p);
  console.log('RECOMMENDATION SOURCE', {
    rawRecommendation: p.recommendation,
    derived: recommendation,
    vector: vectorForecastForDebug(p),
  });

  const mesaStr = String(p.mesa);
  const roundStr = String(p.round);
  const correlationKey = normalizeCorrelationKey(
    p.correlationKey != null && String(p.correlationKey).trim() !== '' ? String(p.correlationKey).trim() : null,
    mesaStr,
    roundStr,
  );
  const timestamp =
    typeof p.timestamp === 'number' && Number.isFinite(p.timestamp)
      ? p.timestamp
      : typeof p.ts === 'number' && Number.isFinite(p.ts)
        ? p.ts
        : Date.now();

  const { martingale, martingaleType } = deriveMartingaleFields(p);

  return {
    mesa: p.mesa,
    round: roundStr,
    recommendation,
    martingale,
    martingaleType,
    correlationKey,
    timestamp,
  };
}

/**
 * Prioridad: payload.round → mesa_info.ronda_actual → data.data.results.mesa_info.ronda_actual
 * @param {Record<string, unknown>} p
 * @returns {string | null}
 */
function pickResultRoundFromPayload(p) {
  if (p.round != null && String(p.round).trim() !== '') return String(p.round).trim();

  const mesaInfoTop = p.mesa_info;
  if (mesaInfoTop != null && typeof mesaInfoTop === 'object' && !Array.isArray(mesaInfoTop)) {
    const ra = /** @type {Record<string, unknown>} */ (mesaInfoTop).ronda_actual;
    if (ra != null && String(ra).trim() !== '') return String(ra).trim();
  }

  const d = p.data;
  if (d != null && typeof d === 'object' && !Array.isArray(d)) {
    const d2 = /** @type {Record<string, unknown>} */ (d).data;
    if (d2 != null && typeof d2 === 'object' && !Array.isArray(d2)) {
      const results = /** @type {Record<string, unknown>} */ (d2).results;
      if (results != null && typeof results === 'object' && !Array.isArray(results)) {
        const nestedMi = /** @type {Record<string, unknown>} */ (results).mesa_info;
        if (nestedMi != null && typeof nestedMi === 'object' && !Array.isArray(nestedMi)) {
          const ra2 = nestedMi.ronda_actual;
          if (ra2 != null && String(ra2).trim() !== '') return String(ra2).trim();
        }
      }
    }
  }

  const resultsTop = p.results;
  if (resultsTop != null && typeof resultsTop === 'object' && !Array.isArray(resultsTop)) {
    const rmi = /** @type {Record<string, unknown>} */ (resultsTop).mesa_info;
    if (rmi != null && typeof rmi === 'object' && !Array.isArray(rmi)) {
      const ra3 = rmi.ronda_actual;
      if (ra3 != null && String(ra3).trim() !== '') return String(ra3).trim();
    }
  }

  return null;
}

/**
 * NEW_RESULT → shape esperado por useLabStore.setResult.
 * Sin ronda en payload: `round` undefined; correlationKey solo si viene explícita o hay mesa+ronda; el middleware completa.
 * @param {unknown} payload
 */
export function normalizeNewResultPayload(payload) {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const p = /** @type {Record<string, unknown>} */ (payload);
  const mesaInfo = p.mesa_info;
  const mi = mesaInfo != null && typeof mesaInfo === 'object' && !Array.isArray(mesaInfo) ? mesaInfo : null;
  const miNested = extractNestedMesaInfo(p) ?? mi;
  const mart =
    miNested?.martingala != null && typeof miNested.martingala === 'object' && !Array.isArray(miNested.martingala)
      ? /** @type {Record<string, unknown>} */ (miNested.martingala)
      : mi?.martingala != null && typeof mi.martingala === 'object' && !Array.isArray(mi.martingala)
        ? /** @type {Record<string, unknown>} */ (mi.martingala)
        : null;

  const vr = mart?.vector_resultado;
  const vw = mart?.vector_win;
  const vector_resultado = Array.isArray(vr) ? vr : [];
  const vector_win = Array.isArray(vw) ? vw : [];
  const cm = mart?.contador_martingala;
  const contador_martingala = typeof cm === 'number' ? cm : Number(cm) || 0;

  let mesa = p.mesa != null && String(p.mesa).trim() !== '' ? p.mesa : null;
  if (mesa == null || mesa === '') {
    const k = extractMesaKeyFromRaw(p);
    mesa = k !== '' ? k : null;
  }

  const fromPayload = pickResultRoundFromPayload(p);
  const roundFromMi =
    miNested?.ronda_actual != null && String(miNested.ronda_actual).trim() !== ''
      ? String(miNested.ronda_actual).trim()
      : null;
  const roundStr =
    fromPayload != null && fromPayload !== ''
      ? fromPayload
      : roundFromMi != null && roundFromMi !== ''
        ? roundFromMi
        : '';
  const roundDefined = roundStr !== '';

  if (!roundDefined) {
    console.warn('[gpulse-lab] result missing round, attempting fallback');
  }

  const ganadorRaw =
    p.ganador ??
    (miNested && (miNested.ganador ?? miNested.resultado ?? miNested.winner)) ??
    (mi && (mi.ganador ?? mi.resultado ?? mi.winner)) ??
    null;

  const explicitCk =
    p.correlationKey != null && String(p.correlationKey).trim() !== ''
      ? String(p.correlationKey).trim()
      : null;
  const correlationKey = normalizeCorrelationKey(explicitCk, mesa, roundDefined ? roundStr : null);

  if (mesa == null || mesa === '') return null;

  return {
    ganador: ganadorRaw != null ? ganadorRaw : null,
    mesa,
    round: roundDefined ? roundStr : undefined,
    correlationKey,
    vector_resultado,
    vector_win,
    contador_martingala,
  };
}

export function useLabSocket() {
  const socketRef = useRef(/** @type {import('socket.io-client').Socket | null} */ (null));
  const disconnectTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  useEffect(() => {
    if (disconnectTimerRef.current != null) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    const apiKeyRaw = import.meta.env.VITE_GENESIS_ADMIN_API_KEY;
    const auth =
      DISABLE_AUTH || typeof apiKeyRaw !== 'string' || apiKeyRaw.trim() === ''
        ? undefined
        : { apiKey: apiKeyRaw.trim() };

    const namespaceUrl = `${LAB_IO_ORIGIN}/admin-signals`;

    /** @type {import('socket.io-client').Socket} */
    let socket = socketRef.current;

    if (socket == null) {
      gpulseLabLog.operational('[gpulse-lab] connecting to namespace:', `${LAB_IO_ORIGIN}/admin-signals`);

      socket = io(`${LAB_IO_ORIGIN}/admin-signals`, {
        path: '/socket.io',
        transports: ['websocket'],
        withCredentials: false,
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        randomizationFactor: 0.5,
        ...(auth ? { auth } : {}),
      });

      socketRef.current = socket;
    }

    const manager = socket.io;

    const onConnect = () => {
      beginGpulseLabWarmupWindow(3000);
      onLabSocketConnect();
      useSocketHealthStore.getState().setConnected();
      gpulseLabLog.operational('[gpulse-lab] socket connection success', {
        id: socket.id,
        url: namespaceUrl,
        path: '/socket.io',
      });
      void fetchAndApplyGpulseLabCurrentState();
    };

    const onConnectError = (err) => {
      useSocketHealthStore.getState().setDisconnected(err?.message ?? 'connect_error');
      gpulseLabLog.error('socket connection error', err?.message ?? err);
    };

    const onDisconnect = (reason) => {
      useSocketHealthStore.getState().setDisconnected(reason);
      gpulseLabLog.debug('socket disconnected', reason);
    };

    const onReconnectAttempt = (attempt) => {
      useSocketHealthStore.getState().setReconnecting(attempt);
      gpulseLabLog.operational('[gpulse-lab] reconnect attempt', attempt);
    };

    const onReconnect = (attempt) => {
      useSocketHealthStore.getState().setConnected();
      gpulseLabLog.operational('[gpulse-lab] reconnected after attempts', attempt);
    };

    const onReconnectFailed = () => {
      useSocketHealthStore.getState().setReconnectFailed();
      gpulseLabLog.error('socket reconnection failed (max attempts)');
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);

    manager.on('reconnect_attempt', onReconnectAttempt);
    manager.on('reconnect', onReconnect);
    manager.on('reconnect_failed', onReconnectFailed);

    if (socket.connected) {
      beginGpulseLabWarmupWindow(3000);
      onLabSocketConnect();
      useSocketHealthStore.getState().setConnected();
      gpulseLabLog.operational('[gpulse-lab] socket already connected (reuse)', {
        id: socket.id,
        url: namespaceUrl,
      });
      void fetchAndApplyGpulseLabCurrentState();
    }

    const onNewSignal = (payload) => {
      console.log('RAW PROVIDER SIGNAL:', JSON.stringify(payload, null, 2));
      gpulseLabLog.debug('📡 SIGNAL', payload);
      const normalized = normalizeNewSignalPayload(payload);
      const id =
        normalized?.mesa != null && String(normalized.mesa).trim() !== ''
          ? String(normalized.mesa)
          : resolveMesaIdForIntel(payload);
      if (!normalized) return;
      console.log('NORMALIZED SIGNAL:', normalized);
      const auditSignal = auditPayloadMapping(payload, normalized);
      console.log('PAYLOAD AUDIT:', auditSignal);
      const mismatchesSignal = detectMismatch(auditSignal);
      if (mismatchesSignal.length > 0) {
        console.warn('SCHEMA MISMATCH:', mismatchesSignal);
      }
      console.log('SCHEMA STATUS', {
        mesa: normalized.mesa,
        round: normalized.round,
        correlationKey: normalized.correlationKey,
        mismatches: mismatchesSignal,
      });
      logFlowTrace('NEW_SIGNAL', payload, normalized);

      recordStreamSignal(normalized);
      recordOutsideEvent({
        mesaId: id,
        kind: 'NEW_SIGNAL',
        raw: payload,
        round: normalized.round,
      });
      useMetricsStore.getState().bumpSignal();
      handleSignal(normalized, payload);

      const prev = id ? useLabStore.getState().mesas[id] : undefined;
      const cycleClosed = !prev || prev.estado === 'RESULT' || prev.estado === 'WAITING';

      if (id) {
        useLabStore.getState().mergeSupplierIntelSignal(payload, { mesaId: id, cycleClosed });
      }

    };

    const onNewResult = (payload) => {
      console.log('RAW PROVIDER RESULT:', JSON.stringify(payload, null, 2));
      gpulseLabLog.debug('📡 RESULT', payload);
      let normalized = normalizeNewResultPayload(payload);
      if (!normalized && payload != null && typeof payload === 'object' && !Array.isArray(payload)) {
        const fid = resolveMesaIdForIntel(payload);
        if (fid) {
          normalized = normalizeNewResultPayload({ ...payload, mesa: fid });
        }
      }
      let id =
        normalized?.mesa != null && String(normalized.mesa).trim() !== ''
          ? String(normalized.mesa)
          : resolveMesaIdForIntel(payload);
      if (normalized && (normalized.mesa == null || String(normalized.mesa).trim() === '') && id) {
        normalized = { ...normalized, mesa: id };
      }
      if (
        normalized &&
        id &&
        (normalized.correlationKey == null || String(normalized.correlationKey).trim() === '') &&
        normalized.round != null &&
        String(normalized.round).trim() !== ''
      ) {
        normalized = {
          ...normalized,
          correlationKey: normalizeCorrelationKey(null, id, String(normalized.round)),
        };
      }

      if (normalized) {
        console.log('NORMALIZED RESULT:', normalized);
        const auditResult = auditPayloadMapping(payload, normalized);
        console.log('PAYLOAD AUDIT:', auditResult);
        const mismatchesResult = detectMismatch(auditResult);
        if (mismatchesResult.length > 0) {
          console.warn('SCHEMA MISMATCH:', mismatchesResult);
        }
        console.log('SCHEMA STATUS', {
          mesa: normalized.mesa,
          round: normalized.round,
          correlationKey: normalized.correlationKey,
          mismatches: mismatchesResult,
        });
        logFlowTrace('NEW_RESULT', payload, normalized);
        recordOutsideEvent({
          mesaId: id,
          kind: 'NEW_RESULT',
          raw: payload,
          round: normalized.round,
        });
        gpulseLabLog.info('result received (forwarding to middleware)', {
          mesa: normalized.mesa,
          round: normalized.round,
        });
        // socket is transport only — middleware is the authority (auto-resync, correlation, delays).
        handleResult(normalized);
        recordStreamResult(normalized, payload);
        useMetricsStore.getState().bumpResult();
      }
      if (id) {
        useLabStore.getState().mergeSupplierIntelResult(payload, { mesaId: id });
      }
    };

    socket.on('NEW_SIGNAL', onNewSignal);
    socket.on('NEW_RESULT', onNewResult);

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.off('NEW_SIGNAL', onNewSignal);
      socket.off('NEW_RESULT', onNewResult);

      manager.off('reconnect_attempt', onReconnectAttempt);
      manager.off('reconnect', onReconnect);
      manager.off('reconnect_failed', onReconnectFailed);

      disconnectTimerRef.current = setTimeout(() => {
        disconnectTimerRef.current = null;
        if (socketRef.current === socket) {
          socket.disconnect();
          socketRef.current = null;
          useSocketHealthStore.getState().setDisconnected('client_teardown');
        }
      }, STRICT_MODE_DISCONNECT_DELAY_MS);

      disposeSignalMiddleware();
    };
  }, []);
}
