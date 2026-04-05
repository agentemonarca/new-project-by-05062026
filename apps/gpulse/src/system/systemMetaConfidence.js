/**
 * Meta-confidence (calibration of prediction vs realized stress) + deterministic explainability.
 * Non-linear mapping: modelConfidence = exp(-k × normalizedError), with time-decayed error aggregation.
 */

import { getPredictionErrorHistory } from './systemFeedbackLoop.js';
import { SYSTEM_STRESS_HINT } from './systemStressPrediction.js';
import { SYSTEM_TREND } from './systemTrendBuffer.js';

/** Same scale as `AVG_CONFIRM_SLOW_MS` in decisionEngine (ms). */
const AVG_CONFIRM_SLOW_MS = 45_000;

/** Below this, autonomy influence is dampened and actions bias toward safe. */
export const MODEL_CONFIDENCE_LOW_THRESHOLD = 0.45;

const PREDICTION_WINDOW = 28;

/** Older samples decay with this half-life (ms). */
export const PREDICTION_DECAY_HALF_LIFE_MS = 45 * 60 * 1000;

/** Sharpness of exp(-k·ε); typical range 2–4. */
let metaConfidenceK = 3;

export function getMetaConfidenceK() {
  return metaConfidenceK;
}

/** @param {number} k — clamped to [1, 8] for stability */
export function setMetaConfidenceK(k) {
  const x = Number(k);
  if (Number.isFinite(x) && x >= 1 && x <= 8) metaConfidenceK = x;
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/**
 * Mean absolute prediction error in 0…1 (prediction vs settlement stress proxy).
 * Uses exponential time decay so recent outcomes dominate.
 */
export function getNormalizedPredictionError(now = Date.now()) {
  const rows = getPredictionErrorHistory().slice(-PREDICTION_WINDOW);
  if (!rows.length) return null;
  let sumW = 0;
  let sumE = 0;
  for (const r of rows) {
    const age = Math.max(0, now - r.t);
    const w = Math.pow(0.5, age / PREDICTION_DECAY_HALF_LIFE_MS);
    sumW += w;
    sumE += w * r.errorPct;
  }
  if (sumW <= 0) return null;
  const meanPct = sumE / sumW;
  return clamp01(meanPct / 100);
}

/**
 * modelConfidence = exp(-k × normalizedPredictionError). Cold start: 1.0 when no samples.
 * @returns {number} 0…1
 */
export function getModelConfidence() {
  const ne = getNormalizedPredictionError();
  if (ne == null) return 1;
  return clamp01(Math.exp(-metaConfidenceK * ne));
}

/**
 * Combined trust for “strategy vs model” display (institutional readout).
 * @param {number} modelConfidence 0…1
 * @param {{ congestionProbability?: number, failureProbability?: number, systemStressScore?: number }} [conf]
 */
export function computeStrategyConfidence(modelConfidence, conf = {}) {
  const mc = clamp01(Number(modelConfidence));
  const fp = clamp01(Number(conf.failureProbability) || 0);
  const ss = Number(conf.systemStressScore);
  const stressPen = Number.isFinite(ss) ? clamp01(ss / 100) * 0.12 : 0;
  const failPen = fp * 0.1;
  return Math.min(100, Math.max(0, Math.round(100 * mc * (1 - stressPen - failPen))));
}

/**
 * @param {object} input
 * @param {number} [input.queueWaiting]
 * @param {number} [input.avgConfirmationTime]
 * @param {number} [input.failureRate]
 * @param {string} [input.trend]
 * @param {object} [input.systemHealth]
 * @param {{ medium: number, high: number }} [input.thresholds]
 * @param {string} [input.stressHint]
 * @param {string} [input.systemMode]
 * @returns {string[]}
 */
export function buildDecisionReasons({
  queueWaiting = 0,
  avgConfirmationTime = NaN,
  failureRate = 0,
  trend = SYSTEM_TREND.STABLE,
  systemHealth = {},
  thresholds = { medium: 10, high: 28 },
  stressHint = SYSTEM_STRESS_HINT.STABLE,
  systemMode = 'NORMAL_MODE',
} = {}) {
  const reasons = [];
  const qw = Math.max(0, Number(queueWaiting) || 0);
  const med = Number(thresholds?.medium) || 10;
  const hi = Number(thresholds?.high) || 28;
  const fr = Number(failureRate);
  const delay = Number(avgConfirmationTime);
  const risk = String(systemHealth?.riskLevel || '').toLowerCase();
  const mempool = String(systemHealth?.mempool || '').toLowerCase();

  if (qw >= hi * 0.92) reasons.push('High queue backlog');
  else if (qw >= med) reasons.push('Elevated queue depth');

  if (Number.isFinite(delay)) {
    if (delay > AVG_CONFIRM_SLOW_MS) reasons.push('Rising confirmation delays');
    else if (delay < 25_000) reasons.push('Confirmation latency nominal');
  } else {
    reasons.push('Confirmation latency unknown (insufficient samples)');
  }

  if (Number.isFinite(fr)) {
    if (fr > 0.1) reasons.push('Elevated failure rate observed');
    else if (fr <= 0.03) reasons.push('Failure rate stable');
  }

  if (trend === SYSTEM_TREND.SPIKING) reasons.push('Telemetry trend: spiking');
  else if (trend === SYSTEM_TREND.RISING) reasons.push('Telemetry trend: rising');

  if (risk === 'high') reasons.push('Health risk elevated');
  if (mempool === 'congested') reasons.push('Mempool congestion reported');

  if (stressHint === SYSTEM_STRESS_HINT.CRITICAL_SOON) reasons.push('Stress model: critical band');
  else if (stressHint === SYSTEM_STRESS_HINT.RISING_LOAD) reasons.push('Stress model: rising load');

  if (String(systemMode).includes('PROTECTION')) reasons.push('Operating in protection mode');
  else if (String(systemMode).includes('DELAYED')) reasons.push('Delayed pipeline mode');
  else if (String(systemMode).includes('CAUTION')) reasons.push('Caution mode active');

  const seen = new Set();
  const out = [];
  for (const r of reasons) {
    if (seen.has(r)) continue;
    seen.add(r);
    out.push(r);
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * When model calibration is poor, reduce autonomy influence and bias toward safe execution.
 * @param {{ txSpeedMultiplier: number, queuePriorityStrategy: string, uiFeedbackLevel: string, retryPolicy: string }} actions
 */
export function applyMetaConfidenceSafety(actions) {
  const mc = getModelConfidence();
  if (mc >= MODEL_CONFIDENCE_LOW_THRESHOLD) return actions;

  const gap = MODEL_CONFIDENCE_LOW_THRESHOLD - mc;
  const t = clamp01(gap / MODEL_CONFIDENCE_LOW_THRESHOLD);

  let txSpeedMultiplier = actions.txSpeedMultiplier * (1 - 0.24 * t);
  txSpeedMultiplier = Math.max(0.28, Math.min(1.12, txSpeedMultiplier));

  let queuePriorityStrategy = actions.queuePriorityStrategy;
  if (t > 0.28 && queuePriorityStrategy === 'normal') queuePriorityStrategy = 'balanced';
  if (t > 0.45 && (queuePriorityStrategy === 'normal' || queuePriorityStrategy === 'balanced')) {
    queuePriorityStrategy = 'safe';
  }

  let retryPolicy = actions.retryPolicy;
  if (t > 0.38 && retryPolicy === 'standard') retryPolicy = 'conservative';

  return {
    ...actions,
    txSpeedMultiplier,
    queuePriorityStrategy,
    retryPolicy,
  };
}
