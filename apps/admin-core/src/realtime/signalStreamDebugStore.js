import getAdminSignalsSocket from '../services/socket-admin.js';

export const SIGNAL_STREAM_DEBUG_MAX_FRAMES = 50;

/** @type {unknown[]} */
let frames = [];
/** @type {Record<string, unknown> | null} */
let latestCounters = null;
let rev = 0;

/** @type {Set<() => void>} */
const listeners = new Set();

/** @type {{ frames: unknown[]; latestCounters: Record<string, unknown> | null; rev: number } | null} */
let snapCache = null;
let snapRev = -1;

function bump() {
  rev += 1;
  snapCache = null;
  snapRev = -1;
  listeners.forEach((l) => l());
}

/**
 * Misma referencia mientras `rev` no cambie — requisito de useSyncExternalStore (evita maximum update depth).
 * @returns {{ frames: unknown[], latestCounters: Record<string, unknown> | null, rev: number }}
 */
export function getSignalStreamDebugSnapshot() {
  ensureSignalStreamDebugBridge();
  if (snapRev !== rev) {
    snapRev = rev;
    snapCache = {
      frames: frames.slice(),
      latestCounters,
      rev,
    };
  }
  return snapCache;
}

export function subscribeSignalStreamDebug(cb) {
  ensureSignalStreamDebugBridge();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSignalStreamDebugServerSnapshot() {
  return { frames: [], latestCounters: null, rev: 0 };
}

let attached = false;

function ensureSignalStreamDebugBridge() {
  if (attached) return;
  attached = true;
  const socket = getAdminSignalsSocket();
  if (!socket.connected) socket.connect();

  const onFrame = (row) => {
    const rec = row && typeof row === 'object' ? row : { _raw: row };
    frames = [rec, ...frames].slice(0, SIGNAL_STREAM_DEBUG_MAX_FRAMES);
    if (rec.counters && typeof rec.counters === 'object') {
      latestCounters = /** @type {Record<string, unknown>} */ (rec.counters);
    }
    bump();
  };

  socket.on('signal_stream_frame', onFrame);
}
