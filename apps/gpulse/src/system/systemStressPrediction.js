/**
 * Light-weight stress hint from recent telemetry (no ML).
 * Used to bias adaptation layer; keep UX non-intrusive (no alerts).
 */

import {
  QUEUE_WAITING_THRESHOLD_HIGH,
  QUEUE_WAITING_THRESHOLD_MEDIUM,
} from './queueThresholds.js';
import { getAdaptiveQueueThresholds } from './systemFeedbackLoop.js';
import { SYSTEM_TREND } from './systemTrendBuffer.js';

export const SYSTEM_STRESS_HINT = Object.freeze({
  STABLE: 'stable',
  RISING_LOAD: 'rising_load',
  CRITICAL_SOON: 'critical_soon',
});

const RECENT_FAIL_CRITICAL = 4;
const RECENT_FAIL_ELEVATED = 1;
const FAIL_RATE_CRITICAL = 0.18;
const FAIL_RATE_ELEVATED = 0.06;
const DELAY_MS_CRITICAL = 90_000;
const DELAY_MS_ELEVATED = 35_000;

/**
 * @param {object} input
 * @param {number} [input.recentFailures]
 * @param {number} [input.avgConfirmationDelayMs] — same semantics as avgConfirmationTime in txStats (NaN if unknown)
 * @param {number} [input.queueWaiting] — BullMQ waiting count (preferred)
 * @param {number} [input.queueBacklog] — alias for queueWaiting (legacy)
 * @param {number} [input.failureRate] — 0…1
 * @param {number} [input.congestionProbability] — 0…1 from computeSystemConfidence
 * @param {'stable'|'rising'|'spiking'} [input.trend] — from trend buffer
 * @returns {'stable' | 'rising_load' | 'critical_soon'}
 */
export function predictSystemStress({
  recentFailures = 0,
  avgConfirmationDelayMs = NaN,
  queueWaiting,
  queueBacklog = 0,
  failureRate = 0,
  congestionProbability,
  trend,
} = {}) {
  const rf = Number(recentFailures) || 0;
  const fr = Number(failureRate);
  const waiting = Math.max(0, Number(queueWaiting ?? queueBacklog) || 0);
  const delay = Number(avgConfirmationDelayMs);
  const cp = Number(congestionProbability);

  const delayHot = Number.isFinite(delay) && delay >= DELAY_MS_CRITICAL;
  const delayWarm = Number.isFinite(delay) && delay >= DELAY_MS_ELEVATED;
  const failBurst = rf >= RECENT_FAIL_CRITICAL || (Number.isFinite(fr) && fr >= FAIL_RATE_CRITICAL);
  const { medium: thrMed, high: thrHigh } = getAdaptiveQueueThresholds();
  const queueCritical = waiting > (Number.isFinite(thrHigh) ? thrHigh : QUEUE_WAITING_THRESHOLD_HIGH);
  const queueElevated = waiting > (Number.isFinite(thrMed) ? thrMed : QUEUE_WAITING_THRESHOLD_MEDIUM);

  const probCritical = Number.isFinite(cp) && cp > 0.7;

  if (probCritical) {
    return SYSTEM_STRESS_HINT.CRITICAL_SOON;
  }

  if (failBurst || delayHot || queueCritical) {
    return SYSTEM_STRESS_HINT.CRITICAL_SOON;
  }

  const failElevated =
    rf >= RECENT_FAIL_ELEVATED ||
    (Number.isFinite(fr) && fr >= FAIL_RATE_ELEVATED) ||
    delayWarm ||
    queueElevated;

  let hint = failElevated ? SYSTEM_STRESS_HINT.RISING_LOAD : SYSTEM_STRESS_HINT.STABLE;

  if (trend === SYSTEM_TREND.SPIKING) {
    if (hint === SYSTEM_STRESS_HINT.STABLE) hint = SYSTEM_STRESS_HINT.RISING_LOAD;
    else if (hint === SYSTEM_STRESS_HINT.RISING_LOAD) hint = SYSTEM_STRESS_HINT.CRITICAL_SOON;
  }

  return hint;
}
