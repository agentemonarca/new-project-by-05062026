import { create } from 'zustand';
import { createInitialState } from '../engine/executionEngine.js';
import { replayFold } from '../engine/executionReplay.js';

/**
 * @typedef {{ type: string, payload: Record<string, unknown> }} ReplayEvent
 */

/** @param {Record<string, unknown>} p */
function clonePayload(p) {
  try {
    return /** @type {Record<string, unknown>} */ (JSON.parse(JSON.stringify(p)));
  } catch {
    return { ...p };
  }
}

/**
 * Full event history per correlation key + cursor for step replay (Phase 10).
 * Independent from live `engineMap` (audit trail survives terminal cleanup).
 */
export const useExecutionReplayStore = create((set, get) => ({
  /** @type {Record<string, { events: ReplayEvent[], cursor: number }>} */
  byCk: {},

  /**
   * Start a new cycle (call on successful NEW_SIGNAL).
   * @param {string} ck
   * @param {{ type: string, payload: Record<string, unknown> }} reduceEvent
   */
  startCycle(ck, reduceEvent) {
    const ev = { type: reduceEvent.type, payload: clonePayload(reduceEvent.payload) };
    set((s) => ({
      byCk: { ...s.byCk, [ck]: { events: [ev], cursor: 0 } },
    }));
  },

  /**
   * @param {string} ck
   * @param {{ type: string, payload: Record<string, unknown> }} reduceEvent
   */
  appendEvent(ck, reduceEvent) {
    const ev = { type: reduceEvent.type, payload: clonePayload(reduceEvent.payload) };
    set((s) => {
      const row = s.byCk[ck];
      if (row == null) {
        return { byCk: { ...s.byCk, [ck]: { events: [ev], cursor: 0 } } };
      }
      const events = [...row.events, ev];
      return { byCk: { ...s.byCk, [ck]: { events, cursor: events.length - 1 } } };
    });
  },

  /**
   * @param {string} ck
   * @param {number} cursor — `-1` = before any event
   */
  setCursor(ck, cursor) {
    set((s) => {
      const row = s.byCk[ck];
      if (row == null || row.events.length === 0) return s;
      const c = Math.max(-1, Math.min(cursor, row.events.length - 1));
      return { byCk: { ...s.byCk, [ck]: { ...row, cursor: c } } };
    });
  },

  /** @param {string} ck */
  stepPrev(ck) {
    const row = get().byCk[ck];
    if (row == null) return;
    get().setCursor(ck, row.cursor - 1);
  },

  /** @param {string} ck */
  stepNext(ck) {
    const row = get().byCk[ck];
    if (row == null) return;
    get().setCursor(ck, row.cursor + 1);
  },

  /** @param {string} ck */
  seekLive(ck) {
    const row = get().byCk[ck];
    if (row == null || row.events.length === 0) return;
    get().setCursor(ck, row.events.length - 1);
  },

  /** @param {string} ck */
  getReplayEngineState(ck) {
    const row = get().byCk[ck];
    if (row == null || row.events.length === 0) return createInitialState();
    return replayFold(row.events, row.cursor);
  },
}));
