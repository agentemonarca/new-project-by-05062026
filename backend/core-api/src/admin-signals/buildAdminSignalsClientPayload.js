import {
  normalizeNewSignalPayload,
  normalizeNewResultPayload,
  readNestedDataSignal,
} from './signalNormalize.js';
import { extractMesaInfoFromPayload } from './signalSessionCanonical.js';

/**
 * `data.data.results.mesa_info` (Winxplay y análogos) → objeto para cliente.
 * @param {unknown} rawPayload
 * @returns {Record<string, unknown> | null}
 */
function extractScoreDetailFromNested(rawPayload) {
  const mi = extractMesaInfoFromPayload(rawPayload);
  if (!mi) return null;
  return {
    puntaje_player: mi.puntaje_player,
    puntaje_banker: mi.puntaje_banker,
    cartas_player: mi.cartas_player,
    cartas_banker: mi.cartas_banker,
    ganador: mi.ganador,
    tablero: mi.tablero,
    martingala: mi.martingala,
  };
}

/**
 * Misma normalización que `createSignalsProcessor` → el cliente recibe lo coherente
 * con stats/Mongo aunque el proveedor use aliases o `dashboardUpdate` anidado.
 *
 * @param {'NEW_SIGNAL' | 'NEW_RESULT'} type
 * @param {unknown} rawPayload — cuerpo crudo del upstream / HTTP
 * @returns {Record<string, unknown> | null}
 */
export function buildAdminSignalsClientPayload(type, rawPayload) {
  if (type === 'NEW_SIGNAL') {
    const n = normalizeNewSignalPayload(rawPayload);
    const r =
      rawPayload != null && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
        ? /** @type {Record<string, unknown>} */ (rawPayload)
        : {};
    const { sig } = readNestedDataSignal(r);
    /** @type {Record<string, unknown>} */
    const out = {
      mesa: n.mesa,
      round: n.round,
      martingale: n.martingale,
      recommendation: n.recommendation,
      correlationKey: n.correlationKey,
      id: n.providerSignalId,
    };
    if (sig?.nombre_algoritmo != null && String(sig.nombre_algoritmo).trim() !== '') {
      out.nombre_algoritmo = String(sig.nombre_algoritmo).trim();
    }
    if (Array.isArray(sig?.vector_forecast) && sig.vector_forecast.length > 0) {
      out.vector_forecast = sig.vector_forecast;
    }
    return out;
  }
  if (type === 'NEW_RESULT') {
    const n = normalizeNewResultPayload(rawPayload);
    const r =
      rawPayload != null && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
        ? /** @type {Record<string, unknown>} */ (rawPayload)
        : {};
    const historial = Array.isArray(r.historial) ? r.historial : Array.isArray(r.history) ? r.history : [];
    const embedded = r.scoreDetail && typeof r.scoreDetail === 'object' ? r.scoreDetail : null;
    const fromNested = extractScoreDetailFromNested(rawPayload);
    const scoreDetail =
      embedded && fromNested
        ? { .../** @type {Record<string, unknown>} */ (embedded), ...fromNested }
        : embedded ?? fromNested;
    const ganador =
      (scoreDetail &&
      typeof scoreDetail === 'object' &&
      'ganador' in scoreDetail &&
      scoreDetail.ganador != null
        ? String(scoreDetail.ganador)
        : null) ??
      r.ganador ??
      r.resultado ??
      r.result;
    return {
      mesa: n.mesa,
      round: n.round,
      winStatus: n.winStatus,
      correlationKey: n.correlationKey,
      ganador,
      historial,
      scoreDetail: scoreDetail && typeof scoreDetail === 'object' ? scoreDetail : undefined,
    };
  }
  return null;
}
