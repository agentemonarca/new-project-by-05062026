import getAdminSignalsSocket from '../services/socket-admin.js';
import { addRawEvent } from '../store/rawEventsStore.js';
import { playLossSound, playNewSignalSound, playWinSound, soundEnabled } from '../utils/adminSignalsSounds.js';
import { formatResult, formatSignal } from '../utils/signalFormatter.js';

const MAX_ITEMS = 50;
const MAX_DEBUG_LOGS = 100;

let signals = /** @type {any[]} */ ([]);
let results = /** @type {any[]} */ ([]);
let connected = false;
let rev = 0;

/** @type {{ raw: unknown, formatted: unknown } | null} */
let debugLastSignal = null;
/** @type {{ raw: unknown, formatted: unknown } | null} */
let debugLastResult = null;
/** @type {string[]} */
let debugLogs = [];

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

/** @param {unknown} obj */
function payloadPreview(obj, max = 1800) {
  try {
    const s = JSON.stringify(obj);
    return s.length > max ? `${s.slice(0, max)}\n… [truncated]` : s;
  } catch {
    return String(obj).slice(0, max);
  }
}

function bump() {
  rev += 1;
  snapCache = null;
  snapRev = -1;
  listeners.forEach((l) => l());
}

export function adminSignalsPushDebugLog(message) {
  ensureAdminSignalsBridge();
  debugLogs = [`[${new Date().toISOString()}] ${message}`, ...debugLogs].slice(0, MAX_DEBUG_LOGS);
  bump();
}

/** @returns {{ signals: any[], results: any[], connected: boolean, rev: number, debugLastSignal: typeof debugLastSignal, debugLastResult: typeof debugLastResult, debugLogs: string[] }} */
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
    const row = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : {};
    const formatted = { ...formatSignal(row), recvId: nextRecvId() };
    formatted.providerRawPreview = payloadPreview(row);
    formatted.normalizedPreview = payloadPreview({
      mesa: formatted.mesa,
      recommendation: formatted.recommendation,
      martingale: formatted.martingale,
      classification: formatted.classification,
      round: formatted.round,
      id: formatted.id,
      correlationKey: formatted.correlationKey,
      timestamp: formatted.timestamp,
    });
    adminSignalsPredictionByMesa.set(String(formatted.mesa), formatted.predictionLabel);
    signals = [formatted, ...signals].slice(0, MAX_ITEMS);
    debugLastSignal = { raw: row, formatted };
    debugLogs = [`NEW_SIGNAL mesa=${formatted.mesa} ${formatted.predictionLabel}`, ...debugLogs].slice(0, MAX_DEBUG_LOGS);
    if (soundEnabled) playNewSignalSound();
    bump();
  };

  const onResult = (data) => {
    const row = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : {};
    const mesaKey = String(row.mesa ?? 'N/A');
    const predicted = adminSignalsPredictionByMesa.get(mesaKey) ?? null;
    const formatted = { ...formatResult(row, predicted), recvId: nextRecvId() };
    formatted.providerRawPreview = payloadPreview(row);
    formatted.normalizedPreview = payloadPreview({
      mesa: formatted.mesa,
      ganador: formatted.ganador,
      winStatus: formatted.winStatus,
      outcome: formatted.outcome,
      round: formatted.round,
      historial: formatted.historial,
      correlationKey: formatted.correlationKey,
      signalId: formatted.signalId,
      verdict: formatted.verdict,
      versus: formatted.versus,
    });
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

  socket.onAny((event, ...args) => {
    const payload = args.length <= 1 ? args[0] : args;
    addRawEvent(event, payload);

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
