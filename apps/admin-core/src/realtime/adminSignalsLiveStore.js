import getAdminSignalsSocket from '../services/socket-admin.js';
import { addRawEvent } from '../store/rawEventsStore.js';
import { playLossSound, playNewSignalSound, playWinSound, soundEnabled } from '../utils/adminSignalsSounds.js';
import { createLiveResultEntry, createLiveSignalEntry } from './adminSignalsLiveIngest.js';

/**
 * @typedef {{ type: string, ts: number, reason?: string, payload?: unknown }} AdminDebugLogEntry
 */

const MAX_ITEMS = 50;
const MAX_DEBUG_LOGS = 100;
const TRACE_ON = import.meta.env.VITE_ADMIN_SIGNALS_TRACE === '1';

let signals = /** @type {any[]} */ ([]);
let results = /** @type {any[]} */ ([]);
let connected = false;
let rev = 0;

/** @type {{ raw: unknown, formatted: unknown } | null} */
let debugLastSignal = null;
/** @type {{ raw: unknown, formatted: unknown } | null} */
let debugLastResult = null;
/** @type {(string | AdminDebugLogEntry)[]} */
let debugLogs = [];

/** @param {Omit<AdminDebugLogEntry, 'ts'> & { ts?: number }} entry */
function pushStructuredDebug(entry) {
  /** @type {AdminDebugLogEntry} */
  const row = { ts: Date.now(), ...entry };
  debugLogs = [row, ...debugLogs].slice(0, MAX_DEBUG_LOGS);
}

/** @type {any} */
let snapCache = null;
let snapRev = -1;

/** @type {Set<() => void>} */
const listeners = new Set();

/** Compartido entre todos los consumidores (mismo criterio que formatResult). */
export const adminSignalsPredictionByMesa = /** @type {Map<string, string>} */ (new Map());

function nextRecvId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function bump() {
  rev += 1;
  snapCache = null;
  snapRev = -1;
  listeners.forEach((l) => l());
}

export function adminSignalsPushDebugLog(message) {
  ensureAdminSignalsBridge();
  pushStructuredDebug({ type: 'TEXT', payload: message });
  bump();
}

/** @returns {{ signals: any[], results: any[], connected: boolean, rev: number, debugLastSignal: typeof debugLastSignal, debugLastResult: typeof debugLastResult, debugLogs: (string | AdminDebugLogEntry)[] }} */
export function getAdminSignalsLiveSnapshot() {
  ensureAdminSignalsBridge();
  if (snapRev !== rev) {
    snapRev = rev;
    snapCache = {
      signals,
      results,
      connected,
      rev,
      debugLastSignal,
      debugLastResult,
      debugLogs: debugLogs.slice(),
    };
  }
  return snapCache;
}

export function subscribeAdminSignalsLive(cb) {
  ensureAdminSignalsBridge();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getAdminSignalsLiveServerSnapshot() {
  return {
    signals: [],
    results: [],
    connected: false,
    rev: 0,
    debugLastSignal: null,
    debugLastResult: null,
    debugLogs: [],
  };
}

let bridgeAttached = false;

function ensureAdminSignalsBridge() {
  if (bridgeAttached) return;
  bridgeAttached = true;

  console.log('🟢 SOCKET STORE ACTIVO — bridge /admin-signals');

  const socket = getAdminSignalsSocket();
  if (!socket.connected) {
    socket.connect();
  }

  const onConnect = () => {
    connected = socket.connected;
    bump();
  };
  const onDisconnect = () => {
    connected = false;
    bump();
  };
  const onConnectError = (err) => {
    connected = false;
    const msg = err && typeof err === 'object' && 'message' in err ? String(/** @type {{ message?: string }} */ (err).message) : String(err ?? '');
    debugLogs = [`[${new Date().toISOString()}] error: ${msg || 'connect_error'}`, ...debugLogs].slice(0, MAX_DEBUG_LOGS);
    bump();
  };

  const onSignal = (data) => {
    const msg = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : {};
    // SAFE PARSE: soporta wrappers tipo { payload } o { data }.
    const payload =
      msg && typeof msg === 'object' && 'payload' in msg && msg.payload && typeof msg.payload === 'object'
        ? /** @type {Record<string, unknown>} */ (msg.payload)
        : msg && typeof msg === 'object' && 'data' in msg && msg.data && typeof msg.data === 'object'
          ? /** @type {Record<string, unknown>} */ (msg.data)
          : msg;
    const row = payload && typeof payload === 'object' ? /** @type {Record<string, unknown>} */ (payload) : {};
    const { formatted, strictOk, rejectReason } = createLiveSignalEntry(row, nextRecvId());
    if (!strictOk) {
      console.warn('SIGNAL INVALIDA', rejectReason ?? 'UNKNOWN', row);
      pushStructuredDebug({
        type: 'REJECT_SIGNAL',
        reason: rejectReason ?? 'UNKNOWN',
        payload: {
          mesa: formatted.mesa,
          round: formatted.round,
          recvId: formatted.recvId,
          correlationKey: formatted.correlationKey,
        },
      });
      bump();
      return;
    }
    adminSignalsPredictionByMesa.set(String(formatted.mesa), formatted.predictionLabel);
    signals = [formatted, ...signals].slice(0, MAX_ITEMS);
    debugLastSignal = { raw: row, formatted };
    debugLogs = [`NEW_SIGNAL mesa=${formatted.mesa} ${formatted.predictionLabel}`, ...debugLogs].slice(0, MAX_DEBUG_LOGS);
    if (soundEnabled) playNewSignalSound();
    bump();
  };

  /** NEW_RESULT: mismo criterio que `resultsBuffer.unshift(formatResult(payload))` (más reciente primero). */
  const onResult = (data) => {
    const msg = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : {};
    // SAFE PARSE: soporta wrappers tipo { payload } o { data }.
    const payload =
      msg && typeof msg === 'object' && 'payload' in msg && msg.payload && typeof msg.payload === 'object'
        ? /** @type {Record<string, unknown>} */ (msg.payload)
        : msg && typeof msg === 'object' && 'data' in msg && msg.data && typeof msg.data === 'object'
          ? /** @type {Record<string, unknown>} */ (msg.data)
          : msg;
    const row = payload && typeof payload === 'object' ? /** @type {Record<string, unknown>} */ (payload) : {};
    const mesaKey = String(row.mesa ?? 'N/A');
    const predicted = adminSignalsPredictionByMesa.get(mesaKey) ?? null;
    const { formatted, strictOk, rejectReason } = createLiveResultEntry(row, predicted, nextRecvId());
    if (TRACE_ON) {
      console.log('TRACE: PARSED PAYLOAD', row);
      console.log('TRACE: VALIDATION RESULT', { ok: strictOk, reason: rejectReason ?? null });
    }
    if (!strictOk) {
      console.warn('REJECT_RESULT', { reason: rejectReason ?? 'UNKNOWN', formatted, raw: row });
      pushStructuredDebug({
        type: 'REJECT_RESULT',
        reason: rejectReason ?? 'UNKNOWN',
        payload: {
          mesa: formatted.mesa,
          round: formatted.round,
          recvId: formatted.recvId,
          correlationKey: formatted.correlationKey,
          signalId: formatted.signalId,
        },
      });
      bump();
      return;
    }
    results = [formatted, ...results].slice(0, MAX_ITEMS);
    debugLastResult = { raw: row, formatted };
    debugLogs = [`NEW_RESULT mesa=${mesaKey} verdict=${formatted.verdict} vs=${formatted.versus}`, ...debugLogs].slice(0, MAX_DEBUG_LOGS);
    if (soundEnabled) {
      if (formatted.verdict === 'WIN') playWinSound();
      else if (formatted.verdict === 'LOSS') playLossSound();
    }
    bump();
  };

  socket.on('connect', onConnect);
  socket.on('disconnect', onDisconnect);
  socket.on('connect_error', onConnectError);
  socket.on('NEW_SIGNAL', onSignal);
  socket.on('NEW_RESULT', onResult);
  socket.on('admin_signal_frame', (msg) => {
    try {
      console.log('SIGNAL FRAME:', msg);
      const payload = msg?.payload ?? null;
      if (!payload) return;
      const t = msg?.type != null ? String(msg.type) : '';
      if (t === 'NEW_SIGNAL') onSignal(payload);
      if (t === 'NEW_RESULT') onResult(payload);
    } catch (err) {
      console.warn('admin_signal_frame handler error', err);
    }
  });
  socket.on('dashboardUpdate', (msg) => {
    try {
      const raw = msg && typeof msg === 'object' ? /** @type {Record<string, unknown>} */ (msg) : null;
      const type = raw && 'type' in raw ? String(/** @type {any} */ (raw).type) : 'dashboardUpdate';
      const payload = raw?.payload ?? raw?.data ?? null;

      console.log('RAW EVENT:', raw);
      console.log('PARSED PAYLOAD:', payload);

      if (!payload) {
        console.warn('EMPTY PAYLOAD — skipping', raw);
        pushStructuredDebug({ type: 'DASHBOARD_UPDATE', reason: 'EMPTY_PAYLOAD', payload: raw });
        bump();
        return;
      }

      if (type === 'NEW_RESULT') {
        // Soportar forma proveedor: { type:'NEW_RESULT', data:{ mesa, data:{ results:{ mesa_info }}}}
        if (
          payload &&
          typeof payload === 'object' &&
          !Array.isArray(payload) &&
          'data' in payload &&
          payload.data &&
          typeof payload.data === 'object' &&
          !Array.isArray(payload.data) &&
          'results' in /** @type {any} */ (payload.data)
        ) {
          const p = /** @type {any} */ (payload);
          const mesa = p?.mesa ?? p?.data?.mesa ?? null;
          const mi = p?.data?.results?.mesa_info ?? null;
          const round = mi?.ronda_objetivo ?? mi?.ronda_actual ?? p?.ronda ?? p?.round ?? null;
          const scoreDetail = mi
            ? {
                puntaje_player: mi.puntaje_player,
                puntaje_banker: mi.puntaje_banker,
                cartas_player: mi.cartas_player,
                cartas_banker: mi.cartas_banker,
                ganador: mi.ganador,
                tablero: mi.tablero,
              }
            : undefined;
          onResult({ mesa, round, winStatus: raw?.winStatus, scoreDetail, ganador: mi?.ganador });
        } else {
          onResult(payload);
        }
        return;
      }
      if (type === 'NEW_SIGNAL') {
        // Soportar forma proveedor: { type:'NEW_SIGNAL', data:{ mesa, data:{ signal:{...}}}}
        if (
          payload &&
          typeof payload === 'object' &&
          !Array.isArray(payload) &&
          'data' in payload &&
          payload.data &&
          typeof payload.data === 'object' &&
          !Array.isArray(payload.data) &&
          'signal' in /** @type {any} */ (payload.data)
        ) {
          const p = /** @type {any} */ (payload);
          const mesa = p?.mesa ?? p?.data?.signal?.nombre_mesa ?? null;
          const sig = p?.data?.signal ?? null;
          onSignal({
            mesa,
            round: sig?.ronda_actual ?? p?.ronda ?? p?.round ?? null,
            vector_forecast: sig?.vector_forecast,
            nombre_algoritmo: sig?.nombre_algoritmo,
            recommendation: sig?.forecast ?? sig?.recommendation ?? null,
          });
        } else {
          onSignal(payload);
        }
        return;
      }

      console.log('SOCKET EVENT:', type);
      pushStructuredDebug({ type: 'DASHBOARD_UPDATE', payload: raw });
      bump();
    } catch (err) {
      console.warn('dashboardUpdate handler error', err);
    }
  });

  socket.onAny((event, ...args) => {
    const payload = args.length <= 1 ? args[0] : args;
    addRawEvent(event, payload);

    if (TRACE_ON) {
      console.log('TRACE: FRONT RECEIVED', event);
    }

    if (import.meta.env.VITE_ADMIN_SIGNALS_DEBUG !== '1') return;
    if (event === 'NEW_SIGNAL' || event === 'NEW_RESULT') return;
    const snap = payload;
    const short = (() => {
      try {
        return JSON.stringify(snap).slice(0, 160);
      } catch {
        return String(snap);
      }
    })();
    debugLogs = [`[REALTIME] ${event} ${short}`, ...debugLogs].slice(0, MAX_DEBUG_LOGS);
    bump();
  });

  if (socket.connected) {
    connected = true;
    bump();
  }
}
