/**
 * Tiny shared flag for "auto-resync was applied" so validation can adjust severity.
 * Avoids importing validation into middleware and vice versa.
 */

/** @type {Map<string, { at: number }>} */
const recentByKey = new Map();

const DEFAULT_TTL_MS = 4000;

function keyFor(mesa, round) {
  const m = mesa == null ? '' : String(mesa).trim();
  const r = round == null ? '' : String(round).trim();
  if (!m) return '';
  return r ? `${m}|${r}` : m;
}

/**
 * Mark that the lab reconstructed a signal based on a result for this mesa.
 * @param {{ mesa: unknown, round?: unknown, at?: number }} meta
 */
export function markGpulseLabAutoResync(meta) {
  const k = keyFor(meta?.mesa, meta?.round);
  if (!k) return;
  recentByKey.set(k, {
    at: typeof meta?.at === 'number' ? meta.at : Date.now(),
  });
  // prune occasionally
  if (recentByKey.size > 160) {
    const now = Date.now();
    for (const [km, v] of recentByKey.entries()) {
      if (now - (v?.at ?? 0) > DEFAULT_TTL_MS) recentByKey.delete(km);
    }
  }
}

/**
 * True when an auto-resync was applied very recently for this mesa.
 * @param {unknown} mesa
 * @param {number} [ttlMs]
 */
export function wasGpulseLabAutoResyncedRecently(mesa, round, ttlMs = DEFAULT_TTL_MS) {
  const now = Date.now();
  const full = keyFor(mesa, round);
  if (full) {
    const row = recentByKey.get(full);
    if (row && now - row.at <= ttlMs) return true;
  }
  const fallbackMesa = keyFor(mesa, null);
  if (!fallbackMesa) return false;
  const row2 = recentByKey.get(fallbackMesa);
  if (!row2) return false;
  return now - row2.at <= ttlMs;
}

