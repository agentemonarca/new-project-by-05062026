import type { Logger } from 'pino';
import { executionState } from '../executionState.js';

/**
 * Same execution mutation as POST /control (used by HTTP routes and autonomous loop).
 */
export function applyEngineControl(
  logger: Logger,
  action: 'start' | 'pause',
  source: 'http' | 'auto',
): { ok: true } | { ok: false; error: string } {
  if (action === 'start' && executionState.safeMode) {
    logger.warn({ action, source }, 'engine.control blocked_by_safe_mode');
    return { ok: false, error: 'safe_mode_blocks_start' };
  }
  executionState.engine = action === 'start' ? 'running' : 'paused';
  logger.info({ action, engine: executionState.engine, source }, 'engine.control');
  return { ok: true };
}
