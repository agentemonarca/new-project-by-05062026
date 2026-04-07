import { useAdminSignalsPolling } from './useAdminSignalsPolling.js';

/**
 * Alias del polling unificado — no crear setInterval aquí.
 * Un solo temporizador vive en `useAdminSignalsPolling` (stats + analytics + alerts-daily).
 *
 * @param {number} [pollMs] intervalo base si está entre 10s–15s
 */
export function useAdminSignalsAnalytics(pollMs) {
  const ms = pollMs != null ? pollMs : 12_000;
  const clamped = Math.min(15_000, Math.max(10_000, ms));
  useAdminSignalsPolling({ baseIntervalMs: clamped });
}
