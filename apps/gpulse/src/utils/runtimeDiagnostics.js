import { useEffect, useRef } from 'react';

/** Dev-only structured tracing: set `VITE_DEBUG_RUNTIME_TRACE=1` */
export function isRuntimeTraceEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_DEBUG_RUNTIME_TRACE === '1';
}

/**
 * @param {string} componentName
 * @param {() => Record<string, unknown>} getSnapshot
 * @param {unknown[] | null} [updateDeps] When non-null, log updates + run watchers when these deps change.
 */
export function useRuntimeTrace(componentName, getSnapshot, updateDeps = null) {
  const snapRef = useRef(getSnapshot);
  snapRef.current = getSnapshot;
  const prevSnapRef = useRef(null);
  const skipFirstUpdateRef = useRef(updateDeps != null);

  useEffect(() => {
    if (!isRuntimeTraceEnabled()) return undefined;
    let snap = {};
    try {
      snap = snapRef.current?.() ?? {};
    } catch (e) {
      console.warn(`[gpulse:trace] ${componentName} snapshot error`, e);
    }
    console.info(`[gpulse:trace] mount ${componentName}`, snap);
    prevSnapRef.current = snap;
    return () => {
      console.info(`[gpulse:trace] unmount ${componentName}`);
    };
  }, [componentName]);

  useEffect(() => {
    if (!isRuntimeTraceEnabled() || updateDeps == null) return undefined;
    let snap = {};
    try {
      snap = snapRef.current?.() ?? {};
    } catch (e) {
      console.warn(`[gpulse:trace] ${componentName} snapshot error`, e);
      return undefined;
    }
    if (skipFirstUpdateRef.current) {
      skipFirstUpdateRef.current = false;
      prevSnapRef.current = snap;
      return undefined;
    }
    watchUndefinedTransitions(prevSnapRef.current, snap, componentName);
    watchNaNValues(snap, componentName);
    watchArrayShapeTransitions(prevSnapRef.current, snap, componentName);
    watchFunctionTransitions(prevSnapRef.current, snap, componentName);
    console.info(`[gpulse:trace] update ${componentName}`, snap);
    prevSnapRef.current = snap;
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: caller supplies trace dimensions
  }, updateDeps);
}

/**
 * Log when a field transitions from a “valid” value to `undefined` / `null`.
 * @param {Record<string, unknown> | null | undefined} prev
 * @param {Record<string, unknown> | null | undefined} next
 * @param {string} label
 */
export function watchUndefinedTransitions(prev, next, label) {
  if (!isRuntimeTraceEnabled() || !next || typeof next !== 'object') return;
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next)]);
  for (const k of keys) {
    const was = prev?.[k];
    const now = next[k];
    const wasDefined = was !== undefined && was !== null;
    const nowInvalid = now === undefined || now === null;
    if (wasDefined && nowInvalid) {
      console.warn(`[gpulse:watch] ${label}.${k} valid → undefined/null`, { was, now });
    }
  }
}

/**
 * Log numeric fields that are NaN.
 * @param {Record<string, unknown> | null | undefined} obj
 * @param {string} label
 */
export function watchNaNValues(obj, label) {
  if (!isRuntimeTraceEnabled() || !obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && Number.isNaN(v)) {
      console.warn(`[gpulse:watch] ${label}.${k} is NaN`);
    }
  }
}

/**
 * Log when a field was an array and becomes a non-array.
 * @param {Record<string, unknown> | null | undefined} prev
 * @param {Record<string, unknown> | null | undefined} next
 * @param {string} label
 */
export function watchArrayShapeTransitions(prev, next, label) {
  if (!isRuntimeTraceEnabled() || !next || typeof next !== 'object') return;
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next)]);
  for (const k of keys) {
    const was = prev?.[k];
    const now = next[k];
    if (Array.isArray(was) && !Array.isArray(now)) {
      console.warn(`[gpulse:watch] ${label}.${k} array → non-array`, { wasLen: was.length, now });
    }
  }
}

/**
 * Log when a callback field was a function and is no longer a function.
 * @param {Record<string, unknown> | null | undefined} prev
 * @param {Record<string, unknown> | null | undefined} next
 * @param {string} label
 */
export function watchFunctionTransitions(prev, next, label) {
  if (!isRuntimeTraceEnabled() || !next || typeof next !== 'object') return;
  for (const k of Object.keys(next)) {
    const was = prev?.[k];
    const now = next[k];
    if (typeof was === 'function' && typeof now !== 'function') {
      console.warn(`[gpulse:watch] ${label}.${k} function → non-function`, { now });
    }
  }
}
