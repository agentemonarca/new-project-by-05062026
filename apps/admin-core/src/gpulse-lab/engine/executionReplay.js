import { createInitialState, reduce } from './executionEngine.js';

/**
 * Recompute engine state by folding `reduce` from scratch over recorded events (deterministic).
 *
 * @param {Array<{ type: string, payload?: Record<string, unknown> }>} events
 * @param {number} endInclusiveIndex — index of last event to apply; use `-1` for idle shell only
 */
export function replayFold(events, endInclusiveIndex) {
  let s = createInitialState();
  if (!Array.isArray(events) || events.length === 0) return s;
  const last = Math.max(-1, Math.min(endInclusiveIndex, events.length - 1));
  for (let i = 0; i <= last; i += 1) {
    const ev = events[i];
    if (ev == null || typeof ev !== 'object') continue;
    s = reduce(s, /** @type {{ type: string, payload?: Record<string, unknown> }} */ (ev));
  }
  return s;
}
