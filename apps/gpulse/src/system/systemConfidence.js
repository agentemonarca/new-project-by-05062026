/**
 * Deterministic confidence model — lightweight weighted signals (no ML).
 * Weights: queue · delay · failure → congestionProbability (feedback-tuned).
 */

import { getAdaptiveCongestionWeights, getAdaptiveQueueNormRef } from './systemFeedbackLoop.js';

/** Confirmation delay (ms) at which delay term saturates. */
const DELAY_NORM_MS = 90_000;

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/**
 * Full decomposition for telemetry, segmented calibration, and audit traces.
 * @param {object} input
 * @param {number} [input.queueWaiting]
 * @param {number} [input.avgConfirmationTime] — ms; NaN/undefined if unknown
 * @param {number} [input.failureRate] — 0…1
 * @param {object} [input.systemHealth]
 */
export function computeConfidenceDecomposition({
  queueWaiting = 0,
  avgConfirmationTime = NaN,
  failureRate = 0,
  systemHealth = {},
} = {}) {
  const qw = Math.max(0, Number(queueWaiting) || 0);
  const fr = clamp01(Number(failureRate));
  const delay = Number(avgConfirmationTime);
  const normRef = Math.max(4, getAdaptiveQueueNormRef());
  const { wQueue, wDelay, wFailure } = getAdaptiveCongestionWeights();
  const normQ = clamp01(qw / normRef);
  const normD = Number.isFinite(delay) ? clamp01(delay / DELAY_NORM_MS) : 0;

  const risk = String(systemHealth.riskLevel || '').toLowerCase();
  const mempool = String(systemHealth.mempool || '').toLowerCase();
  const backend = String(systemHealth.backend || '').toLowerCase();

  const riskBoost = risk === 'high' ? 1 : risk === 'medium' ? 0.45 : 0;
  const mempoolStress = mempool === 'congested' ? 1 : mempool === 'busy' ? 0.55 : 0;
  const backendStress = backend === 'lagging' ? 0.5 : backend === 'degraded' ? 0.35 : 0;

  const congestionTerm = wQueue * normQ;
  const delayTerm = wDelay * normD;
  const failureTerm = wFailure * fr;
  const congestionProbability = clamp01(congestionTerm + delayTerm + failureTerm);

  const failureProbability = clamp01(0.55 * fr + 0.25 * riskBoost + 0.12 * mempoolStress + 0.08 * backendStress);

  const systemStressScore = Math.round(
    clamp01(0.48 * congestionProbability + 0.42 * failureProbability + 0.1 * (mempoolStress * 0.7 + backendStress)) *
      100,
  );

  return {
    congestionProbability,
    failureProbability,
    systemStressScore,
    normQ,
    normD,
    fr,
    wQueue,
    wDelay,
    wFailure,
    congestionTerm,
    delayTerm,
    failureTerm,
  };
}

/**
 * @param {object} input
 * @returns {{
 *   congestionProbability: number,
 *   failureProbability: number,
 *   systemStressScore: number,
 * }}
 */
export function computeSystemConfidence(input = {}) {
  const c = computeConfidenceDecomposition(input);
  return {
    congestionProbability: c.congestionProbability,
    failureProbability: c.failureProbability,
    systemStressScore: c.systemStressScore,
  };
}
