import type { Logger } from 'pino';
import { executionState, type DecisionHistoryEntry, type DecisionResult, type PerformanceTrend } from '../executionState.js';
import { scheduleGatewayEventPush, schedulePushExecutionToGateway } from '../notifyGateway.js';

const MAX_HISTORY = 64;
const LEARNING_ALPHA = Number(process.env.LEARNING_EMA_ALPHA ?? 0.2);

function clampConfidence(v: number): number {
  return Math.min(0.99, Math.max(0.2, v));
}

/** Random outcome biased toward wins when confidence is high. */
export function simulateOutcome(confidence: number): DecisionResult {
  const c = Math.min(1, Math.max(0, confidence));
  const r = Math.random();
  const pWin = 0.12 + c * 0.68;
  const pLoss = (1 - pWin) * 0.52;
  if (r < pWin) return 'win';
  if (r < pWin + pLoss) return 'loss';
  return 'neutral';
}

function resultScore(res: DecisionResult): number {
  if (res === 'win') return 1;
  if (res === 'loss') return 0;
  return 0.5;
}

function computePerformanceTrend(history: DecisionHistoryEntry[]): PerformanceTrend {
  const recent = history.slice(-8);
  if (recent.length < 4) return 'stable';
  const mid = Math.floor(recent.length / 2);
  const first = recent.slice(0, mid);
  const second = recent.slice(mid);
  const score = (h: DecisionHistoryEntry[]) =>
    h.reduce((acc, d) => acc + resultScore(d.result), 0) / Math.max(1, h.length);
  const delta = score(second) - score(first);
  if (delta > 0.08) return 'improving';
  if (delta < -0.08) return 'declining';
  return 'stable';
}

function confidenceToStrategy(c: number): 'speed' | 'balanced' | 'protection' {
  if (c < 0.6) return 'protection';
  if (c <= 0.8) return 'balanced';
  return 'speed';
}

export type LearningTickContext = {
  action: string;
  confidence: number;
};

/**
 * Record simulated outcome, apply EMA to modelConfidence, adapt strategy, push learning WS events.
 * Safe mode does not skip learning; auto engine execution is gated separately in the decision loop.
 */
export function runLearningAfterDecision(logger: Logger, ctx: LearningTickContext): void {
  const outcome = simulateOutcome(ctx.confidence);

  const entry: DecisionHistoryEntry = {
    action: ctx.action,
    confidence: ctx.confidence,
    result: outcome,
    timestamp: Date.now(),
  };
  executionState.decisionHistory.push(entry);
  while (executionState.decisionHistory.length > MAX_HISTORY) {
    executionState.decisionHistory.shift();
  }

  const alpha = Number.isFinite(LEARNING_ALPHA) ? Math.min(1, Math.max(0, LEARNING_ALPHA)) : 0.2;
  executionState.modelConfidence = clampConfidence(
    alpha * resultScore(outcome) + (1 - alpha) * executionState.modelConfidence,
  );

  executionState.performanceTrend = computePerformanceTrend(executionState.decisionHistory);
  executionState.learningState = outcome === 'neutral' ? 'calibrating' : 'tracking';

  const learningPayload = {
    modelConfidence: executionState.modelConfidence,
    performanceTrend: executionState.performanceTrend,
    strategy: executionState.strategy,
    learningState: executionState.learningState,
    lastOutcome: outcome,
  };

  scheduleGatewayEventPush(logger, 'gpulse:learning:update', learningPayload);

  const target = confidenceToStrategy(executionState.modelConfidence);
  if (target !== executionState.strategy) {
    const previousStrategy = executionState.strategy;
    executionState.strategy = target;
    logger.info({ from: previousStrategy, to: target }, 'learning.strategy_auto');
    scheduleGatewayEventPush(logger, 'gpulse:strategy:auto', {
      modelConfidence: executionState.modelConfidence,
      performanceTrend: executionState.performanceTrend,
      strategy: target,
      previousStrategy,
      learningState: executionState.learningState,
    });
    schedulePushExecutionToGateway(logger);
  }
}
