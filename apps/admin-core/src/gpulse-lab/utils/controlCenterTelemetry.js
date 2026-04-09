import { useLabStore } from '../store/useLabStore.js';
import { useControlCenterStore } from '../store/useControlCenterStore.js';

/**
 * Called from recordLabCycleEnd after cycle is finalized (non-bootstrap).
 * @param {Record<string, unknown>} meta
 * @param {Record<string, unknown>} cycle
 */
export function recordControlCenterCycleEnd(meta, cycle) {
  const mesaKey = String(meta.mesaKey ?? meta.mesa ?? '').trim();
  if (!mesaKey) return;
  const row = useLabStore.getState().mesas[mesaKey];
  useControlCenterStore.getState().ingestCycle(mesaKey, meta, cycle, row);
}
