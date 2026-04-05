import { actionRegistry } from './actionRegistry.js';

/**
 * Execute a single action using the registry.
 *
 * Observability:
 * - Logs every attempted execution via ctx.onActionLog (if provided)
 * - Warns on unknown action types
 *
 * Safety:
 * - Skips execution when ctx.isActive is false
 *
 * Debug:
 * - When ctx.debug is true, emits console debug/warn messages
 */
export function runAction(action, ctx) {
  if (!action || !action.type) return;
  const timestamp = Date.now();
  const phase = String(ctx?.phase ?? '');
  const known = typeof actionRegistry[action.type] === 'function';
  const active = ctx?.isActive !== false;
  const skippedInactive = ctx?.isActive === false;
  const payload = action && typeof action === 'object' && 'payload' in action ? action.payload : undefined;
  const at = action && typeof action === 'object' && 'at' in action ? action.at : undefined;

  // Always emit a trace entry if an observer exists.
  try {
    ctx?.onActionLog?.({
      type: String(action.type),
      phase,
      timestamp,
      known,
      active,
      skippedInactive,
      at,
      payload,
    });
  } catch (_e) {}

  // Safety guard (no side effects if system isn't active).
  if (ctx?.isActive === false) {
    if (ctx?.debug) {
      // eslint-disable-next-line no-console
      console.debug('[actions] skipped (inactive)', { type: action.type, phase, timestamp });
    }
    return;
  }

  const handler = actionRegistry[action.type];
  if (typeof handler !== 'function') {
    // eslint-disable-next-line no-console
    console.warn('[actions] unknown action type', { type: action.type, phase, timestamp });
    return;
  }
  try {
    handler(action, ctx);
    if (ctx?.debug) {
      // eslint-disable-next-line no-console
      console.debug('[actions] executed', { type: action.type, phase, timestamp, at: action.at });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[actions] handler error', { type: action.type, phase, timestamp, error: e });
  }
}

