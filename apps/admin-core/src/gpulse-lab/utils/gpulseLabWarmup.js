/**
 * Post-connect stabilization: skip noisy validation / “sin señal” handling briefly.
 * Lives in a tiny module so useAlertStore can read it without importing useLabSocket
 * (would cycle: useLabSocket → useValidationStore → useAlertStore).
 */

let isWarmup = true;
/** @type {ReturnType<typeof setTimeout> | null} */
let warmupEndTimer = null;

const DEFAULT_WARMUP_MS = 3000;

/**
 * Call on each successful socket `connect` (initial or reconnect).
 * Resets the window so the lab ignores spurious cycles until stabilization.
 * @param {number} [ms]
 */
export function beginGpulseLabWarmupWindow(ms = DEFAULT_WARMUP_MS) {
  isWarmup = true;
  if (warmupEndTimer != null) {
    clearTimeout(warmupEndTimer);
    warmupEndTimer = null;
  }
  warmupEndTimer = setTimeout(() => {
    isWarmup = false;
    warmupEndTimer = null;
  }, ms);
}

/** @returns {boolean} */
export function isGpulseLabWarmup() {
  return isWarmup;
}
