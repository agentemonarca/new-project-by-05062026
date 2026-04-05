/**
 * G-Pulse decision engine — pure, deterministic system mode from health + local tx telemetry.
 */

import { computeSystemConfidence } from './systemConfidence.js';
import {
  getAdaptiveQueueModeCutoffs,
  getExecutionStrategy,
  EXECUTION_STRATEGY,
} from './systemFeedbackLoop.js';
import { applyMetaConfidenceSafety } from './systemMetaConfidence.js';

export const SYSTEM_MODE = Object.freeze({
  NORMAL_MODE: 'NORMAL_MODE',
  DELAYED_MODE: 'DELAYED_MODE',
  CAUTION_MODE: 'CAUTION_MODE',
  PROTECTION_MODE: 'PROTECTION_MODE',
});

export const DEFAULT_SYSTEM_MODE = SYSTEM_MODE.NORMAL_MODE;

/** Default adaptation actions when mode is NORMAL. */
export const DEFAULT_SYSTEM_ACTIONS = Object.freeze({
  txSpeedMultiplier: 1,
  queuePriorityStrategy: 'normal',
  uiFeedbackLevel: 'standard',
  retryPolicy: 'standard',
});

/** Avg on-wallet confirmation duration (ms) above this nudges toward DELAYED when health also implies stress. */
export const AVG_CONFIRM_SLOW_MS = 45_000;

/** Failure count in the recent window that counts as a “spike” for CAUTION. */
export const RECENT_FAILURE_SPIKE_THRESHOLD = 3;

function modeSeverity(mode) {
  if (mode === SYSTEM_MODE.PROTECTION_MODE) return 3;
  if (mode === SYSTEM_MODE.DELAYED_MODE) return 2;
  if (mode === SYSTEM_MODE.CAUTION_MODE) return 1;
  return 0;
}

function maxModeBySeverity(a, b) {
  return modeSeverity(a) >= modeSeverity(b) ? a : b;
}

/**
 * Escalation from server queue depth alone (predictive, before user-visible delays).
 * @param {number} queueWaiting
 */
function modeFromQueueWaiting(queueWaiting) {
  const w = Number(queueWaiting);
  if (!Number.isFinite(w) || w <= 0) return SYSTEM_MODE.NORMAL_MODE;
  const { caution, delayed, protection } = getAdaptiveQueueModeCutoffs();
  if (w >= protection) return SYSTEM_MODE.PROTECTION_MODE;
  if (w >= delayed) return SYSTEM_MODE.DELAYED_MODE;
  if (w >= caution) return SYSTEM_MODE.CAUTION_MODE;
  return SYSTEM_MODE.NORMAL_MODE;
}

/**
 * Probabilistic congestion band (0–1) → mode nudge (predictive).
 * @param {number|undefined} congestionProbability
 */
function modeFromCongestionProbability(congestionProbability) {
  const x = Number(congestionProbability);
  if (!Number.isFinite(x)) return SYSTEM_MODE.NORMAL_MODE;
  if (x > 0.8) return SYSTEM_MODE.PROTECTION_MODE;
  if (x > 0.5) return SYSTEM_MODE.DELAYED_MODE;
  return SYSTEM_MODE.NORMAL_MODE;
}

/**
 * Soft refinement on top of mode defaults — keeps deterministic bounds.
 * @param {{ txSpeedMultiplier: number, queuePriorityStrategy: string, uiFeedbackLevel: string, retryPolicy: string }} actions
 * @param {{ congestionProbability: number, failureProbability: number, systemStressScore: number }} conf
 */
export function refineActionsWithConfidence(actions, conf) {
  const cp = Number(conf?.congestionProbability);
  const fp = Number(conf?.failureProbability);
  const score = Number(conf?.systemStressScore);
  const c = Number.isFinite(cp) ? Math.min(1, Math.max(0, cp)) : 0;
  const f = Number.isFinite(fp) ? Math.min(1, Math.max(0, fp)) : 0;
  const s = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;

  let txSpeedMultiplier = actions.txSpeedMultiplier * (1 - 0.14 * (s / 100));
  txSpeedMultiplier = Math.max(0.35, Math.min(1.15, txSpeedMultiplier));

  let queuePriorityStrategy = actions.queuePriorityStrategy;
  if (c > 0.85 && queuePriorityStrategy === 'normal') queuePriorityStrategy = 'safe';
  else if (c > 0.65 && queuePriorityStrategy === 'normal') queuePriorityStrategy = 'balanced';

  let retryPolicy = actions.retryPolicy;
  if (f > 0.48 && retryPolicy === 'standard') retryPolicy = 'conservative';

  return {
    ...actions,
    txSpeedMultiplier,
    queuePriorityStrategy,
    retryPolicy,
  };
}

/**
 * Long-horizon execution posture from feedback EMA (smooth switching in systemFeedbackLoop).
 * @param {{ txSpeedMultiplier: number, queuePriorityStrategy: string, uiFeedbackLevel: string, retryPolicy: string }} actions
 */
export function refineActionsWithExecutionStrategy(actions) {
  const strat = getExecutionStrategy();
  if (strat === EXECUTION_STRATEGY.SPEED) {
    if (actions.queuePriorityStrategy === 'safe') return actions;
    return {
      ...actions,
      txSpeedMultiplier: Math.min(1.1, actions.txSpeedMultiplier * 1.05),
      queuePriorityStrategy:
        actions.queuePriorityStrategy === 'balanced' ? 'normal' : actions.queuePriorityStrategy,
    };
  }
  if (strat === EXECUTION_STRATEGY.PROTECTION) {
    return {
      ...actions,
      txSpeedMultiplier: actions.txSpeedMultiplier * 0.94,
      queuePriorityStrategy:
        actions.queuePriorityStrategy === 'normal' ? 'balanced' : actions.queuePriorityStrategy,
      retryPolicy: actions.retryPolicy === 'standard' ? 'conservative' : actions.retryPolicy,
    };
  }
  return actions;
}

/**
 * Autonomous adaptation knobs per decision mode (queue, UX pacing, retries).
 * @param {string} mode
 * @returns {{ txSpeedMultiplier: number, queuePriorityStrategy: string, uiFeedbackLevel: string, retryPolicy: string }}
 */
export function adaptationActionsForMode(mode) {
  switch (mode) {
    case SYSTEM_MODE.PROTECTION_MODE:
      return {
        txSpeedMultiplier: 0.5,
        queuePriorityStrategy: 'safe',
        uiFeedbackLevel: 'minimal',
        retryPolicy: 'conservative',
      };
    case SYSTEM_MODE.DELAYED_MODE:
      return {
        txSpeedMultiplier: 0.8,
        queuePriorityStrategy: 'balanced',
        uiFeedbackLevel: 'measured',
        retryPolicy: 'standard',
      };
    case SYSTEM_MODE.CAUTION_MODE:
      return {
        txSpeedMultiplier: 0.65,
        queuePriorityStrategy: 'balanced',
        uiFeedbackLevel: 'measured',
        retryPolicy: 'standard',
      };
    default:
      return {
        txSpeedMultiplier: DEFAULT_SYSTEM_ACTIONS.txSpeedMultiplier,
        queuePriorityStrategy: DEFAULT_SYSTEM_ACTIONS.queuePriorityStrategy,
        uiFeedbackLevel: DEFAULT_SYSTEM_ACTIONS.uiFeedbackLevel,
        retryPolicy: DEFAULT_SYSTEM_ACTIONS.retryPolicy,
      };
  }
}

/**
 * @param {object} input
 * @param {object} [input.systemHealth]
 * @param {object} [input.recentTxStats]
 * @param {number} [input.queueWaiting] — BullMQ waiting count from `/system/queue-stats`
 * @param {number} [input.congestionProbability] — from computeSystemConfidence (optional)
 * @returns {typeof SYSTEM_MODE[keyof typeof SYSTEM_MODE]}
 */
function resolveSystemModeKey({
  systemHealth = {},
  recentTxStats = {},
  queueWaiting = 0,
  congestionProbability,
} = {}) {
  const risk = String(systemHealth.riskLevel || '').toLowerCase();
  const mempool = String(systemHealth.mempool || '').toLowerCase();

  const failureRate = Number(recentTxStats.failureRate);
  const avgConfirmationTime = Number(recentTxStats.avgConfirmationTime);
  const recentFailures = Number(recentTxStats.recentFailures);

  let mode = SYSTEM_MODE.NORMAL_MODE;

  if (risk === 'high') {
    mode = SYSTEM_MODE.PROTECTION_MODE;
  }

  const slowConfirm =
    Number.isFinite(avgConfirmationTime) && avgConfirmationTime > AVG_CONFIRM_SLOW_MS;

  if (mempool === 'congested' || slowConfirm) {
    mode = maxModeBySeverity(mode, SYSTEM_MODE.DELAYED_MODE);
  }

  const rateHigh = Number.isFinite(failureRate) && failureRate > 0.1;
  const failureSpike =
    Number.isFinite(recentFailures) && recentFailures >= RECENT_FAILURE_SPIKE_THRESHOLD;

  if (rateHigh || failureSpike) {
    mode = maxModeBySeverity(mode, SYSTEM_MODE.CAUTION_MODE);
  }

  const fromQueue = modeFromQueueWaiting(queueWaiting);
  mode = maxModeBySeverity(mode, fromQueue);

  const fromConf = modeFromCongestionProbability(congestionProbability);
  mode = maxModeBySeverity(mode, fromConf);

  return mode;
}

/**
 * @param {object} input
 * @param {object} [input.systemHealth]
 * @param {object} [input.recentTxStats]
 * @param {number} [input.recentTxStats.failureRate] — 0…1
 * @param {number} [input.recentTxStats.avgConfirmationTime] — ms; NaN if unknown
 * @param {number} [input.recentTxStats.recentFailures] — failures in last N rows
 * @param {number} [input.queueWaiting] — server queue waiting jobs (optional)
 * @param {object} [input.confidence] — precomputed confidence; omit to derive internally
 * @returns {{
 *   mode: string,
 *   actions: { txSpeedMultiplier: number, queuePriorityStrategy: string, uiFeedbackLevel: string, retryPolicy: string },
 *   confidence: { congestionProbability: number, failureProbability: number, systemStressScore: number },
 * }}
 */
export function computeSystemMode(input = {}) {
  const qw = Number(input.queueWaiting) || 0;
  const rs = input.recentTxStats || {};
  const confidence =
    input.confidence ??
    computeSystemConfidence({
      queueWaiting: qw,
      avgConfirmationTime: rs.avgConfirmationTime,
      failureRate: rs.failureRate,
      systemHealth: input.systemHealth,
    });

  const mode = resolveSystemModeKey({
    ...input,
    queueWaiting: qw,
    congestionProbability: confidence.congestionProbability,
  });
  const baseActions = adaptationActionsForMode(mode);
  const tuned = refineActionsWithConfidence(baseActions, confidence);
  const actions = applyMetaConfidenceSafety(refineActionsWithExecutionStrategy(tuned));
  return {
    mode,
    actions,
    confidence,
  };
}

/** @deprecated Use `computeSystemMode` (same return shape). */
export const computeSystemModeWithActions = computeSystemMode;

/**
 * Map decision mode + raw health stress into a single idle-orbit tier (UI only).
 * @param {string} systemMode
 * @param {'healthy' | 'degraded' | 'medium' | 'high'} organStress
 */
export function resolveIdleVisualTier(systemMode, organStress = 'healthy') {
  if (systemMode === SYSTEM_MODE.PROTECTION_MODE) return 'protection';
  if (systemMode === SYSTEM_MODE.CAUTION_MODE) return 'caution';
  if (systemMode === SYSTEM_MODE.DELAYED_MODE) return 'delayed';
  if (organStress === 'high') return 'protection';
  if (organStress === 'medium') return 'caution';
  if (organStress === 'degraded') return 'delayed';
  return 'normal';
}
