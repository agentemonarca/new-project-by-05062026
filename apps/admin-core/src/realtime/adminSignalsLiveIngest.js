import {
  ADMIN_SIGNALS_STRICT_MODE,
  validateResult,
  validateSignal,
} from '../utils/adminSignalPayloadValidators.js';
import { formatResult, formatSignal } from '../utils/signalFormatter.js';
import { auditMesaRoundCorrelationKey } from './correlationKeyAudit.js';

const PREVIEW_MAX = 1800;

/** @param {unknown} obj */
export function payloadPreviewForLive(obj, max = PREVIEW_MAX) {
  try {
    const s = JSON.stringify(obj);
    return s.length > max ? `${s.slice(0, max)}\n… [truncated]` : s;
  } catch {
    return String(obj).slice(0, max);
  }
}

/**
 * Misma fila que el socket `NEW_SIGNAL` terminaría evaluando (formato + previews + listo para validar).
 * @param {unknown} row
 * @param {string} recvId
 */
export function createLiveSignalEntry(row, recvId) {
  const r = row && typeof row === 'object' ? /** @type {Record<string, unknown>} */ (row) : {};
  const formatted = { ...formatSignal(r), recvId };
  formatted.providerRawPreview = payloadPreviewForLive(r);
  formatted.normalizedPreview = payloadPreviewForLive({
    mesa: formatted.mesa,
    recommendation: formatted.recommendation,
    martingale: formatted.martingale,
    classification: formatted.classification,
    round: formatted.round,
    id: formatted.id,
    correlationKey: formatted.correlationKey,
    timestamp: formatted.timestamp,
  });

  const validation = validateSignal(formatted);
  const strictOk = !ADMIN_SIGNALS_STRICT_MODE || validation.ok;
  const rejectReason = validation.ok ? undefined : validation.reason;

  if (strictOk) {
    formatted.ingestTs = Date.now();
    const ckAudit = auditMesaRoundCorrelationKey(formatted);
    if (!ckAudit.ok) {
      console.warn('CK DESALINEADO', { kind: 'SIGNAL', correlationKey: ckAudit.actual, expected: ckAudit.expected });
    }
  }

  return { formatted, strictOk, rejectReason };
}

/**
 * @param {unknown} row
 * @param {string | null | undefined} predicted — última predicción PLAYER/BANKER (como `adminSignalsPredictionByMesa`)
 * @param {string} recvId
 */
export function createLiveResultEntry(row, predicted, recvId) {
  const r = row && typeof row === 'object' ? /** @type {Record<string, unknown>} */ (row) : {};
  const formatted = { ...formatResult(r, predicted), recvId };
  formatted.providerRawPreview = payloadPreviewForLive(r);
  formatted.normalizedPreview = payloadPreviewForLive({
    mesa: formatted.mesa,
    ganador: formatted.ganador,
    winStatus: formatted.winStatus,
    outcome: formatted.outcome,
    round: formatted.round,
    historial: formatted.historial,
    correlationKey: formatted.correlationKey,
    signalId: formatted.signalId,
    verdict: formatted.verdict,
    versus: formatted.versus,
  });

  const validation = validateResult(formatted);
  const strictOk = !ADMIN_SIGNALS_STRICT_MODE || validation.ok;
  const rejectReason = validation.ok ? undefined : validation.reason;

  if (strictOk) {
    formatted.ingestTs = Date.now();
    const ckAudit = auditMesaRoundCorrelationKey(formatted);
    if (!ckAudit.ok) {
      console.warn('CK DESALINEADO', { kind: 'RESULT', correlationKey: ckAudit.actual, expected: ckAudit.expected });
    }
  }

  return { formatted, strictOk, rejectReason };
}
