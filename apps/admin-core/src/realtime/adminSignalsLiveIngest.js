import {
  ADMIN_SIGNALS_STRICT_MODE,
  computeResultRowIncomplete,
  computeSignalRowIncomplete,
  validateResult,
  validateSignal,
} from '../utils/adminSignalPayloadValidators.js';
import { isAdminRawMode } from '../utils/adminRawMode.js';
import { isCanonicalModeEnabled } from '@/utils/canonicalFlowFlags.js';
import { applyCanonicalModeToPayload, logCanonicalAudit } from '@/utils/extractCanonicalFields.js';
import { formatResult, formatSignal } from '../utils/signalFormatter.js';
import { auditMesaRoundCorrelationKey } from './correlationKeyAudit.js';

const PREVIEW_MAX = 1800;

function shouldLogEventFlow() {
  if (typeof process !== 'undefined' && process.env.VITEST === 'true') return false;
  return import.meta.env.DEV === true || import.meta.env.VITE_ADMIN_EVENT_FLOW === '1';
}

/**
 * @param {'SIGNAL' | 'RESULT'} kind
 * @param {unknown} payload
 */
function warnMissingFieldsButAccepted(kind, payload) {
  if (!isAdminRawMode()) return;
  const p =
    payload != null && typeof payload === 'object' && !Array.isArray(payload)
      ? /** @type {Record<string, unknown>} */ (payload)
      : null;
  if (!p) {
    console.warn('MISSING FIELD BUT ACCEPTED', { kind, note: 'non-object payload', payload });
    return;
  }
  const missing = [];
  const mesa = p.mesa ?? p.nombre_mesa ?? p.tableName;
  if (mesa == null || String(mesa).trim() === '') missing.push('mesa');
  const round = p.round ?? p.ronda ?? p.ronda_actual ?? p.Ronda ?? p.ronda_objetivo;
  if (round == null || String(round).trim() === '') missing.push('round');
  const hasCk = p.correlationKey != null && String(p.correlationKey).trim() !== '';
  const hasId = p.id != null && String(p.id).trim() !== '';
  const hasSigId = p.signalId != null && String(p.signalId).trim() !== '';
  if (kind === 'SIGNAL' && missing.includes('round') && !hasCk && !hasId && !hasSigId) {
    missing.push('correlationKey|id|signalId');
  }
  if (kind === 'RESULT' && p.mesa_info == null && p.scoreDetail == null && p.ganador == null) {
    missing.push('mesa_info|scoreDetail|ganador');
  }
  if (missing.length === 0) return;
  console.warn('MISSING FIELD BUT ACCEPTED', { kind, missing, payload: p });
}

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
  if (isAdminRawMode()) {
    console.log('[RAW_SIGNAL]', row);
    warnMissingFieldsButAccepted('SIGNAL', r);
  }
  logCanonicalAudit(r, 'ingest:SIGNAL');
  const { payload: rowForFormat, canonical: canonIngestSig } = applyCanonicalModeToPayload(r);
  if (isCanonicalModeEnabled() && (!canonIngestSig.round || !canonIngestSig.direction)) {
    rowForFormat._incomplete = true;
  }
  const formatted = { ...formatSignal(rowForFormat), recvId };
  if (rowForFormat._incomplete === true) formatted._incomplete = true;
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

  formatted.isIncomplete = computeSignalRowIncomplete(formatted);
  if (shouldLogEventFlow()) {
    console.log('[EVENT_FLOW]', {
      kind: 'SIGNAL',
      mesa: formatted.mesa,
      round: formatted.round,
      correlationKey: formatted.correlationKey,
      incomplete: formatted.isIncomplete,
    });
  }

  if (strictOk) {
    formatted.ingestTs = Date.now();
    if (!isAdminRawMode()) {
      const ckAudit = auditMesaRoundCorrelationKey(formatted);
      if (!ckAudit.ok) {
        console.warn('CK DESALINEADO', { kind: 'SIGNAL', correlationKey: ckAudit.actual, expected: ckAudit.expected });
      }
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
  if (isAdminRawMode()) {
    console.log('[RAW_RESULT]', row);
    warnMissingFieldsButAccepted('RESULT', r);
  }
  logCanonicalAudit(r, 'ingest:RESULT');
  const { payload: rowForFormat, canonical: canonIngestRes } = applyCanonicalModeToPayload(r);
  if (isCanonicalModeEnabled() && (!canonIngestRes.round || !canonIngestRes.result)) {
    rowForFormat._incomplete = true;
  }
  const formatted = { ...formatResult(rowForFormat, predicted), recvId };
  if (rowForFormat._incomplete === true) formatted._incomplete = true;
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

  formatted.isIncomplete = computeResultRowIncomplete(formatted);
  if (shouldLogEventFlow()) {
    console.log('[EVENT_FLOW]', {
      kind: 'RESULT',
      mesa: formatted.mesa,
      round: formatted.round,
      correlationKey: formatted.correlationKey,
      incomplete: formatted.isIncomplete,
    });
  }

  if (strictOk) {
    formatted.ingestTs = Date.now();
    if (!isAdminRawMode()) {
      const ckAudit = auditMesaRoundCorrelationKey(formatted);
      if (!ckAudit.ok) {
        console.warn('CK DESALINEADO', { kind: 'RESULT', correlationKey: ckAudit.actual, expected: ckAudit.expected });
      }
    }
  }

  return { formatted, strictOk, rejectReason };
}
