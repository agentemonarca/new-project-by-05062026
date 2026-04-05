/**
 * Fan-out for `queue:stats` from the shared GpulseSocketSync connection (single socket).
 */

const listeners = new Set();

/**
 * @param {(payload: { waiting: number, active: number }) => void} fn
 * @returns {() => void}
 */
export function subscribeQueueStatsFromSocket(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** @param {unknown} raw */
export function dispatchQueueStatsFromSocket(raw) {
  if (!raw || typeof raw !== 'object') return;
  const waiting = Math.max(0, Number(raw.waiting) || 0);
  const active = Math.max(0, Number(raw.active) || 0);
  const ss = String(raw.scaleSignal || 'hold').toLowerCase();
  const scaleSignal = ss === 'scale_up' || ss === 'scale_down' ? ss : 'hold';
  const payload = { waiting, active, scaleSignal };
  for (const fn of listeners) {
    try {
      fn(payload);
    } catch {
      /* ignore subscriber errors */
    }
  }
}
