import { isContractInvalidMesa } from './signalFormatter.js';

/**
 * Contrato store en vivo: rechazar payloads mal formados antes de unshift.
 * Desactivar con `VITE_ADMIN_SIGNALS_STRICT=0` (solo entornos de depuración).
 */
export const ADMIN_SIGNALS_STRICT_MODE =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  /** @type {Record<string, string | undefined>} */ (import.meta.env).VITE_ADMIN_SIGNALS_STRICT === '0'
    ? false
    : true;

/** @typedef {{ ok: true } | { ok: false, reason: string }} ValidationResult */

/**
 * @param {unknown} signal — fila ya pasada por `formatSignal` (+ recvId opcional).
 * @returns {ValidationResult}
 */
export function validateSignal(signal) {
  if (signal == null || typeof signal !== 'object') return { ok: false, reason: 'NOT_OBJECT' };
  const s = /** @type {Record<string, unknown>} */ (signal);
  if (typeof s.mesa !== 'string') return { ok: false, reason: 'NO_MESA' };
  if (isContractInvalidMesa(s.mesa)) return { ok: false, reason: 'INVALID_MESA' };
  if (typeof s.round !== 'number' || !Number.isFinite(s.round) || s.round <= 0) return { ok: false, reason: 'INVALID_ROUND' };
  if (!Array.isArray(s.forecast6) || s.forecast6.length !== 6) return { ok: false, reason: 'INVALID_FORECAST6' };
  return { ok: true };
}

/**
 * @param {unknown} result — fila ya pasada por `formatResult` (+ recvId opcional).
 * @returns {ValidationResult}
 */
export function validateResult(result) {
  if (result == null || typeof result !== 'object') return { ok: false, reason: 'NOT_OBJECT' };
  const r = /** @type {Record<string, unknown>} */ (result);
  if (typeof r.mesa !== 'string') return { ok: false, reason: 'NO_MESA' };
  if (isContractInvalidMesa(r.mesa)) return { ok: false, reason: 'INVALID_MESA' };
  if (typeof r.round !== 'number' || !Number.isFinite(r.round) || r.round <= 0) return { ok: false, reason: 'INVALID_ROUND' };
  const mi = r.mesa_info;
  if (mi == null || typeof mi !== 'object' || Array.isArray(mi)) return { ok: false, reason: 'NO_MESA_INFO' };
  const m = /** @type {Record<string, unknown>} */ (mi);
  if (!Array.isArray(m.cartas_player) || !Array.isArray(m.cartas_banker)) return { ok: false, reason: 'INVALID_CARTAS' };
  if (typeof m.ganador !== 'string' || m.ganador.trim() === '') return { ok: false, reason: 'NO_GANADOR' };
  return { ok: true };
}
