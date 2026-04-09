import { getSignalMiddlewareSnapshot } from '../middleware/useSignalMiddleware.js';
import { streamPairStatusForKey, validationEnabled } from '../store/useValidationStore.js';

/**
 * Enriquece contexto en tiempo de lectura (evita ciclos con useAlertStore).
 * @param {{ mesa?: unknown, round?: unknown, context?: object }} alert
 */
export function enrichAlertForDisplay(alert) {
  const base = alert?.context && typeof alert.context === 'object' ? { ...alert.context } : {};
  const ck =
    base.correlationKey != null && String(base.correlationKey).trim() !== ''
      ? String(base.correlationKey).trim()
      : alert?.mesa != null && alert?.round != null
        ? `${String(alert.mesa)}|${String(alert.round)}`
        : null;

  let stream = { signalExists: false, resultExists: false };
  if (ck) {
    stream = streamPairStatusForKey(ck);
  }

  let mw = null;
  try {
    mw = getSignalMiddlewareSnapshot();
  } catch {
    mw = null;
  }

  return {
    ...base,
    correlationKey: ck ?? base.correlationKey ?? null,
    signalExists: base.signalExists ?? stream.signalExists,
    resultExists: base.resultExists ?? stream.resultExists,
    middlewareState: base.middlewareState ?? mw,
    validationState: {
      enabled: validationEnabled,
      ...(typeof base.validationState === 'object' && base.validationState != null ? base.validationState : {}),
    },
  };
}
