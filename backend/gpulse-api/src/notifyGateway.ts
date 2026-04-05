import type { Logger } from 'pino';
import { executionState } from './executionState.js';

function engineToStatus(): 'idle' | 'running' | 'paused' {
  return executionState.engine;
}

function postToGateway(
  logger: Logger,
  type: string,
  payload: Record<string, unknown>,
  logKey: 'ws_push' | 'ai_push' | 'event_push',
): void {
  const url = process.env.GATEWAY_WS_PUSH_URL || 'http://127.0.0.1:4000/internal/gpulse/push';
  const secret = process.env.INTERNAL_WS_PUSH_SECRET || '';

  queueMicrotask(() => {
    void (async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (secret) headers['X-Internal-Secret'] = secret;
        const r = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ type, payload }),
        });
        if (!r.ok) logger.warn({ status: r.status, type }, `gateway.${logKey}_non_ok`);
      } catch (err) {
        logger.warn({ err, type }, `gateway.${logKey}_failed`);
      }
    })();
  });
}

/**
 * Fire-and-forget: notify api-gateway so it can broadcast gpulse:update to WebSocket clients.
 */
export function schedulePushExecutionToGateway(logger: Logger): void {
  const timestamp = Date.now();
  const payload = {
    status: engineToStatus(),
    strategy: executionState.strategy,
    safeMode: executionState.safeMode,
    autoMode: executionState.autoMode,
    modelConfidence: executionState.modelConfidence,
    timestamp,
    performanceTrend: executionState.performanceTrend,
    learningState: executionState.learningState,
  };

  postToGateway(logger, 'gpulse:update', payload, 'ws_push');
}

export type AiDecisionPayload = {
  action: string;
  confidence: number;
  reason: string;
  timestamp: number;
};

/** Broadcast mock AI decision to WebSocket clients (does not mutate execution state). */
export function scheduleAiDecisionBroadcast(logger: Logger, payload: AiDecisionPayload): void {
  postToGateway(logger, 'gpulse:ai:decision', payload as unknown as Record<string, unknown>, 'ai_push');
}

/** Generic internal push (learning, strategy auto, …). */
export function scheduleGatewayEventPush(
  logger: Logger,
  type: string,
  payload: Record<string, unknown>,
): void {
  postToGateway(logger, type, payload, 'event_push');
}
