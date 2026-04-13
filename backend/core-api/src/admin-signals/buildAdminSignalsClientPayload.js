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
 * @param {unknown} v
 * @returns {Record<string, unknown> | null}
 */
function asRecord(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : null;
}

/**
 * @param {unknown} src
 * @returns {{ cartas_player: string[] | null, cartas_banker: string[] | null }}
 */
function cartasFromExtractMesaInfo(src) {
  const mi = extractMesaInfoFromPayload(src);
  if (!mi) return { cartas_player: null, cartas_banker: null };
  return { cartas_player: mi.cartas_player, cartas_banker: mi.cartas_banker };
}

/**
 * @param {Record<string, unknown>} r — payload con `scoreDetail` opcional
 * @returns {{ cartas_player: string[] | null, cartas_banker: string[] | null }}
 */
function cartasFromScoreDetailOnly(r) {
  const sd = r.scoreDetail;
  if (!sd || typeof sd !== 'object' || Array.isArray(sd)) return { cartas_player: null, cartas_banker: null };
  const o = /** @type {Record<string, unknown>} */ (sd);
  const cpp = o.cartas_player ?? o.player_cards;
  const cbk = o.cartas_banker ?? o.banker_cards;
  return {
    cartas_player: Array.isArray(cpp) ? cpp.map((x) => String(x)) : null,
    cartas_banker: Array.isArray(cbk) ? cbk.map((x) => String(x)) : null,
  };
}

/**
 * Une `results.mesa_info` y `scoreDetail` en un solo par de vectores.
 * @param {unknown} src
 */
function combineCartasSources(src) {
  if (src == null) return { cartas_player: null, cartas_banker: null };
  const fromMi = cartasFromExtractMesaInfo(src);
  const r = asRecord(src) ?? {};
  const fromSd = cartasFromScoreDetailOnly(r);
  return {
    cartas_player: fromMi.cartas_player?.length ? fromMi.cartas_player : fromSd.cartas_player,
    cartas_banker: fromMi.cartas_banker?.length ? fromMi.cartas_banker : fromSd.cartas_banker,
  };
}

/**
 * Proveedor gana en empate: si hay cartas solo en `providerSnapshot`, se copian.
 * Snapshots truncados (`json_truncated`) se ignoran para no mezclar previews vacíos.
 * @param {unknown} rawPayload
 * @param {unknown} [providerSnapshot]
 */
function mergeCartasPreferProviderSnapshot(rawPayload, providerSnapshot) {
  const a = combineCartasSources(rawPayload);
  let b = { cartas_player: null, cartas_banker: null };
  const ps = asRecord(providerSnapshot);
  if (ps && ps._providerPayloadFormat !== 'json_truncated') {
    b = combineCartasSources(providerSnapshot);
  }
  return {
    cartas_player: b.cartas_player?.length ? b.cartas_player : a.cartas_player ?? null,
    cartas_banker: b.cartas_banker?.length ? b.cartas_banker : a.cartas_banker ?? null,
  };
}

/**
 * Rellena `scoreDetail` si el proveedor envió cartas pero el objeto aún no las tiene.
 * @param {Record<string, unknown> | null | undefined} scoreDetail
 * @param {{ cartas_player: string[] | null, cartas_banker: string[] | null }} cartas
 * @param {string | null} ganador
 */
function ensureScoreDetailHasCartas(scoreDetail, cartas, ganador) {
  const cp = cartas.cartas_player;
  const cb = cartas.cartas_banker;
  if (!cp?.length && !cb?.length) return scoreDetail;

  const base =
    scoreDetail && typeof scoreDetail === 'object' && !Array.isArray(scoreDetail)
      ? { .../** @type {Record<string, unknown>} */ (scoreDetail) }
      : {};
  const o = /** @type {Record<string, unknown>} */ (base);
  if ((!Array.isArray(o.cartas_player) || o.cartas_player.length === 0) && cp?.length) o.cartas_player = cp;
  if ((!Array.isArray(o.cartas_banker) || o.cartas_banker.length === 0) && cb?.length) o.cartas_banker = cb;
  if (o.ganador == null && ganador != null) o.ganador = ganador;
  return o;
}

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
 * @param {unknown} [providerSnapshot] — clon pre–Phase 3 (`snapshotProviderPayloadForClient`); cartas se fusionan si faltan en `rawPayload`
 * @returns {Record<string, unknown> | null}
 */
export function buildAdminSignalsClientPayload(type, rawPayload, providerSnapshot) {
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
    let scoreDetail =
      embedded && fromNested
        ? { .../** @type {Record<string, unknown>} */ (embedded), ...fromNested }
        : embedded ?? fromNested;

    const cartasMerged = mergeCartasPreferProviderSnapshot(rawPayload, providerSnapshot);
    const ganadorPre =
      (scoreDetail &&
      typeof scoreDetail === 'object' &&
      'ganador' in scoreDetail &&
      /** @type {Record<string, unknown>} */ (scoreDetail).ganador != null
        ? String(/** @type {Record<string, unknown>} */ (scoreDetail).ganador)
        : null) ??
      r.ganador ??
      r.resultado ??
      r.result;
    scoreDetail = ensureScoreDetailHasCartas(
      scoreDetail && typeof scoreDetail === 'object' ? /** @type {Record<string, unknown>} */ (scoreDetail) : null,
      cartasMerged,
      ganadorPre != null ? String(ganadorPre) : null,
    );

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
    const cp = cartasMerged.cartas_player;
    const cb = cartasMerged.cartas_banker;
    if (slimMi != null || cp?.length || cb?.length) {
      out.mesa_info = {
        ...(slimMi || {}),
        cartas_player: cp?.length ? cp : null,
        cartas_banker: cb?.length ? cb : null,
      };
    }
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
