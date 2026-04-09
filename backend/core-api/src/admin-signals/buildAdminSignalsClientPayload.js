import {
  normalizeNewSignalPayload,
  normalizeNewResultPayload,
  readDoubleNestedSignal,
  readNestedDataSignal,
  resolveRoundFromProvider,
} from './signalNormalize.js';
import { buildSafeCorrelationKey } from './buildSafeCorrelationKey.js';
import { extractMesaInfoFromPayload, findMesaInfoInPayload } from './signalSessionCanonical.js';

/**
 * VistaLab / admin: `tiempo_actual`, `martingala` (vectores), sin tablero gigante.
 * @param {unknown} rawPayload
 * @returns {Record<string, unknown> | null}
 */
function mesaInfoSlimForAdminClient(rawPayload) {
  const mi = findMesaInfoInPayload(rawPayload);
  if (!mi || typeof mi !== 'object' || Array.isArray(mi)) return null;
  /** @type {Record<string, unknown>} */
  const slim = {};
  if (mi.data_evento != null && typeof mi.data_evento === 'object' && !Array.isArray(mi.data_evento)) {
    slim.data_evento = mi.data_evento;
  }
  if (mi.martingala != null && typeof mi.martingala === 'object' && !Array.isArray(mi.martingala)) {
    slim.martingala = mi.martingala;
  }
  if (mi.ronda_objetivo != null) slim.ronda_objetivo = mi.ronda_objetivo;
  if (mi.ronda_actual != null) slim.ronda_actual = mi.ronda_actual;
  if (mi.nombre_mesa != null) slim.nombre_mesa = mi.nombre_mesa;
  return Object.keys(slim).length > 0 ? slim : null;
}

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
 * El relay puede añadir `providerPayload`: clon JSON del cuerpo **antes** del sobre Phase 3
 * (`relayNormalizedAdminSignals`), p. ej. `type` + `data.data.signal` tal cual del proveedor.
 *
 * @param {'NEW_SIGNAL' | 'NEW_RESULT'} type
 * @param {unknown} rawPayload — cuerpo crudo del upstream / HTTP (o ya normalizado universal)
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
    const { sig2 } = readDoubleNestedSignal(r);
    const sigEff = sig2 ?? sig;
    /** @type {Record<string, unknown>} */
    const out = {
      mesa: n.mesa,
      round: n.round,
      martingale: n.martingale,
      recommendation: n.recommendation,
      correlationKey: n.correlationKey,
      id: n.providerSignalId,
    };
    if (sigEff?.nombre_algoritmo != null && String(sigEff.nombre_algoritmo).trim() !== '') {
      out.nombre_algoritmo = String(sigEff.nombre_algoritmo).trim();
    }
    /** Incluir vector aunque solo venga en raíz (sobre universal / relay plano). */
    const vfFromNested =
      Array.isArray(sig2?.vector_forecast) && sig2.vector_forecast.length > 0
        ? sig2.vector_forecast
        : Array.isArray(sig?.vector_forecast) && sig.vector_forecast.length > 0
          ? sig.vector_forecast
          : null;
    const vfFromRoot =
      Array.isArray(r.vector_forecast) && r.vector_forecast.length > 0 ? r.vector_forecast : null;
    const vfWire = vfFromNested ?? vfFromRoot;
    if (Array.isArray(vfWire) && vfWire.length > 0) {
      out.vector_forecast = vfWire;
    }
    const wireRound = resolveRoundFromProvider(r);
    if (wireRound != null && wireRound !== '') out.round = wireRound;
    out.correlationKey = buildSafeCorrelationKey({
      mesa: out.mesa,
      round: out.round,
      providerId: out.id != null && String(out.id).trim() !== '' ? String(out.id).trim() : undefined,
    });
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
    /** @type {Record<string, unknown>} */
    const out = {
      mesa: n.mesa,
      round: n.round,
      winStatus: n.winStatus,
      correlationKey: n.correlationKey,
      ganador,
      historial,
      scoreDetail: scoreDetail && typeof scoreDetail === 'object' ? scoreDetail : undefined,
    };
    const sid = n.providerSignalId != null ? String(n.providerSignalId).trim() : '';
    if (sid !== '') {
      out.signalId = sid;
      out.id = sid;
    }
    const wireRound = resolveRoundFromProvider(r);
    if (wireRound != null && wireRound !== '') out.round = wireRound;
    const pid =
      out.signalId != null && String(out.signalId).trim() !== ''
        ? String(out.signalId).trim()
        : out.id != null && String(out.id).trim() !== ''
          ? String(out.id).trim()
          : undefined;
    out.correlationKey = buildSafeCorrelationKey({
      mesa: out.mesa,
      round: out.round,
      providerId: pid,
    });
    const slimMi = mesaInfoSlimForAdminClient(rawPayload);
    if (slimMi != null) out.mesa_info = slimMi;
    const rd =
      r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
        ? /** @type {Record<string, unknown>} */ (r.data)
        : null;
    if (rd?.martingalaData != null && typeof rd.martingalaData === 'object' && !Array.isArray(rd.martingalaData)) {
      out.martingalaData = rd.martingalaData;
    }
    return out;
  }
  return null;
}
