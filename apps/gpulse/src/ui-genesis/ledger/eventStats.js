/**
 * Shared event-window helpers (used by insights + story engines).
 *
 * @typedef {import('./ledgerModel.js').LedgerEvent} LedgerEvent
 */

const MS_DAY = 86400_000;

/**
 * @param {LedgerEvent[]} events
 * @param {number} [windowMs]
 * @returns {Record<string, number>}
 */
export function countByCategoryInWindow(events, windowMs = 7 * MS_DAY) {
  const cutoff = Date.now() - windowMs;
  /** @type {Record<string, number>} */
  const map = {};
  for (const e of events) {
    if (e.ts < cutoff) continue;
    map[e.category] = (map[e.category] ?? 0) + 1;
  }
  return map;
}
