import getAdminSignalsSocket from '../services/socket-admin.js';
import { logPhaseActiveOnce } from '@/utils/canonicalFlowFlags.js';
import { applyCanonicalModeToPayload } from '@/utils/extractCanonicalFields.js';
import { addRawEvent } from '../store/rawEventsStore.js';
import { playLossSound, playNewSignalSound, playWinSound, soundEnabled } from '../utils/adminSignalsSounds.js';
import { unwrapLiveFrameMessage } from './adminSignalFrameUnwrap.js';
import { normalizeCorrelationKeyInRecord } from './correlationKeyNormalize.js';
import { createLiveResultEntry, createLiveSignalEntry } from './adminSignalsLiveIngest.js';
import { recordCorrelationKeyObservation } from './correlationKeyStats.js';
import { mergeMesaInfoFromNestedIntoRow } from '@/utils/vistaLabProviderExtras.js';

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

/**
 * Rellena `vector_forecast`, `nombre_algoritmo`, `round`/`ronda` desde `data.data.signal` | `data.signal` | `signal`.
 * El proveedor real envía la señal ahí aunque el envelope tenga otra forma.
 * @param {Record<string, unknown>} row
 */
function harvestSignalFieldsFromNestedData(row) {
  const d = row.data != null && typeof row.data === 'object' && !Array.isArray(row.data) ? /** @type {Record<string, unknown>} */ (row.data) : null;
  const dInner =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;
  const sigDeep =
    dInner?.signal != null && typeof dInner.signal === 'object' && !Array.isArray(dInner.signal)
      ? /** @type {Record<string, unknown>} */ (dInner.signal)
      : null;
  const sigShallow =
    d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
      ? /** @type {Record<string, unknown>} */ (d.signal)
      : null;
  const sigRoot =
    row.signal != null && typeof row.signal === 'object' && !Array.isArray(row.signal)
      ? /** @type {Record<string, unknown>} */ (row.signal)
      : null;
  const sig = sigDeep ?? sigShallow ?? sigRoot;
  if (!sig) return;

  const vf = row.vector_forecast;
  const vfMissing = !Array.isArray(vf) || vf.length === 0;
  if (vfMissing && Array.isArray(sig.vector_forecast) && sig.vector_forecast.length > 0) {
    row.vector_forecast = sig.vector_forecast;
  }
  if (
    (row.nombre_algoritmo == null || String(row.nombre_algoritmo).trim() === '') &&
    sig.nombre_algoritmo != null &&
    String(sig.nombre_algoritmo).trim() !== ''
  ) {
    row.nombre_algoritmo = sig.nombre_algoritmo;
  }
  const hasRound =
    row.round != null ||
    row.ronda != null ||
    row.ronda_actual != null ||
    row.roundId != null ||
    row.Ronda != null;
  if (!hasRound) {
    const r =
      sig.ronda_actual ??
      sig.ronda_objetivo ??
      sig.Ronda ??
      sig.ronda ??
      sig.gameRound ??
      sig.round ??
      dInner?.ronda ??
      d?.ronda ??
      null;
    if (r != null && String(r).trim() !== '') {
      row.round = typeof r === 'number' ? r : Number(r) || r;
    }
  }
}

/**
 * Desanidar `payload` / `data` sin tirar mesa, round ni correlationKey del envelope (muy habitual en relay).
 * @param {unknown} msg
 * @param {number} [depth]
 */
function extractLiveRowFromSocketMsg(msg, depth = 0) {
  if (depth > 4 || !msg || typeof msg !== 'object' || Array.isArray(msg)) return {};
  const m = /** @type {Record<string, unknown>} */ (msg);

  const fromPayload =
    'payload' in m && m.payload != null && typeof m.payload === 'object' && !Array.isArray(m.payload)
      ? /** @type {Record<string, unknown>} */ (m.payload)
      : null;
  const fromData =
    'data' in m && m.data != null && typeof m.data === 'object' && !Array.isArray(m.data)
      ? /** @type {Record<string, unknown>} */ (m.data)
      : null;

  const base = fromPayload ?? fromData;

  const hoistKeys = [
    'mesa',
    'round',
    'roundId',
    'ronda',
    'ronda_actual',
    'ronda_objetivo',
    'Ronda',
    'correlationKey',
    'id',
    'signalId',
    'serverTs',
    'recommendation',
    'winStatus',
    'martingale',
    'nombre_algoritmo',
    'vector_forecast',
    'scoreDetail',
    'ganador',
    'historial',
    'history',
  ];
  const hoist = {};
  for (const k of hoistKeys) {
    if (!(k in m)) continue;
    const v = m[k];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    hoist[k] = v;
  }

  /** @param {Record<string, unknown>} row */
  function rowMissingRoundLike(row) {
    const has =
      row.round != null ||
      row.roundId != null ||
      row.ronda != null ||
      row.ronda_actual != null ||
      row.ronda_objetivo != null ||
      row.Ronda != null ||
      (row.correlationKey != null &&
        String(row.correlationKey).includes('|') &&
        !String(row.correlationKey).toLowerCase().trim().startsWith('id:'));
    return !has;
  }

  if (base) {
    /** @type {Record<string, unknown>} */
    let row = { ...base, ...hoist };
    const innerData = base.data;
    if (innerData != null && typeof innerData === 'object' && !Array.isArray(innerData) && rowMissingRoundLike(row)) {
      const filled = extractLiveRowFromSocketMsg(innerData, depth + 1);
      for (const [k, v] of Object.entries(filled)) {
        if (k === 'data') continue;
        if (v === undefined || v === null) continue;
        if (typeof v === 'string' && v.trim() === '') continue;
        const cur = row[k];
        const curEmpty = cur === undefined || cur === null || (typeof cur === 'string' && cur.trim() === '');
        if (curEmpty) row[k] = v;
      }
    }
    /** Winxplay / proveedor: `data.data.signal` o `data.signal` — asegurar `vector_forecast` y ronda si solo venían anidados. */
    harvestSignalFieldsFromNestedData(row);
    mergeMesaInfoFromNestedIntoRow(row);
    normalizeCorrelationKeyInRecord(row);
    return row;
  }
  const flat = { ...m };
  harvestSignalFieldsFromNestedData(flat);
  mergeMesaInfoFromNestedIntoRow(flat);
  normalizeCorrelationKeyInRecord(flat);
  return flat;
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

  /**
   * @param {unknown} data
   * @param {string} [source] — trazabilidad id vs mesa|round (ver correlationKeyStats)
   */
  const onSignal = (data, source = 'socket:NEW_SIGNAL') => {
    logPhaseActiveOnce();
    const msg = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : {};
    const row0 = extractLiveRowFromSocketMsg(msg);
    const { payload: row } = applyCanonicalModeToPayload(row0);
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
    recordCorrelationKeyObservation('signal', formatted, { source });
    adminSignalsPredictionByMesa.set(String(formatted.mesa), formatted.predictionLabel);
    signals = [formatted, ...signals].slice(0, MAX_ITEMS);
    debugLastSignal = { raw: row, formatted };
    debugLogs = [`NEW_SIGNAL mesa=${formatted.mesa} ${formatted.predictionLabel}`, ...debugLogs].slice(0, MAX_DEBUG_LOGS);
    if (soundEnabled) playNewSignalSound();
    bump();
  };

  /** NEW_RESULT: mismo criterio que `resultsBuffer.unshift(formatResult(payload))` (más reciente primero). */
  /**
   * @param {unknown} data
   * @param {string} [source]
   */
  const onResult = (data, source = 'socket:NEW_RESULT') => {
    logPhaseActiveOnce();
    const msg = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : {};
    const row0 = extractLiveRowFromSocketMsg(msg);
    const { payload: row } = applyCanonicalModeToPayload(row0);
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
    recordCorrelationKeyObservation('result', formatted, { source });
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
  socket.on('NEW_SIGNAL', (d) => onSignal(d, 'socket:NEW_SIGNAL'));
  socket.on('NEW_RESULT', (d) => onResult(d, 'socket:NEW_RESULT'));
  socket.on('admin_signal_frame', (msg) => {
    try {
      console.log('SIGNAL FRAME:', msg);
      const { eventType, row } = unwrapLiveFrameMessage(msg);
      if (!row || Object.keys(row).length === 0) return;
      const et = eventType.toUpperCase();
      if (et === 'NEW_SIGNAL') onSignal(row, 'socket:admin_signal_frame');
      if (et === 'NEW_RESULT') onResult(row, 'socket:admin_signal_frame');
    } catch (err) {
      console.warn('admin_signal_frame handler error', err);
    }
  });
  socket.on('dashboardUpdate', (msg) => {
    try {
      const raw = msg && typeof msg === 'object' ? /** @type {Record<string, unknown>} */ (msg) : null;
      const payload = raw?.payload ?? raw?.data ?? null;
      const fromEnvelope = raw != null ? String(raw.type ?? raw.eventName ?? '').trim() : '';
      const fromPayload =
        payload != null && typeof payload === 'object' && !Array.isArray(payload)
          ? String(/** @type {Record<string, unknown>} */ (payload).type ?? /** @type {Record<string, unknown>} */ (payload).eventName ?? '').trim()
          : '';
      const eventType = (fromEnvelope || fromPayload || '').toUpperCase();
      const displayType =
        raw && 'type' in raw && raw.type != null
          ? String(raw.type)
          : raw && 'eventName' in raw && raw.eventName != null
            ? String(raw.eventName)
            : 'dashboardUpdate';

      console.log('RAW EVENT:', raw);
      console.log('PARSED PAYLOAD:', payload);

      if (!payload) {
        console.warn('EMPTY PAYLOAD — skipping', raw);
        pushStructuredDebug({ type: 'DASHBOARD_UPDATE', reason: 'EMPTY_PAYLOAD', payload: raw });
        bump();
        return;
      }

      if (eventType === 'NEW_RESULT') {
        // Soportar forma proveedor: data.results o data.data.results (mesa_info + ronda_objetivo)
        const pAny = /** @type {any} */ (payload);
        const hasResultsShallow =
          pAny?.data &&
          typeof pAny.data === 'object' &&
          pAny.data.results &&
          typeof pAny.data.results === 'object';
        const hasResultsDeep =
          pAny?.data?.data &&
          typeof pAny.data.data === 'object' &&
          pAny.data.data.results &&
          typeof pAny.data.data.results === 'object';
        if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload && (hasResultsShallow || hasResultsDeep)) {
          const p = /** @type {any} */ (payload);
          const mesa = p?.mesa ?? p?.data?.mesa ?? null;
          const mi =
            p?.data?.data?.results?.mesa_info ??
            p?.data?.results?.mesa_info ??
            null;
          const de = mi?.data_evento ?? mi?.data_event;
          const round =
            mi?.ronda_objetivo ??
            de?.Ronda ??
            de?.ronda ??
            de?.round ??
            mi?.ronda_actual ??
            p?.ronda ??
            p?.round ??
            null;
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
          const ckWire =
            p?.correlationKey ??
            (p.data && typeof p.data === 'object' && !Array.isArray(p.data) ? p.data.correlationKey : undefined) ??
            raw?.correlationKey;
          const martingalaData =
            p?.data && typeof p.data === 'object' && !Array.isArray(p.data) && 'martingalaData' in p.data
              ? /** @type {Record<string, unknown>} */ (p.data).martingalaData
              : raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data) && 'martingalaData' in raw.data
                ? /** @type {Record<string, unknown>} */ (raw.data).martingalaData
                : undefined;
          onResult(
            {
              mesa,
              round,
              winStatus: raw?.winStatus,
              mesa_info: mi,
              scoreDetail,
              ganador: mi?.ganador,
              correlationKey: ckWire,
              ...(martingalaData != null && typeof martingalaData === 'object' && !Array.isArray(martingalaData)
                ? { martingalaData }
                : {}),
            },
            'socket:dashboardUpdate:NEW_RESULT',
          );
        } else {
          onResult(payload, 'socket:dashboardUpdate:NEW_RESULT');
        }
        return;
      }
      if (eventType === 'NEW_SIGNAL') {
        const p = /** @type {any} */ (payload);
        const sigDeep = p?.data?.data?.signal && typeof p.data.data.signal === 'object' ? p.data.data.signal : null;
        const sigShallow = p?.data?.signal && typeof p.data.signal === 'object' ? p.data.signal : null;
        const hasSignal = Boolean(sigDeep ?? sigShallow);
        if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload && hasSignal) {
          const sig = sigDeep ?? sigShallow;
          const mesa = p?.mesa ?? sig?.nombre_mesa ?? p?.data?.mesa ?? p?.data?.data?.mesa ?? null;
          const dataRonda = p?.data?.data?.ronda ?? p?.data?.ronda;
          const roundFromSig =
            sig?.ronda_actual ??
            sig?.Ronda ??
            sig?.ronda ??
            sig?.ronda_objetivo ??
            sig?.gameRound ??
            sig?.round ??
            null;
          onSignal(
            {
              mesa,
              data: p.data,
              round: roundFromSig ?? dataRonda ?? p?.ronda ?? p?.round ?? p?.ronda_actual ?? p?.Ronda ?? p?.ronda_objetivo ?? null,
              vector_forecast: sig?.vector_forecast,
              nombre_algoritmo: sig?.nombre_algoritmo,
              recommendation: sig?.forecast ?? sig?.recommendation ?? null,
              correlationKey:
                p?.correlationKey ??
                (p?.data && typeof p.data === 'object' && !Array.isArray(p.data) ? p.data.correlationKey : undefined) ??
                raw?.correlationKey,
              id: p?.id ?? sig?.id ?? sig?.signalId ?? raw?.id,
              signalId: p?.signalId ?? raw?.signalId,
            },
            'socket:dashboardUpdate:NEW_SIGNAL',
          );
        } else {
          onSignal(payload, 'socket:dashboardUpdate:NEW_SIGNAL');
        }
        return;
      }

      console.log('SOCKET EVENT:', displayType);
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
