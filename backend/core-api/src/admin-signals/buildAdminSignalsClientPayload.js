import { normalizeNewSignalPayload, normalizeNewResultPayload } from './signalNormalize.js';

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
    return {
      mesa: n.mesa,
      round: n.round,
      martingale: n.martingale,
      recommendation: n.recommendation,
      correlationKey: n.correlationKey,
      id: n.providerSignalId,
    };
  }
  if (type === 'NEW_RESULT') {
    const n = normalizeNewResultPayload(rawPayload);
    const r =
      rawPayload != null && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
        ? /** @type {Record<string, unknown>} */ (rawPayload)
        : {};
    const historial = Array.isArray(r.historial) ? r.historial : Array.isArray(r.history) ? r.history : [];
    const ganador = r.ganador ?? r.resultado ?? r.result;
    return {
      mesa: n.mesa,
      round: n.round,
      winStatus: n.winStatus,
      correlationKey: n.correlationKey,
      ganador,
      historial,
    };
  }
  return null;
}
