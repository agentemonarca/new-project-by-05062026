import { ALERT_TYPES } from '../store/useAlertStore.js';

/** Fase micro: ventana alrededor de la media → anticipación (solo WAITING_RESULT). */
export const INTELLIGENT_PHASE_READY_TO_RESOLVE = 'readyToResolve';

/** STREAM_DELAY_EXPECTED reciente como pista de espera saludable. */
const HINT_MAX_AGE_MS = 180_000;

/**
 * @param {Array<{ type?: string, mesa?: unknown, timestamp?: number, rawPayload?: unknown }>} alerts
 * @param {string | null | undefined} mesaId
 */
export function findActiveDelayExpectedHint(alerts, mesaId) {
  if (mesaId == null || !Array.isArray(alerts)) return null;
  const m = String(mesaId);
  const now = Date.now();
  for (const a of alerts) {
    if (a.type !== ALERT_TYPES.STREAM_DELAY_EXPECTED) continue;
    if (String(a.mesa ?? '') !== m) continue;
    const raw = a.rawPayload != null && typeof a.rawPayload === 'object' ? /** @type {Record<string, unknown>} */ (a.rawPayload) : null;
    if (raw?.kind != null && raw.kind !== 'STREAM_DELAY_EXPECTED_HINT') continue;
    const ts = typeof a.timestamp === 'number' ? a.timestamp : 0;
    if (now - ts > HINT_MAX_AGE_MS) continue;
    return { timestamp: ts, raw };
  }
  return null;
}

/**
 * UX cognitiva para espera del resultado (WAITING_RESULT / cierre) con STREAM_DELAY_EXPECTED y stats del wire.
 *
 * @param {{
 *   lifecycleState: string,
 *   mesaId: string | null,
 *   signalTs: number | null,
 *   now: number,
 *   avgDelayMs: number | null | undefined,
 *   deadlineMs: number | null | undefined,
 *   alerts: unknown[],
 * }} p
 */
export function computeIntelligentWaitingUx(p) {
  const waiting =
    p.lifecycleState === 'WAITING_RESULT' ||
    p.lifecycleState === 'BETTING_CLOSED' ||
    p.lifecycleState === 'SIGNAL_DETECTED';
  if (!waiting || p.mesaId == null || p.signalTs == null) {
    return {
      active: false,
      phase: 'off',
      delayExpectedHintActive: false,
      headline: null,
      secondary: null,
      statusLabel: null,
      surface: 'off',
      elapsedSec: 0,
      avgSec: null,
      deadlineSec: null,
    };
  }

  const elapsedMs = Math.max(0, p.now - p.signalTs);
  const elapsedSec = elapsedMs / 1000;
  const avgSec =
    typeof p.avgDelayMs === 'number' && Number.isFinite(p.avgDelayMs) && p.avgDelayMs > 0
      ? p.avgDelayMs / 1000
      : null;
  const deadlineSec =
    typeof p.deadlineMs === 'number' && Number.isFinite(p.deadlineMs) && p.deadlineMs > 0
      ? p.deadlineMs / 1000
      : 60;

  const hint = findActiveDelayExpectedHint(p.alerts, p.mesaId);
  const delayExpectedHintActive = hint != null;

  if (elapsedSec >= deadlineSec * 0.92) {
    return {
      active: true,
      phase: 'escalate',
      delayExpectedHintActive,
      headline: 'Última etapa de espera del stream…',
      secondary:
        'Superando el tiempo habitual consolidado para esta mesa. El laboratorio sigue escuchando el proveedor; si no hay cierre en breve, se aplicará la regla de tiempo máximo.',
      statusLabel: 'VIGILANCIA',
      surface: 'escalate',
      elapsedSec,
      avgSec,
      deadlineSec,
    };
  }

  if (avgSec != null && elapsedSec > avgSec + 12) {
    return {
      active: true,
      phase: 'watch',
      delayExpectedHintActive,
      headline: 'La jugada sigue en curso…',
      secondary:
        'Resultado esperado en breve. El retardo supera un poco la media histórica; el flujo del stream sigue siendo la referencia.',
      statusLabel: 'STABLE',
      surface: 'watch',
      elapsedSec,
      avgSec,
      deadlineSec,
    };
  }

  /**
   * READY_TO_RESOLVE: elapsed ∈ [0.95×avg, 1.2×avg] ms, solo WAITING_RESULT.
   * Anticipación: el sistema sitúa el “momento previo” al resultado sin confundir con error.
   */
  if (
    (p.lifecycleState === 'WAITING_RESULT' || p.lifecycleState === 'SIGNAL_DETECTED') &&
    typeof p.avgDelayMs === 'number' &&
    Number.isFinite(p.avgDelayMs) &&
    p.avgDelayMs > 0
  ) {
    const lowMs = p.avgDelayMs * 0.95;
    const highMs = p.avgDelayMs * 1.2;
    /** Sin solapar con escalate (última etapa): transición estable hacia RESULT_RECEIVED. */
    if (elapsedMs >= lowMs && elapsedMs <= highMs && elapsedSec < deadlineSec * 0.92) {
      return {
        active: true,
        phase: INTELLIGENT_PHASE_READY_TO_RESOLVE,
        delayExpectedHintActive,
        headline: 'El desenlace es inminente…',
        secondary: 'La mesa está por revelar el resultado…',
        statusLabel: 'DESENLACE INMINENTE',
        surface: 'ready',
        elapsedSec,
        avgSec,
        deadlineSec,
      };
    }
  }

  if (delayExpectedHintActive || (avgSec != null && elapsedSec >= avgSec * 0.85)) {
    return {
      active: true,
      phase: 'stable',
      delayExpectedHintActive,
      headline: 'La jugada sigue en curso…',
      secondary: 'El flujo del proveedor es estable dentro del historial de esta mesa. Resultado esperado en breve…',
      statusLabel: 'STABLE',
      surface: 'stable',
      elapsedSec,
      avgSec,
      deadlineSec,
    };
  }

  return {
    active: true,
    phase: 'early',
    delayExpectedHintActive,
    headline: 'Observando el proveedor… el flujo sigue activo.',
    secondary: null,
    statusLabel: 'NORMAL',
    surface: 'observing',
    elapsedSec,
    avgSec,
    deadlineSec,
  };
}
