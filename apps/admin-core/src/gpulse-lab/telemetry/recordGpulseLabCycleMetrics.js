import { useMetricsStore } from '../store/useMetricsStore.js';

/**
 * Observability hook for lab cycle closure (no validation logic).
 * @param {'COMPLETE' | 'INCOMPLETE' | 'ERROR'} uiStatus
 * @param {number | undefined} delayMsLab
 */
export function recordGpulseLabCycleMetrics(uiStatus, delayMsLab) {
  useMetricsStore.getState().recordLabCycle(uiStatus, delayMsLab);
}
