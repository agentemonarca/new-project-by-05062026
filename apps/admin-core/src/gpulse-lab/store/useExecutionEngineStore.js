import { create } from 'zustand';
import { createInitialState } from '../engine/executionEngine.js';

/**
 * @typedef {ReturnType<typeof createInitialState>} EngineState
 */

/** Referencia estable cuando no hay motor (solo lectura en UI). */
const IDLE_ENGINE_FALLBACK = createInitialState();

/** @returns {{ RUNNING: Set<string>, SUCCESS: Set<string>, FAILED: Set<string> }} */
function emptyEngineIndex() {
  return {
    RUNNING: new Set(),
    SUCCESS: new Set(),
    FAILED: new Set(),
  };
}

/**
 * Quita `ck` de los tres sets y lo añade al bucket de `newStatus` (solo RUNNING | SUCCESS | FAILED).
 * @param {{ RUNNING: Set<string>, SUCCESS: Set<string>, FAILED: Set<string> }} curr
 * @param {string} ck
 * @param {string} newStatus
 */
function nextEngineIndexForSet(curr, ck, newStatus) {
  const R = new Set(curr.RUNNING);
  const S = new Set(curr.SUCCESS);
  const F = new Set(curr.FAILED);
  R.delete(ck);
  S.delete(ck);
  F.delete(ck);
  if (newStatus === 'RUNNING') R.add(ck);
  else if (newStatus === 'SUCCESS') S.add(ck);
  else if (newStatus === 'FAILED') F.add(ck);
  return { RUNNING: R, SUCCESS: S, FAILED: F };
}

/**
 * @param {{ RUNNING: Set<string>, SUCCESS: Set<string>, FAILED: Set<string> }} curr
 * @param {string} ck
 */
function nextEngineIndexForRemove(curr, ck) {
  const R = new Set(curr.RUNNING);
  const S = new Set(curr.SUCCESS);
  const F = new Set(curr.FAILED);
  R.delete(ck);
  S.delete(ck);
  F.delete(ck);
  return { RUNNING: R, SUCCESS: S, FAILED: F };
}

/**
 * One execution snapshot per `correlationKey` (mesa+round). No shared state between tables.
 *
 * **Writes:** use {@link setEngine} from `executionEngineDispatch` after `reduce()`.
 *
 * **engineIndex:** `correlationKey` sets by terminal status — query without scanning `engineMap`.
 */

export const useExecutionEngineStore = create(() => ({
  /** @type {Record<string, EngineState>} */
  engineMap: {},
  /** @type {{ RUNNING: Set<string>, SUCCESS: Set<string>, FAILED: Set<string> }} */
  engineIndex: emptyEngineIndex(),
}));

/**
 * @param {string | null | undefined} correlationKey
 * @returns {EngineState | undefined}
 */
export function getEngine(correlationKey) {
  if (correlationKey == null || String(correlationKey).trim() === '') return undefined;
  return useExecutionEngineStore.getState().engineMap[String(correlationKey).trim()];
}

/**
 * @param {string | null | undefined} correlationKey
 * @param {EngineState} newState
 */
export function setEngine(correlationKey, newState) {
  const ck = correlationKey != null ? String(correlationKey).trim() : '';
  if (ck === '') return;
  useExecutionEngineStore.setState((s) => ({
    engineMap: { ...s.engineMap, [ck]: newState },
    engineIndex: nextEngineIndexForSet(s.engineIndex, ck, String(newState.status)),
  }));
}

/** @returns {Record<string, EngineState>} */
export function getAllEngines() {
  return { ...useExecutionEngineStore.getState().engineMap };
}

/**
 * Índice por estado (mismas claves que en `engineMap` para RUNNING | SUCCESS | FAILED).
 * @returns {{ RUNNING: Set<string>, SUCCESS: Set<string>, FAILED: Set<string> }}
 */
export function getEngineIndex() {
  const ix = useExecutionEngineStore.getState().engineIndex;
  return {
    RUNNING: new Set(ix.RUNNING),
    SUCCESS: new Set(ix.SUCCESS),
    FAILED: new Set(ix.FAILED),
  };
}

/**
 * @param {string | null | undefined} correlationKey
 */
export function removeEngine(correlationKey) {
  const ck = correlationKey != null ? String(correlationKey).trim() : '';
  if (ck === '') return;
  useExecutionEngineStore.setState((s) => {
    const { [ck]: _removed, ...rest } = s.engineMap;
    return {
      engineMap: rest,
      engineIndex: nextEngineIndexForRemove(s.engineIndex, ck),
    };
  });
}

/**
 * UI: prefer engine for the selected mesa’s correlation key; else newest RUNNING; else idle shell.
 * @param {Record<string, EngineState> | undefined} engineMap
 * @param {string | null | undefined} preferredCorrelationKey
 * @param {{ RUNNING: Set<string>, SUCCESS: Set<string>, FAILED: Set<string> } | undefined} [engineIndex] — if passed, RUNNING scan only touches keys in the index
 * @returns {EngineState}
 */
export function selectEngineForDisplay(engineMap, preferredCorrelationKey, engineIndex) {
  const m = engineMap && typeof engineMap === 'object' ? engineMap : {};
  const ck =
    preferredCorrelationKey != null && String(preferredCorrelationKey).trim() !== ''
      ? String(preferredCorrelationKey).trim()
      : null;
  if (ck != null && m[ck] != null) return m[ck];

  let best = null;
  let bestTs = -1;
  const runningKeys =
    engineIndex?.RUNNING != null && engineIndex.RUNNING.size > 0
      ? [...engineIndex.RUNNING]
      : Object.keys(m).filter((k) => m[k]?.status === 'RUNNING');

  for (const rk of runningKeys) {
    const e = m[rk];
    if (e?.status === 'RUNNING' && (e.startedAt ?? 0) > bestTs) {
      bestTs = e.startedAt ?? 0;
      best = e;
    }
  }
  if (best != null) return best;
  return IDLE_ENGINE_FALLBACK;
}

/**
 * Replace one engine snapshot (dispatch path).
 * @param {string | null | undefined} correlationKey
 * @param {EngineState} engineState
 */
export function updateEngineStore(correlationKey, engineState) {
  setEngine(correlationKey, engineState);
}

