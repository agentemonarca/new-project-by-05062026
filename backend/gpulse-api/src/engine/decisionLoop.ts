import type { Logger } from 'pino';
import { executionState } from '../executionState.js';
import { scheduleAiDecisionBroadcast, schedulePushExecutionToGateway } from '../notifyGateway.js';
import { applyEngineControl } from './executionActions.js';
import { runLearningAfterDecision } from './learning.js';

/** 3–5s cadence (spec); fixed interval within band. */
const TICK_MS = 4000;

type AiAction = 'start' | 'pause' | 'hold';

/**
 * Mock AI: under speed + !safeMode → recommends start | pause; always emits gpulse:ai:decision.
 * Auto-execution only if autoMode && !safeMode, via applyEngineControl (same as /control).
 */
function tick(logger: Logger) {
  const speed = executionState.strategy === 'speed';
  const safe = executionState.safeMode;

  let decisionAction: AiAction;
  let reason: string;
  let confidence = 0.6 + Math.random() * 0.3;
  confidence = Math.min(0.95, (confidence + executionState.modelConfidence) / 2);

  if (!speed) {
    decisionAction = 'hold';
    reason = 'Strategy is not speed — no engine start/pause recommendation this tick';
    confidence = executionState.modelConfidence * 0.88;
  } else if (safe) {
    if (executionState.engine === 'running') {
      decisionAction = 'pause';
      reason = 'Safe mode ON — suggest pause (autonomous execution disabled)';
    } else {
      decisionAction = 'hold';
      reason = 'Safe mode ON — suggest hold; autonomous start blocked';
    }
    confidence = executionState.modelConfidence * 0.72;
  } else {
    if (executionState.engine === 'idle') {
      decisionAction = 'start';
      reason = 'Speed strategy, risk gates clear — suggest start';
    } else if (executionState.engine === 'running') {
      decisionAction = Math.random() < 0.3 ? 'pause' : 'start';
      reason =
        decisionAction === 'pause'
          ? 'Speed strategy — suggest pause (window tightening, mock)'
          : 'Speed strategy — suggest continue run';
    } else {
      decisionAction = 'start';
      reason = 'Speed strategy — engine paused; suggest resume';
    }
  }

  scheduleAiDecisionBroadcast(logger, {
    action: decisionAction,
    confidence,
    reason,
    timestamp: Date.now(),
  });

  runLearningAfterDecision(logger, { action: decisionAction, confidence });

  const allowAuto = executionState.autoMode && !safe;
  if (!allowAuto || decisionAction === 'hold') {
    return;
  }

  const r = applyEngineControl(logger, decisionAction, 'auto');
  if (r.ok) {
    schedulePushExecutionToGateway(logger);
  }
}

export function startDecisionLoop(logger: Logger): void {
  setInterval(() => {
    try {
      tick(logger);
    } catch (err) {
      logger.error({ err }, 'decisionLoop.tick_error');
    }
  }, TICK_MS);
  logger.info({ tickMs: TICK_MS }, 'decisionLoop.started');
}
