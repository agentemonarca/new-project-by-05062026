/**
 * Phase 7 — deterministic execution validation (opt-in via `VITE_GPULSE_FLICKER_FORENSIC=1`).
 * No business logic; logging and counters only.
 */

export function isGpulseFlickerForensicEnabled() {
  return import.meta.env.VITE_GPULSE_FLICKER_FORENSIC === '1';
}

/** @type {Map<string, number>} */
const timesProcessedByKey = new Map();

export function resetEngineForensicProcessCounts() {
  timesProcessedByKey.clear();
}

/**
 * @param {string} processKey unique per logical dispatch (e.g. NEW_SIGNAL:ck or fp for result)
 * @param {string} correlationKey for error message
 */
export function recordEngineProcess(processKey, correlationKey) {
  if (!isGpulseFlickerForensicEnabled()) return 0;
  const n = (timesProcessedByKey.get(processKey) ?? 0) + 1;
  timesProcessedByKey.set(processKey, n);
  if (n > 1) {
    console.error('DUPLICATE PROCESS', correlationKey, { processKey, timesProcessed: n });
  }
  return n;
}

/** @param {unknown} event */
export function logEngineForensicEvent(event) {
  if (!isGpulseFlickerForensicEnabled()) return;
  console.log('ENGINE EVENT', event);
}

/** @param {unknown} engineState */
export function logEngineForensicState(engineState) {
  if (!isGpulseFlickerForensicEnabled()) return;
  console.log('ENGINE STATE', engineState);
}

/**
 * Reducer rejected an event (no state change). Opt-in via `VITE_GPULSE_FLICKER_FORENSIC=1`.
 * @param {'INVALID_VECTOR' | 'INVALID_OUTCOME' | 'OUT_OF_RANGE' | 'NOT_RUNNING' | 'MISSING_CORRELATION'} reason
 * @param {unknown} payload
 * @param {unknown} state
 */
export function warnEngineReject(reason, payload, state) {
  if (!isGpulseFlickerForensicEnabled()) return;
  const p =
    payload != null && typeof payload === 'object' && !Array.isArray(payload)
      ? /** @type {Record<string, unknown>} */ (payload)
      : null;
  const s =
    state != null && typeof state === 'object' && !Array.isArray(state)
      ? /** @type {Record<string, unknown>} */ (state)
      : null;
  const vf = p?.vector_forecast;
  const vectorShort = Array.isArray(vf) ? vf.slice(0, 3) : undefined;
  console.warn('ENGINE REJECT', {
    reason,
    correlationKey: p?.correlationKey,
    step: s?.currentStep,
    status: s?.status,
    shortPayload: {
      ganador: p?.ganador,
      vector: vectorShort,
    },
  });
}
