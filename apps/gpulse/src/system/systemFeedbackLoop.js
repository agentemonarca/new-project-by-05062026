/**
 * Self-optimizing feedback: rolling telemetry, smoot weight/threshold tuning, long-run execution strategy.
 * Persisted lightly to localStorage; rate-limited to avoid oscillation.
 */

import { confirmationDurationFromTx } from './txStats.js';
import {
  QUEUE_WAITING_THRESHOLD_HIGH as BASE_THRESHOLD_HIGH,
  QUEUE_WAITING_THRESHOLD_MEDIUM as BASE_THRESHOLD_MEDIUM,
} from './queueThresholds.js';

export const EXECUTION_STRATEGY = Object.freeze({
  SPEED: 'speed',
  BALANCED: 'balanced',
  PROTECTION: 'protection',
});

const STORAGE_KEY = 'gpulse.systemFeedback.v1';

/** EMA α for slow signals (long-term strategy). */
const ALPHA_LONG = 0.04;
/** EMA α for fast outcome signals. */
const ALPHA_FAST = 0.12;

const WEIGHT_STEP = 0.012;
const WEIGHT_MIN = 0.18;
const WEIGHT_MAX = 0.52;

const THRESH_MEDIUM_BOUNDS = { lo: 5, hi: 26 };
const THRESH_HIGH_BOUNDS = { lo: 12, hi: 52 };

const MIN_MS_WEIGHT = 90_000;
const MIN_MS_THRESH = 120_000;
const MIN_MS_STRATEGY = 180_000;

const SNAPSHOT_MAX = 48;
const SNAPSHOT_TTL_MS = 180_000;

const HISTORY_WEIGHTS_MAX = 24;
const HISTORY_THRESH_MAX = 24;
const HISTORY_TREND_MAX = 32;
const HISTORY_PRED_MAX = 32;
const DECISION_TRACE_MAX = 64;

/** Delay normalization (must match systemConfidence DELAY_NORM_MS). */
const DELAY_NORM_MS = 90_000;

/** @type {Array<{ t: number, cp: number, qw: number, hint: string, normQ?: number, normD?: number, fr?: number }>} */
let telemetrySnapshots = [];

/** @type {Array<{ t: number, wQueue: number, wDelay: number, wFailure: number }>} */
let weightChangeHistory = [];

/** @type {Array<{ t: number, medium: number, high: number }>} */
let thresholdChangeHistory = [];

/** @type {Array<{ t: number, trend: string }>} */
let trendHistory = [];

/** @type {Array<{ t: number, predictedCp: number, actualStress: number, errorPct: number, eCongestion?: number, eDelay?: number, eFailure?: number }>} */
let predictionErrorHistory = [];

/** Audit: inputs → prediction → decision → outcome (ring buffer). */
/** @type {Array<{ t: number, inputs: object, prediction: object, decision: object, outcome: object }>} */
let decisionTraceHistory = [];

const intelligenceListeners = new Set();

/** @type {object} */
let state = loadRaw();

function loadRaw() {
  if (typeof window === 'undefined') {
    return createDefaultState();
  }
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const j = JSON.parse(raw);
    return normalizeState(j);
  } catch {
    return createDefaultState();
  }
}

function createDefaultState() {
  return {
    v: 1,
    emaConfirmMs: NaN,
    emaQueueWaitMs: NaN,
    emaSuccess: 1,
    wQueue: 0.4,
    wDelay: 0.3,
    wFailure: 0.3,
    threshMedium: BASE_THRESHOLD_MEDIUM,
    threshHigh: BASE_THRESHOLD_HIGH,
    longStress: 0,
    executionStrategy: EXECUTION_STRATEGY.BALANCED,
    observedQueueStressEma: 0,
    lastWeightAt: 0,
    lastThreshAt: 0,
    lastStrategyAt: 0,
    samplesOutcomes: 0,
    autoOptimizationEnabled: true,
    strategyOverride: null,
    freezeWeights: false,
    frozenWeights: null,
  };
}

function normalizeState(j) {
  const d = createDefaultState();
  if (!j || typeof j !== 'object') return d;
  const wr = renormalizeTriplet(Number(j.wQueue) || 0.4, Number(j.wDelay) || 0.3, Number(j.wFailure) || 0.3);
  return {
    ...d,
    emaConfirmMs: Number.isFinite(Number(j.emaConfirmMs)) ? Number(j.emaConfirmMs) : d.emaConfirmMs,
    emaQueueWaitMs: Number.isFinite(Number(j.emaQueueWaitMs)) ? Number(j.emaQueueWaitMs) : d.emaQueueWaitMs,
    emaSuccess: clamp01(Number(j.emaSuccess) || d.emaSuccess),
    wQueue: wr.wQueue,
    wDelay: wr.wDelay,
    wFailure: wr.wFailure,
    threshMedium: clamp(Number(j.threshMedium) || d.threshMedium, THRESH_MEDIUM_BOUNDS.lo, THRESH_MEDIUM_BOUNDS.hi),
    threshHigh: clamp(Number(j.threshHigh) || d.threshHigh, THRESH_HIGH_BOUNDS.lo, THRESH_HIGH_BOUNDS.hi),
    longStress: clamp01(Number(j.longStress) || 0),
    executionStrategy: normalizeStrategy(j.executionStrategy),
    observedQueueStressEma: Math.max(0, Number(j.observedQueueStressEma) || 0),
    lastWeightAt: Number(j.lastWeightAt) || 0,
    lastThreshAt: Number(j.lastThreshAt) || 0,
    lastStrategyAt: Number(j.lastStrategyAt) || 0,
    samplesOutcomes: Math.max(0, Number(j.samplesOutcomes) || 0),
    autoOptimizationEnabled: j.autoOptimizationEnabled !== false,
    strategyOverride:
      j.strategyOverride == null || String(j.strategyOverride).trim() === ''
        ? null
        : normalizeStrategy(j.strategyOverride),
    freezeWeights: Boolean(j.freezeWeights),
    frozenWeights:
      j.frozenWeights && typeof j.frozenWeights === 'object'
        ? renormalizeTriplet(
            Number(j.frozenWeights.wQueue) || 0.4,
            Number(j.frozenWeights.wDelay) || 0.3,
            Number(j.frozenWeights.wFailure) || 0.3,
          )
        : null,
  };
}

function normalizeStrategy(s) {
  const x = String(s || '').toLowerCase();
  if (x === EXECUTION_STRATEGY.SPEED) return EXECUTION_STRATEGY.SPEED;
  if (x === EXECUTION_STRATEGY.PROTECTION) return EXECUTION_STRATEGY.PROTECTION;
  return EXECUTION_STRATEGY.BALANCED;
}

function clamp(x, lo, hi) {
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

function clamp01(x) {
  return clamp(x, 0, 1);
}

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

function renormalizeTriplet(wq, wd, wf) {
  let a = clamp(wq, WEIGHT_MIN, WEIGHT_MAX);
  let b = clamp(wd, WEIGHT_MIN, WEIGHT_MAX);
  let c = clamp(wf, WEIGHT_MIN, WEIGHT_MAX);
  const s = a + b + c || 1;
  return { wQueue: a / s, wDelay: b / s, wFailure: c / s };
}

function pushRing(arr, max, item) {
  arr.push(item);
  while (arr.length > max) arr.shift();
}

export function notifyIntelligenceUpdate() {
  for (const fn of intelligenceListeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

/** Subscribe to control-plane changes (toggles / overrides). */
export function subscribeIntelligenceUpdates(fn) {
  intelligenceListeners.add(fn);
  return () => intelligenceListeners.delete(fn);
}

/**
 * Rolling averages + tuner state (read-only snapshot).
 */
export function getFeedbackState() {
  return { ...state, telemetryDepth: telemetrySnapshots.length };
}

export function getAdaptiveCongestionWeights() {
  if (state.freezeWeights && state.frozenWeights) {
    const f = state.frozenWeights;
    return renormalizeTriplet(f.wQueue, f.wDelay, f.wFailure);
  }
  return renormalizeTriplet(state.wQueue, state.wDelay, state.wFailure);
}

/** Queue saturation scale for confidence (moves with observed congestion). */
export function getAdaptiveQueueNormRef() {
  const high = Math.max(BASE_THRESHOLD_HIGH, state.threshHigh || BASE_THRESHOLD_HIGH);
  return Math.max(6, high * 1.35);
}

export function getAdaptiveQueueThresholds() {
  let medium = state.threshMedium ?? BASE_THRESHOLD_MEDIUM;
  let high = state.threshHigh ?? BASE_THRESHOLD_HIGH;
  if (!Number.isFinite(medium)) medium = BASE_THRESHOLD_MEDIUM;
  if (!Number.isFinite(high)) high = BASE_THRESHOLD_HIGH;
  if (high < medium + 2) high = medium + 2;
  return { medium, high };
}

export function getAdaptiveQueueModeCutoffs() {
  const { medium, high } = getAdaptiveQueueThresholds();
  const protection = Math.max(medium + 2, high);
  const delayed = clamp(medium * 1.08, medium + 0.5, protection - 1);
  const caution = clamp(medium * 0.58, 4, Math.max(4, delayed - 1));
  return { caution, delayed, protection };
}

export function getExecutionStrategy() {
  if (state.strategyOverride != null && String(state.strategyOverride).trim() !== '') {
    return normalizeStrategy(state.strategyOverride);
  }
  return state.executionStrategy ?? EXECUTION_STRATEGY.BALANCED;
}

/** Autonomous strategy (ignores operator override). */
export function getAutonomousExecutionStrategy() {
  return state.executionStrategy ?? EXECUTION_STRATEGY.BALANCED;
}

export function getWeightChangeHistory() {
  return weightChangeHistory.slice();
}

export function getThresholdChangeHistory() {
  return thresholdChangeHistory.slice();
}

export function getTrendHistory() {
  return trendHistory.slice();
}

export function getPredictionErrorHistory() {
  return predictionErrorHistory.slice();
}

export function getPredictionErrorSummary() {
  const rows = predictionErrorHistory.slice(-32);
  if (!rows.length) {
    return {
      meanErrorPct: null,
      n: 0,
      meanCongestionErr: null,
      meanDelayErr: null,
      meanFailureErr: null,
    };
  }
  const mean = rows.reduce((a, r) => a + r.errorPct, 0) / rows.length;
  const hasSeg = rows.some((r) => Number.isFinite(r.eCongestion));
  if (!hasSeg) {
    return {
      meanErrorPct: mean,
      n: rows.length,
      meanCongestionErr: null,
      meanDelayErr: null,
      meanFailureErr: null,
    };
  }
  const n = rows.length;
  return {
    meanErrorPct: mean,
    n,
    meanCongestionErr: rows.reduce((a, r) => a + (r.eCongestion ?? 0), 0) / n,
    meanDelayErr: rows.reduce((a, r) => a + (r.eDelay ?? 0), 0) / n,
    meanFailureErr: rows.reduce((a, r) => a + (r.eFailure ?? 0), 0) / n,
  };
}

export function getDecisionTraceHistory() {
  return decisionTraceHistory.slice();
}

export function setAutoOptimizationEnabled(enabled) {
  state.autoOptimizationEnabled = Boolean(enabled);
  persist();
  notifyIntelligenceUpdate();
}

export function setStrategyOverride(strategy) {
  state.strategyOverride =
    strategy == null || String(strategy).trim() === '' ? null : normalizeStrategy(strategy);
  persist();
  notifyIntelligenceUpdate();
}

export function setFreezeWeights(frozen) {
  state.freezeWeights = Boolean(frozen);
  if (state.freezeWeights) {
    state.frozenWeights = renormalizeTriplet(state.wQueue, state.wDelay, state.wFailure);
  } else {
    state.frozenWeights = null;
  }
  persist();
  notifyIntelligenceUpdate();
}

function pruneSnapshots(now = Date.now()) {
  telemetrySnapshots = telemetrySnapshots.filter((s) => now - s.t <= SNAPSHOT_TTL_MS);
  while (telemetrySnapshots.length > SNAPSHOT_MAX) telemetrySnapshots.shift();
}

/**
 * Call periodically (~4s) with live model I/O for outcome attribution.
 * @param {{ congestionProbability: number, queueWaiting: number, stressHint?: string, trend?: string, normQ?: number, normD?: number, fr?: number }} sample
 */
export function pushFeedbackTelemetrySample(sample) {
  if (!sample || typeof sample !== 'object') return;
  const now = Date.now();
  pruneSnapshots(now);
  const cp = clamp01(Number(sample.congestionProbability));
  const qw = Math.max(0, Number(sample.queueWaiting) || 0);
  const hint = String(sample.stressHint || 'stable');
  const normQ = Number.isFinite(Number(sample.normQ)) ? clamp01(Number(sample.normQ)) : undefined;
  const normD = Number.isFinite(Number(sample.normD)) ? clamp01(Number(sample.normD)) : undefined;
  const fr = Number.isFinite(Number(sample.fr)) ? clamp01(Number(sample.fr)) : undefined;
  telemetrySnapshots.push({ t: now, cp, qw, hint, normQ, normD, fr });
  pruneSnapshots(now);
  if (sample.trend != null) {
    pushRing(trendHistory, HISTORY_TREND_MAX, { t: now, trend: String(sample.trend) });
  }
}

function avgSnapshotsBefore(targetT, windowMs = 90_000) {
  const lo = targetT - windowMs;
  const sel = telemetrySnapshots.filter((s) => s.t >= lo && s.t <= targetT);
  if (!sel.length) return null;
  const n = sel.length;
  const normRef = Math.max(4, getAdaptiveQueueNormRef());
  let sumCp = 0;
  let sumQw = 0;
  let sumNQ = 0;
  let sumND = 0;
  let sumFr = 0;
  for (const s of sel) {
    sumCp += s.cp;
    sumQw += s.qw;
    sumNQ += Number.isFinite(s.normQ) ? s.normQ : clamp01(s.qw / normRef);
    sumND += Number.isFinite(s.normD) ? s.normD : 0;
    sumFr += Number.isFinite(s.fr) ? s.fr : 0;
  }
  return {
    cp: sumCp / n,
    qw: sumQw / n,
    normQ: sumNQ / n,
    normD: sumND / n,
    fr: sumFr / n,
  };
}

function emaUpdate(prev, x, alpha) {
  if (!Number.isFinite(prev)) return x;
  return prev + alpha * (x - prev);
}

/**
 * @param {{ success: boolean, confirmMs?: number, queueWaitMs?: number | null, atMs?: number }} outcome
 */
export function recordFeedbackOutcome(outcome) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const success = Boolean(outcome?.success);
  const confirmMs = Number(outcome?.confirmMs);
  const qwm = Number(outcome?.queueWaitMs);
  const settleAt = Number.isFinite(Number(outcome?.atMs)) ? Number(outcome.atMs) : now;

  state.samplesOutcomes += 1;

  if (Number.isFinite(confirmMs) && confirmMs >= 0) {
    state.emaConfirmMs = emaUpdate(state.emaConfirmMs, confirmMs, ALPHA_FAST);
  }
  if (Number.isFinite(qwm) && qwm >= 0) {
    state.emaQueueWaitMs = emaUpdate(state.emaQueueWaitMs, qwm, ALPHA_FAST);
  }
  state.emaSuccess = emaUpdate(state.emaSuccess, success ? 1 : 0, ALPHA_FAST);

  const prior = avgSnapshotsBefore(settleAt - (Number.isFinite(confirmMs) ? confirmMs : 0), 120_000);
  const cpPrior = prior?.cp ?? state.longStress;
  const qwPrior = prior?.qw ?? 0;

  const normRef = Math.max(4, getAdaptiveQueueNormRef());
  const qActual = Number.isFinite(qwm) && qwm >= 0 ? qwm : qwPrior;
  const normQ_actual = clamp01(qActual / normRef);
  const normD_actual =
    Number.isFinite(confirmMs) && confirmMs >= 0 ? clamp01(confirmMs / DELAY_NORM_MS) : (prior?.normD ?? 0);
  const fr_actual = success ? 0 : 1;

  let eCongestion = 0;
  let eDelay = 0;
  let eFailure = 0;
  if (prior) {
    eCongestion = Math.abs(prior.normQ - normQ_actual);
    eDelay = Math.abs(prior.normD - normD_actual);
    eFailure = Math.abs(prior.fr - fr_actual);
  }

  if (now - state.lastWeightAt >= MIN_MS_WEIGHT && state.autoOptimizationEnabled && !state.freezeWeights) {
    let wq = state.wQueue;
    let wd = state.wDelay;
    let wf = state.wFailure;

    if (!success) {
      wf += WEIGHT_STEP * (0.6 + cpPrior * 0.4);
      wq += WEIGHT_STEP * 0.25 * clamp01(qwPrior / (state.threshHigh || BASE_THRESHOLD_HIGH));
    } else if (Number.isFinite(confirmMs)) {
      const slow = state.emaConfirmMs;
      if (Number.isFinite(slow) && confirmMs > slow * 1.35) {
        wd += WEIGHT_STEP * (cpPrior > 0.45 ? 1.2 : 0.7);
      } else if (cpPrior > 0.55 && confirmMs < slow * 0.9) {
        wq -= WEIGHT_STEP * 0.5;
        wd -= WEIGHT_STEP * 0.25;
      }
    }

    if (prior) {
      const seg = [eCongestion, eDelay, eFailure];
      const maxE = Math.max(...seg);
      const idx = seg.indexOf(maxE);
      if (maxE > 0.08) {
        const bump = WEIGHT_STEP * 0.55 * Math.min(1, maxE);
        if (idx === 0) wq += bump;
        else if (idx === 1) wd += bump;
        else wf += bump;
      }
    }

    const ren = renormalizeTriplet(wq, wd, wf);
    state.wQueue = ren.wQueue;
    state.wDelay = ren.wDelay;
    state.wFailure = ren.wFailure;
    state.lastWeightAt = now;
    pushRing(weightChangeHistory, HISTORY_WEIGHTS_MAX, {
      t: now,
      wQueue: state.wQueue,
      wDelay: state.wDelay,
      wFailure: state.wFailure,
    });
  }

  if (now - state.lastThreshAt >= MIN_MS_THRESH && state.autoOptimizationEnabled) {
    const stressedQueue = qwPrior >= state.threshMedium * 0.75 || qwPrior >= BASE_THRESHOLD_MEDIUM;
    if (qwPrior > 0) {
      state.observedQueueStressEma = emaUpdate(state.observedQueueStressEma || qwPrior, qwPrior, 0.14);
    }
    if (stressedQueue || !success) {
      const targetHigh = clamp(
        (Number.isFinite(qwPrior) ? qwPrior : state.threshHigh) * 1.06 + (success ? 0 : 3),
        THRESH_HIGH_BOUNDS.lo,
        THRESH_HIGH_BOUNDS.hi,
      );
      const targetMed = clamp(
        (Number.isFinite(qwPrior) ? qwPrior : state.threshMedium) * 0.92 + (success ? 0 : 1.5),
        THRESH_MEDIUM_BOUNDS.lo,
        THRESH_MEDIUM_BOUNDS.hi,
      );
      state.threshHigh = emaUpdate(state.threshHigh, targetHigh, 0.07);
      state.threshMedium = emaUpdate(state.threshMedium, targetMed, 0.07);
    } else if (success && qwPrior <= state.threshMedium * 0.35) {
      state.threshHigh = emaUpdate(state.threshHigh, BASE_THRESHOLD_HIGH, 0.04);
      state.threshMedium = emaUpdate(state.threshMedium, BASE_THRESHOLD_MEDIUM, 0.04);
    }
    state.lastThreshAt = now;
    pushRing(thresholdChangeHistory, HISTORY_THRESH_MAX, {
      t: now,
      medium: state.threshMedium,
      high: state.threshHigh,
    });
  }

  const stressTick = clamp01(cpPrior * 0.55 + (success ? 0 : 0.35) + (Number.isFinite(confirmMs) ? Math.min(1, confirmMs / 120_000) * 0.15 : 0));
  state.longStress = emaUpdate(state.longStress, stressTick, ALPHA_LONG);

  pushRing(predictionErrorHistory, HISTORY_PRED_MAX, {
    t: now,
    predictedCp: cpPrior,
    actualStress: stressTick,
    errorPct: Math.abs(cpPrior - stressTick) * 100,
    eCongestion,
    eDelay,
    eFailure,
  });

  pushRing(decisionTraceHistory, DECISION_TRACE_MAX, {
    t: now,
    inputs: {
      queueWaiting: qwPrior,
      normQ_pred: prior?.normQ,
      normD_pred: prior?.normD,
      fr_pred: prior?.fr,
      cpPrior,
    },
    prediction: {
      eCongestion,
      eDelay,
      eFailure,
      errorPct: Math.abs(cpPrior - stressTick) * 100,
    },
    decision: { stressTick, mode: 'settlement' },
    outcome: {
      success,
      confirmMs: Number.isFinite(confirmMs) ? confirmMs : null,
      queueWaitMs: Number.isFinite(qwm) ? qwm : null,
      normQ_actual,
      normD_actual,
      fr_actual,
    },
  });

  if (now - state.lastStrategyAt >= MIN_MS_STRATEGY && state.autoOptimizationEnabled && state.strategyOverride == null) {
    const ls = state.longStress;
    const prev = state.executionStrategy;
    let next = prev;
    if (prev === EXECUTION_STRATEGY.SPEED && ls > 0.34) next = EXECUTION_STRATEGY.BALANCED;
    else if (prev === EXECUTION_STRATEGY.BALANCED && ls < 0.24) next = EXECUTION_STRATEGY.SPEED;
    else if (prev === EXECUTION_STRATEGY.BALANCED && ls > 0.58) next = EXECUTION_STRATEGY.PROTECTION;
    else if (prev === EXECUTION_STRATEGY.PROTECTION && ls < 0.48) next = EXECUTION_STRATEGY.BALANCED;

    if (next !== prev) {
      state.executionStrategy = next;
      state.lastStrategyAt = now;
    }
  }

  persist();
}

/** Derive queue wait from flow timeline (BROADCASTING − earliest phase). */
export function queueWaitDurationFromTx(tx) {
  const fs = tx?.flowStates;
  if (!Array.isArray(fs) || fs.length === 0) return null;
  const by = {};
  const times = [];
  for (const e of fs) {
    const s = String(e?.state || '');
    const t = Number(e?.at);
    if (!s || !Number.isFinite(t)) continue;
    times.push(t);
    if (by[s] == null || t < by[s]) by[s] = t;
  }
  const tB = by.BROADCASTING ?? by.SIGNING;
  if (!Number.isFinite(tB)) return null;
  const t0 = Math.min(...times);
  if (!Number.isFinite(t0) || tB <= t0) return null;
  return tB - t0;
}

/**
 * Scan wallet rows for newly settled txs and feed the loop.
 * @param {Array<object>} transactions
 * @param {Set<string>} seenIds mutable
 */
export function ingestSettledTransactionsForFeedback(transactions, seenIds) {
  const list = Array.isArray(transactions) ? transactions : [];
  for (const t of list) {
    const id = String(t?.id ?? t?.txHash ?? t?.requestId ?? '');
    if (!id) continue;
    const st = String(t?.status || '').toUpperCase();
    if (st !== 'COMPLETED' && st !== 'FAILED') continue;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const confirmMs = confirmationDurationFromTx(t);
    const queueWaitMs = queueWaitDurationFromTx(t);
    const atMs = Number(t?.at) || Date.now();
    recordFeedbackOutcome({
      success: st === 'COMPLETED',
      confirmMs: Number.isFinite(confirmMs) ? confirmMs : undefined,
      queueWaitMs: Number.isFinite(queueWaitMs) ? queueWaitMs : null,
      atMs,
    });
  }
}

export function resetFeedbackLoopForTests() {
  state = createDefaultState();
  telemetrySnapshots = [];
  weightChangeHistory = [];
  thresholdChangeHistory = [];
  trendHistory = [];
  predictionErrorHistory = [];
  decisionTraceHistory = [];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
