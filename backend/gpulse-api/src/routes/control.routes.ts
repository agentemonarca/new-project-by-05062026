import { Router } from 'express';
import type { Logger } from 'pino';
import { executionState } from '../executionState.js';
import { schedulePushExecutionToGateway } from '../notifyGateway.js';
import { applyEngineControl } from '../engine/executionActions.js';

type Engine = (typeof executionState)['engine'];
type Strategy = (typeof executionState)['strategy'];

function ts() {
  return Date.now();
}

function fullStatus() {
  return {
    engine: executionState.engine,
    strategy: executionState.strategy,
    safeMode: executionState.safeMode,
    autoMode: executionState.autoMode,
    modelConfidence: executionState.modelConfidence,
    performanceTrend: executionState.performanceTrend,
    learningState: executionState.learningState,
  };
}

function okResponse(status: ReturnType<typeof fullStatus>) {
  return {
    success: true as const,
    status,
    timestamp: ts(),
  };
}

/**
 * Simulated execution plane: POST /control, /strategy, /safety, /auto — in-memory authoritative state.
 */
export function createControlRouter(logger: Logger): Router {
  const router = Router();

  router.post('/control', (req, res) => {
    const action = req.body?.action;
    if (action !== 'start' && action !== 'pause') {
      return res.status(400).json({ success: false, error: 'invalid_action', timestamp: ts() });
    }
    const applied = applyEngineControl(logger, action, 'http');
    if (!applied.ok) {
      return res.status(403).json({
        success: false,
        error: applied.error,
        timestamp: ts(),
      });
    }
    schedulePushExecutionToGateway(logger);
    return res.json(okResponse(fullStatus()));
  });

  router.post('/strategy', (req, res) => {
    const value = req.body?.value;
    if (!['speed', 'balanced', 'protection'].includes(value)) {
      return res.status(400).json({ success: false, error: 'invalid_strategy', timestamp: ts() });
    }
    executionState.strategy = value as Strategy;
    logger.info({ strategy: value }, 'gpulse.strategy');
    schedulePushExecutionToGateway(logger);
    return res.json(okResponse(fullStatus()));
  });

  router.post('/safety', (req, res) => {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'invalid_safety', timestamp: ts() });
    }
    executionState.safeMode = enabled;
    if (enabled && executionState.engine === 'running') {
      executionState.engine = 'paused';
      logger.info({}, 'gpulse.safety forced pause while enabling safe mode');
    }
    logger.info({ safeMode: enabled }, 'gpulse.safety');
    schedulePushExecutionToGateway(logger);
    return res.json(okResponse(fullStatus()));
  });

  router.post('/auto', (req, res) => {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'invalid_auto', timestamp: ts() });
    }
    executionState.autoMode = enabled;
    logger.info({ autoMode: enabled }, 'gpulse.auto');
    schedulePushExecutionToGateway(logger);
    return res.json(okResponse(fullStatus()));
  });

  return router;
}
