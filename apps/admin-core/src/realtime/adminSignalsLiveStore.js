import getAdminSignalsSocket from '../services/socket-admin.js';
import { logPhaseActiveOnce } from '@/utils/canonicalFlowFlags.js';
import { applyCanonicalModeToPayload } from '@/utils/extractCanonicalFields.js';
import { addRawEvent } from '../store/rawEventsStore.js';
import { playLossSound, playNewSignalSound, playWinSound, soundEnabled } from '../utils/adminSignalsSounds.js';
import { normalizeCorrelationKeyInRecord } from './correlationKeyNormalize.js';
import { createLiveResultEntry, createLiveSignalEntry } from './adminSignalsLiveIngest.js';
import { recordCorrelationKeyObservation } from './correlationKeyStats.js';
import { mergeMesaInfoFromNestedIntoRow } from '@/utils/vistaLabProviderExtras.js';
import { mergeRelayNewSignalForConsumers } from './mergeRelayNewSignalRow.js';
import {
  diffNewResultProviderVsPanel,
  diffNewSignalProviderVsPanel,
} from '../utils/adminPanelProviderWireDiff.js';
import { isResultFullTraceClient } from '../gpulse-lab/utils/resultFullTraceClient.js';

/**
 * @typedef {{ type: string, ts: number, reason?: string, payload?: unknown }} AdminDebugLogEntry
 */

const MAX_ITEMS = 50;
const MAX_DEBUG_LOGS = 100;
const TRACE_ON = import.meta.env.VITE_ADMIN_SIGNALS_TRACE === '1';
/** Una línea por evento: aceptación o rechazo en ingest (diagnóstico). Ver CANONICAL_ALIGNMENT_AUDIT.md */
const INGEST_LOG = import.meta.env.VITE_ADMIN_SIGNALS_INGEST_LOG === '1';

let signals = /** @type {any[]} */ ([]);
let results = /** @type {any[]} */ ([]);
let connected = false;
let rev = 0;

/** @type {{ raw: unknown, formatted: unknown } | null} */
let debugLastSignal = null;
/** @type {{ raw: unknown, formatted: unknown } | null} */
let debugLastResult = null;

/** Último mensaje socket crudo (misma forma que envía el relay) para VistaLab / comparativa. */
let lastNewSignalSocketPayload = /** @type {unknown} */ (null);
let lastNewResultSocketPayload = /** @type {unknown} */ (null);
/** @type {ReturnType<typeof diffNewSignalProviderVsPanel> | null} */
let signalWireVsPanelDiff = null;
/** @type {ReturnType<typeof diffNewResultProviderVsPanel> | null} */
let resultWireVsPanelDiff = null;
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
  if (depth === 0 && msg && typeof msg === 'object' && !Array.isArray(msg) && 'canonical' in msg) {
    msg = mergeRelayNewSignalForConsumers(msg);
  }
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
    'prediction',
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

function cloneWirePreview(x) {
  try {
    return JSON.parse(JSON.stringify(x));
  } catch {
    return x ?? null;
  }
}

/** @returns {Record<string, unknown>} */
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
      lastNewSignalSocketPayload,
      lastNewResultSocketPayload,
      signalWireVsPanelDiff,
      resultWireVsPanelDiff,
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
    lastNewSignalSocketPayload: null,
    lastNewResultSocketPayload: null,
    signalWireVsPanelDiff: null,
    resultWireVsPanelDiff: null,
  };
}

let bridgeAttached = false;

/**
 * GPulse Lab: mismo payload que VistaLab, sin segundo `socket.on` (evita doble ingesta / orden).
 * @type {{ onNewSignal: ((data: unknown) => void) | null, onNewResult: ((data: unknown) => void) | null }}
 */
const gpulseRelayHooks = {
  onNewSignal: null,
  onNewResult: null,
};

/**
 * Registra callbacks del GPulse Lab tras `ingestNew*FromWire` (buffer VistaLab primero).
 * Pasar `null` al desmontar el lab.
 * @param {{ onNewSignal?: (data: unknown) => void, onNewResult?: (data: unknown) => void } | null} handlers
 */
export function registerGpulseLabRelayHandlers(handlers) {
  if (handlers == null) {
    gpulseRelayHooks.onNewSignal = null;
    gpulseRelayHooks.onNewResult = null;
    return;
  }
  gpulseRelayHooks.onNewSignal = handlers.onNewSignal ?? null;
  gpulseRelayHooks.onNewResult = handlers.onNewResult ?? null;
}

/** Fuerza el bridge socket (p. ej. GPulse Lab sin suscriptores VistaLab). */
export function ensureAdminSignalsIngestBridge() {
  ensureAdminSignalsBridge();
}

/**
 * Misma tubería que el evento socket `NEW_SIGNAL` (única fuente del buffer VistaLab).
 * @param {unknown} data
 * @param {string} [source]
 */
function ingestNewSignalFromWire(data, source = 'ingest:NEW_SIGNAL') {
  ensureAdminSignalsBridge();
  logPhaseActiveOnce();
  const msg = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : {};
  lastNewSignalSocketPayload = cloneWirePreview(msg);
  const row0 = extractLiveRowFromSocketMsg(msg);
  const { payload: row } = applyCanonicalModeToPayload(row0);
  const { formatted, strictOk, rejectReason } = createLiveSignalEntry(row, nextRecvId());
  if (INGEST_LOG) {
    console.info('[admin-signals ingest]', 'SIGNAL', source, strictOk ? 'ok' : `reject:${rejectReason ?? 'UNKNOWN'}`);
  }
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
  signalWireVsPanelDiff = diffNewSignalProviderVsPanel(msg, formatted);
  if (signalWireVsPanelDiff.hasMismatch) {
    pushStructuredDebug({
      type: 'PANEL_VS_PROVIDER_SIGNAL',
      payload: {
        source,
        mismatches: signalWireVsPanelDiff.mismatches,
        provider: signalWireVsPanelDiff.provider,
        panel: signalWireVsPanelDiff.panel,
      },
    });
  }
  recordCorrelationKeyObservation('signal', formatted, { source });
  adminSignalsPredictionByMesa.set(String(formatted.mesa), formatted.prediction);
  signals = [formatted, ...signals].slice(0, MAX_ITEMS);
  debugLastSignal = { raw: row, formatted };
  debugLogs = [`NEW_SIGNAL mesa=${formatted.mesa} ${formatted.prediction}`, ...debugLogs].slice(0, MAX_DEBUG_LOGS);
  if (soundEnabled) playNewSignalSound();
  bump();
}

/**
 * Misma tubería que `NEW_RESULT` (buffer + VistaLab). Acepta fila plana tipo relay (`scoreDetail`, `ganador`, …).
 * @param {unknown} data
 * @param {string} [source]
 */
function ingestNewResultFromWire(data, source = 'ingest:NEW_RESULT') {
  ensureAdminSignalsBridge();
  logPhaseActiveOnce();
  const msg = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : {};
  if (isResultFullTraceClient()) console.log('📥 INGEST RESULT RECEIVED', msg);
  lastNewResultSocketPayload = cloneWirePreview(msg);
  const row0 = extractLiveRowFromSocketMsg(msg);
  const { payload: row } = applyCanonicalModeToPayload(row0);
  const mesaKey = String(row.mesa ?? 'N/A');
  const predicted = adminSignalsPredictionByMesa.get(mesaKey) ?? null;
  const { formatted, strictOk, rejectReason } = createLiveResultEntry(row, predicted, nextRecvId());
  if (INGEST_LOG) {
    console.info('[admin-signals ingest]', 'RESULT', source, strictOk ? 'ok' : `reject:${rejectReason ?? 'UNKNOWN'}`);
  }
  if (TRACE_ON) {
    console.log('TRACE: PARSED PAYLOAD', row);
    console.log('TRACE: VALIDATION RESULT', { ok: strictOk, reason: rejectReason ?? null });
  }
  if (!strictOk) {
    if (isResultFullTraceClient()) console.error('❌ REJECT_RESULT', rejectReason ?? 'UNKNOWN', row);
    console.error('RESULT LOST AT:', 'VISTALAB');
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
  resultWireVsPanelDiff = diffNewResultProviderVsPanel(msg, formatted);
  if (resultWireVsPanelDiff.hasMismatch) {
    pushStructuredDebug({
      type: 'PANEL_VS_PROVIDER_RESULT',
      payload: {
        source,
        mismatches: resultWireVsPanelDiff.mismatches,
        provider: resultWireVsPanelDiff.provider,
        panel: resultWireVsPanelDiff.panel,
      },
    });
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
}

/**
 * Inyecta una señal sin socket (misma ruta que `NEW_SIGNAL`). Solo para pruebas / fixtures.
 * @param {unknown} data
 * @param {string} [source]
 */
export function injectAdminSignalsFixtureSignal(data, source = 'fixture:NEW_SIGNAL') {
  ingestNewSignalFromWire(data, source);
}

/**
 * Inyecta un resultado sin socket (misma ruta que `NEW_RESULT`). Payload plano relay / core-api.
 * @param {unknown} data
 * @param {string} [source]
 */
export function injectAdminSignalsFixtureResult(data, source = 'fixture:NEW_RESULT') {
  ingestNewResultFromWire(data, source);
}

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

  socket.on('connect', onConnect);
  socket.on('disconnect', onDisconnect);
  socket.on('connect_error', onConnectError);
  // Única tubería: mismo evento → buffer VistaLab → opcional GPulse Lab (ref, sin duplicar listeners).
  socket.on('NEW_SIGNAL', (d) => {
    ingestNewSignalFromWire(d, 'socket:NEW_SIGNAL');
    const wireForGpulse = lastNewSignalSocketPayload;
    try {
      gpulseRelayHooks.onNewSignal?.(wireForGpulse ?? d);
    } catch (e) {
      console.error('[admin-signals] gpulse relay NEW_SIGNAL', e);
    }
  });
  socket.on('NEW_RESULT', (d) => {
    ingestNewResultFromWire(d, 'socket:NEW_RESULT');
    const wireForGpulse = lastNewResultSocketPayload;
    try {
      gpulseRelayHooks.onNewResult?.(wireForGpulse ?? d);
    } catch (e) {
      console.error('[admin-signals] gpulse relay NEW_RESULT', e);
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
