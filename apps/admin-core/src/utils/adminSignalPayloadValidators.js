import {
  extractRoundFromLabeledCorrelationKey,
  extractRoundFromPipeCorrelationKey,
  isContractInvalidMesa,
} from './signalFormatter.js';
import { normalizeCorrelationKey } from '../realtime/correlationKeyNormalize.js';
import { isEpochMsCorrelationId } from './buildSafeCorrelationKey.js';

/**
 * CK estilo servidor `mesa|roundId` (último `|`), no `id:` ni placeholder `…|-` del formatter.
 * @param {string} ck
 */
export function looksLikeServerMesaRoundPipe(ck) {
  const s = String(ck ?? '').trim();
  if (!s.includes('|') || s.startsWith('id:')) return false;
  const i = s.lastIndexOf('|');
  const roundPart = s.slice(i + 1).trim();
  if (roundPart === '' || roundPart === '-') return false;
  const n = Number(roundPart);
  return Number.isFinite(n) && n > 0 && n <= 1_000_000_000;
}

/**
 * Contrato histórico: `VITE_ADMIN_SIGNALS_STRICT=0` desactivaba el “modo estricto” del store.
 * La validación ya no rechaza filas; solo registra incompletos. Se mantiene el export por compatibilidad.
 */
export const ADMIN_SIGNALS_STRICT_MODE =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  /** @type {Record<string, string | undefined>} */ (import.meta.env).VITE_ADMIN_SIGNALS_STRICT === '0'
    ? false
    : true;

/** @typedef {{ ok: true } | { ok: false, reason: string }} ValidationResult */

/**
 * Fila ya formateada: ¿falta ronda correlacionable o dirección jugable?
 * @param {Record<string, unknown> | null | undefined} s
 */
export function computeSignalRowIncomplete(s) {
  if (s == null || typeof s !== 'object') return true;
  const o = /** @type {Record<string, unknown>} */ (s);
  const ck = String(o.correlationKey ?? '').trim();
  const ckNorm = normalizeCorrelationKey(ck) ?? ck;
  const roundOk = typeof o.round === 'number' && Number.isFinite(o.round) && o.round > 0;
  const stableIdCk = ck.startsWith('id:') && !isEpochMsCorrelationId(ck.slice(3));
  const roundFromCk =
    extractRoundFromLabeledCorrelationKey(ck) ??
    extractRoundFromPipeCorrelationKey(ck) ??
    extractRoundFromLabeledCorrelationKey(ckNorm) ??
    extractRoundFromPipeCorrelationKey(ckNorm);
  const hasRoundPath =
    roundOk ||
    stableIdCk ||
    looksLikeServerMesaRoundPipe(ck) ||
    looksLikeServerMesaRoundPipe(ckNorm) ||
    (roundFromCk != null && roundFromCk !== '');
  const rec = String(o.recommendation ?? o.predictionLabel ?? '')
    .trim()
    .toUpperCase();
  const f0 =
    Array.isArray(o.forecast6) && o.forecast6.length > 0 ? String(o.forecast6[0] ?? '').trim().toUpperCase() : '';
  const hasDirFromForecast =
    f0 === 'P' ||
    f0 === 'B' ||
    f0 === 'T' ||
    f0.startsWith('PLAY') ||
    f0.startsWith('BANK');
  const hasDir =
    rec === 'PLAYER' ||
    rec === 'BANKER' ||
    rec === 'TIE' ||
    rec === 'P' ||
    rec === 'B' ||
    rec === 'T' ||
    hasDirFromForecast;
  return !hasRoundPath || !hasDir;
}

/**
 * @param {Record<string, unknown> | null | undefined} r
 */
export function computeResultRowIncomplete(r) {
  if (r == null || typeof r !== 'object') return true;
  const o = /** @type {Record<string, unknown>} */ (r);
  const roundOk = typeof o.round === 'number' && Number.isFinite(o.round) && o.round > 0;
  const mi = o.mesa_info;
  const miObj =
    mi != null && typeof mi === 'object' && !Array.isArray(mi) ? /** @type {Record<string, unknown>} */ (mi) : null;
  const sd = o.scoreDetail != null && typeof o.scoreDetail === 'object' ? /** @type {Record<string, unknown>} */ (o.scoreDetail) : null;
  const ganadorStr =
    (miObj && typeof miObj.ganador === 'string' ? miObj.ganador : '') ||
    (sd && typeof sd.ganador === 'string' ? sd.ganador : '') ||
    (typeof o.ganador === 'string' ? o.ganador : '');
  const hasGanador = ganadorStr.trim() !== '' && ganadorStr.trim() !== '—';
  return !roundOk || miObj == null || !hasGanador;
}

/**
 * No bloquea ingesta: siempre `{ ok: true }` y `console.warn` con prefijos `[INCOMPLETE_*]`.
 *
 * @param {unknown} signal — fila ya pasada por `formatSignal` (+ recvId opcional).
 * @returns {ValidationResult}
 */
export function validateSignal(signal) {
  if (signal == null || typeof signal !== 'object') {
    console.warn('[INCOMPLETE_SIGNAL_NOT_OBJECT]', signal);
    return { ok: true };
  }
  const s = /** @type {Record<string, unknown>} */ (signal);
  if (typeof s.mesa !== 'string') {
    console.warn('[INCOMPLETE_SIGNAL_NO_MESA]', s);
  } else if (isContractInvalidMesa(s.mesa)) {
    console.warn('[INCOMPLETE_SIGNAL_INVALID_MESA]', { mesa: s.mesa, payload: s });
  }

  const ck = String(s.correlationKey ?? '').trim();
  const correlatesById = ck.startsWith('id:') && !isEpochMsCorrelationId(ck.slice(3));
  const serverPipeKey = looksLikeServerMesaRoundPipe(ck);
  const roundOk = typeof s.round === 'number' && Number.isFinite(s.round) && s.round > 0;
  if (!roundOk && !correlatesById && !serverPipeKey) {
    console.warn('[INCOMPLETE_SIGNAL_NO_ROUND]', s);
  }
  if ((correlatesById || serverPipeKey) && !roundOk && import.meta.env.VITE_ALLOW_ID_NO_ROUND_LOG === '1') {
    console.log('[ALLOW_ID_NO_ROUND]', ck);
  }
  if (!Array.isArray(s.forecast6) || s.forecast6.length !== 6) {
    console.warn('[INCOMPLETE_SIGNAL_FORECAST6]', s);
  }
  return { ok: true };
}

/**
 * No bloquea ingesta: siempre `{ ok: true }` y warns etiquetados.
 *
 * @param {unknown} result — fila ya pasada por `formatResult` (+ recvId opcional).
 * @returns {ValidationResult}
 */
export function validateResult(result) {
  if (result == null || typeof result !== 'object') {
    console.warn('[INCOMPLETE_RESULT_NOT_OBJECT]', result);
    return { ok: true };
  }
  const r = /** @type {Record<string, unknown>} */ (result);
  if (typeof r.mesa !== 'string') {
    console.warn('[INCOMPLETE_RESULT_NO_MESA]', r);
  } else if (isContractInvalidMesa(r.mesa)) {
    console.warn('[INCOMPLETE_RESULT_INVALID_MESA]', { mesa: r.mesa, payload: r });
  }
  if (typeof r.round !== 'number' || !Number.isFinite(r.round) || r.round <= 0) {
    console.warn('[INCOMPLETE_RESULT_NO_ROUND]', r);
  }

  const mi = r.mesa_info;
  const miObj =
    mi != null && typeof mi === 'object' && !Array.isArray(mi) ? /** @type {Record<string, unknown>} */ (mi) : null;
  if (miObj == null) {
    console.warn('[INCOMPLETE_RESULT_NO_MESA_INFO]', r);
  } else {
    if (!Array.isArray(miObj.cartas_player) || !Array.isArray(miObj.cartas_banker)) {
      console.warn('[INCOMPLETE_RESULT_INVALID_CARTAS]', r);
    }
    if (typeof miObj.ganador !== 'string' || miObj.ganador.trim() === '') {
      console.warn('[INCOMPLETE_RESULT_NO_GANADOR]', r);
    }
  }
  return { ok: true };
}
