import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';

/**
 * Verbose logs: dev default on; prod only if VITE_GPULSE_LAB_DEBUG=1 or UI toggle.
 */
export function gpulseLabIsVerbose() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GPULSE_LAB_DEBUG === '1') return true;
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GPULSE_LAB_DEBUG === '0') return false;
  try {
    if (useGpulseLabUiStore.getState().debugLogging) return true;
  } catch {
    /* ignore */
  }
  return Boolean(typeof import.meta !== 'undefined' && import.meta.env?.DEV);
}

export const gpulseLabLog = {
  debug(...args) {
    if (!gpulseLabIsVerbose()) return;
    console.log('[gpulse-lab]', ...args);
  },
  info(...args) {
    if (!gpulseLabIsVerbose()) return;
    console.info('[gpulse-lab]', ...args);
  },
  warn(...args) {
    console.warn('[gpulse-lab]', ...args);
  },
  error(...args) {
    console.error('[gpulse-lab]', ...args);
  },
  /** Always emitted (minimal operational line). Use sparingly. */
  operational(...args) {
    console.info('[gpulse-lab]', ...args);
  },
};
