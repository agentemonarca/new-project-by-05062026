/**
 * Modelo interno — correlación NEW_SIGNAL ↔ NEW_RESULT.
 *
 * Estrategia de correlación:
 * 1) `providerSignalId` / `id` en payload (preferido).
 * 2) Clave compuesta `mesa` + `ronda` (fallback).
 */

import {
  extractVectorForecastArrayFromSignalRaw,
  mergeResultEnvelopeForExtract,
  pickContadorMartingalaFromSignalRaw,
  predictionSideFromVectorAndContador,
  winStatusFromVectorWinLast,
} from '../../utils/providerMartingaleRead.js';

/** @typedef {'PLAYER' | 'BANKER' | 'TIE' | 'UNKNOWN'} BaccaratSide */

/** @param {...unknown} vals */
function pickFirst(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return v;
  }
  return null;
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {string}
 */
export function buildCorrelationKey(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const id = r.id ?? r.signalId;
  if (id != null && String(id).trim() !== '') {
    return `id:${String(id).trim()}`;
  }
  const mesa = String(r.mesa ?? r.table ?? r.desk ?? '').trim();
  const round = r.round != null ? String(r.round).trim() : '';
  return `${mesa}|${round}`;
}

/**
 * @param {unknown} raw
 * @returns {{
 *   providerSignalId: string | null,
 *   mesa: string,
 *   round: string,
 *   martingale: number,
 *   recommendation: BaccaratSide,
 *   correlationKey: string,
 *   raw: Record<string, unknown>,
 * }}
 */
export function normalizeNewSignalPayload(raw) {
  const r = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const d =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  const d2 =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;
  const sig =
    d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
      ? /** @type {Record<string, unknown>} */ (d.signal)
      : null;
  const sig2 =
    d2?.signal != null && typeof d2.signal === 'object' && !Array.isArray(d2.signal)
      ? /** @type {Record<string, unknown>} */ (d2.signal)
      : null;

  const mesa = String(
    pickFirst(
      sig2?.nombre_mesa,
      sig2?.tableName,
      d2?.mesa,
      sig?.nombre_mesa,
      sig?.tableName,
      d?.mesa,
      r.mesa,
      r.table,
      r.desk,
      r.tableName,
      r.tableId,
    ) ?? '',
  ).trim();

  const roundV = pickFirst(
    sig2?.ronda_actual,
    sig?.ronda_actual,
    d2?.ronda,
    d?.ronda,
    r.round,
    r.ronda,
    r.ronda_actual,
    r.Ronda,
    r.gameRound,
    r.roundId,
    r.hand,
  );
  const round = roundV != null ? String(roundV).trim() : '';

  const vfArr = extractVectorForecastArrayFromSignalRaw(r);
  const contadorRaw = pickContadorMartingalaFromSignalRaw(r);
  const contadorForStep =
    contadorRaw != null && String(contadorRaw).trim() !== '' ? contadorRaw : vfArr.length > 0 ? 1 : null;

  /** Primary: `vector_forecast[ index(contador_martingala) ]` — not flat `recommendation`. */
  /** @type {BaccaratSide} */
  let recommendation = 'UNKNOWN';
  if (vfArr.length > 0 && contadorForStep != null) {
    const fromVec = predictionSideFromVectorAndContador(vfArr, contadorForStep);
    if (fromVec === 'PLAYER' || fromVec === 'BANKER' || fromVec === 'TIE') recommendation = fromVec;
  }

  const rec = String(
    pickFirst(
      sig2?.recommendation,
      sig?.recommendation,
      sig2?.forecast,
      sig?.forecast,
      sig?.signal,
      sig?.side,
      sig?.prediction,
      r.recommendation,
      r.forecast,
      r.signal,
      r.side,
      r.prediction,
    ) ?? '',
  ).toUpperCase();
  if (recommendation === 'UNKNOWN') {
    if (rec === 'BANKER' || rec === 'B' || rec.startsWith('BANK')) recommendation = 'BANKER';
    else if (rec === 'PLAYER' || rec === 'P' || rec.startsWith('PLAY')) recommendation = 'PLAYER';
    else if (rec.includes('TIE') || rec === 'T' || rec === 'E') recommendation = 'TIE';
  }

  const idVal = r.id ?? r.signalId ?? sig?.id ?? sig?.signalId ?? sig2?.id ?? sig2?.signalId;

  const rForKey = { ...r, mesa: mesa || r.mesa, round: round || r.round };
  const mgNum = Number(
    pickFirst(
      contadorRaw,
      sig2?.martingale,
      sig?.martingale,
      r.martingale,
      r.martinGale,
    ) ?? 0,
  );
  return {
    providerSignalId: idVal != null ? String(idVal) : null,
    mesa,
    round,
    martingale: Number.isFinite(mgNum) ? mgNum : 0,
    recommendation,
    correlationKey: buildCorrelationKey(rForKey),
    raw: r,
  };
}

/**
 * Nombre legible del modelo / algoritmo en el payload proveedor (p. ej. Winx `nombre_algoritmo`).
 * @param {unknown} raw — cuerpo NEW_SIGNAL tal cual en store (`rawSignal`).
 * @returns {string}
 */
export function extractProviderSignalAlgorithmName(raw) {
  if (raw == null || typeof raw !== 'object') return '';
  const r = /** @type {Record<string, unknown>} */ (raw);
  /** Payload plano del BFF (`buildAdminSignalsClientPayload`) suele traer `nombre_algoritmo` en raíz. */
  if (r.nombre_algoritmo != null && String(r.nombre_algoritmo).trim() !== '') {
    return String(r.nombre_algoritmo).trim();
  }
  /** Relay BFF añade a veces `providerNormalized` / `supplier` (snapshot). */
  const pn = r.providerNormalized;
  if (pn != null && typeof pn === 'object' && !Array.isArray(pn)) {
    const p = /** @type {Record<string, unknown>} */ (pn);
    const fromPn = pickFirst(p.nombre_algoritmo, p.algorithm, p.signalName);
    if (fromPn != null && String(fromPn).trim() !== '') return String(fromPn).trim();
  }
  const sup = r.supplier;
  if (sup != null && typeof sup === 'object' && !Array.isArray(sup)) {
    const s = /** @type {Record<string, unknown>} */ (sup);
    const fromS = pickFirst(s.nombre_algoritmo, s.algorithm);
    if (fromS != null && String(fromS).trim() !== '') return String(fromS).trim();
  }
  const d =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  const d2 =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;
  const sig =
    d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
      ? /** @type {Record<string, unknown>} */ (d.signal)
      : null;
  const sig2 =
    d2?.signal != null && typeof d2.signal === 'object' && !Array.isArray(d2.signal)
      ? /** @type {Record<string, unknown>} */ (d2.signal)
      : null;
  const canon =
    r.canonical != null && typeof r.canonical === 'object' && !Array.isArray(r.canonical)
      ? /** @type {Record<string, unknown>} */ (r.canonical)
      : null;
  const canonSig =
    canon?.signal != null && typeof canon.signal === 'object' && !Array.isArray(canon.signal)
      ? /** @type {Record<string, unknown>} */ (canon.signal)
      : null;
  const mi =
    r.mesa_info != null && typeof r.mesa_info === 'object' && !Array.isArray(r.mesa_info)
      ? /** @type {Record<string, unknown>} */ (r.mesa_info)
      : null;
  const miD =
    d?.mesa_info != null && typeof d.mesa_info === 'object' && !Array.isArray(d.mesa_info)
      ? /** @type {Record<string, unknown>} */ (d.mesa_info)
      : null;
  const v = pickFirst(
    sig2?.nombre_algoritmo,
    sig?.nombre_algoritmo,
    d2?.nombre_algoritmo,
    d?.nombre_algoritmo,
    canonSig?.nombre_algoritmo,
    canon?.nombre_algoritmo,
    mi?.nombre_algoritmo,
    miD?.nombre_algoritmo,
    r.nombre_algoritmo,
    r.algorithm,
  );
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}

export function normalizeNewResultPayload(raw) {
  const r = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  /** Aplanado como en el store — `vector_win` / ids a menudo viven bajo `data`. */
  const flat = mergeResultEnvelopeForExtract(raw);
  const forKey =
    flat && typeof flat === 'object' && !Array.isArray(flat) && Object.keys(flat).length
      ? /** @type {Record<string, unknown>} */ (flat)
      : r;
  const idVal = flat.signalId ?? flat.id ?? r.signalId ?? r.id;
  const w = flat.winStatus ?? flat.win ?? r.winStatus;
  const relayWin = w === true || w === 'true' || w === 1 || w === '1';
  const fromVectorWin = winStatusFromVectorWinLast(flat);
  const winStatus = fromVectorWin !== null ? fromVectorWin : relayWin;
  return {
    providerSignalId: idVal != null ? String(idVal) : null,
    mesa: String(flat.mesa ?? flat.table ?? flat.desk ?? r.mesa ?? r.table ?? r.desk ?? ''),
    round: (flat.round ?? r.round) != null ? String(flat.round ?? r.round) : '',
    winStatus,
    correlationKey: buildCorrelationKey(forKey),
    raw: r,
  };
}
