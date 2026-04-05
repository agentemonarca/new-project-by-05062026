/**
 * @typedef {import('./ledgerModel.js').LedgerEvent} LedgerEvent
 */

/**
 * @param {number} ts
 */
function dayKeyLocal(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {LedgerEvent[]} events
 * @returns {Array<{ dayKey: string, label: string, events: LedgerEvent[] }>}
 */
export function groupLedgerEventsByDay(events) {
  const sorted = [...events].sort((a, b) => b.ts - a.ts);
  /** @type {Map<string, LedgerEvent[]>} */
  const map = new Map();
  for (const e of sorted) {
    const key = dayKeyLocal(e.ts);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return Array.from(map.entries()).map(([dayKey, evs]) => ({
    dayKey,
    label: new Date(evs[0].ts).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    events: evs,
  }));
}

const CATEGORY_ORDER = ['transaction', 'mining', 'booster', 'staking', 'network', 'marketplace', 'overview'];

/**
 * @param {LedgerEvent[]} events
 * @returns {Array<{ category: string, events: LedgerEvent[] }>}
 */
export function groupLedgerEventsByCategory(events) {
  const sorted = [...events].sort((a, b) => b.ts - a.ts);
  /** @type {Map<string, LedgerEvent[]>} */
  const map = new Map();
  for (const e of sorted) {
    if (!map.has(e.category)) map.set(e.category, []);
    map.get(e.category).push(e);
  }
  const keys = Array.from(map.keys()).sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a) === -1 ? 99 : CATEGORY_ORDER.indexOf(a)) -
      (CATEGORY_ORDER.indexOf(b) === -1 ? 99 : CATEGORY_ORDER.indexOf(b)),
  );
  return keys.map((category) => ({ category, events: map.get(category) ?? [] }));
}
