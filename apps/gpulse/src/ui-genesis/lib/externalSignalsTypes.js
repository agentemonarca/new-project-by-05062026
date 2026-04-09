/**
 * Modelo interno — correlación NEW_SIGNAL ↔ NEW_RESULT.
 *
 * Estrategia de correlación:
 * 1) `providerSignalId` / `id` en payload (preferido).
 * 2) Clave compuesta `mesa` + `ronda` (fallback).
 */

/** @typedef {'PLAYER' | 'BANKER' | 'UNKNOWN'} BaccaratSide */

/** @param {...unknown} vals */
function pickFirst(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return v;
  }
  return null;
}

/**
 * Alineado con core-api `mapVectorForecastToRecommendation` / admin-core resolveSignal.
 * @param {unknown} vector
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | null}
 */
function mapVectorForecastToRecommendation(vector) {
  if (!Array.isArray(vector) || vector.length === 0) return null;
  const v = vector[0];
  if (v == null) return null;
  const s = String(v).trim().toUpperCase();
  if (s === 'P' || s.startsWith('PLAY')) return 'PLAYER';
  if (s === 'B' || s.startsWith('BANK')) return 'BANKER';
  if (s === 'E' || s === 'T' || s.startsWith('TIE')) return 'TIE';
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
  /** @type {BaccaratSide} */
  let recommendation = 'UNKNOWN';
  if (rec === 'BANKER' || rec === 'B' || rec.startsWith('BANK')) recommendation = 'BANKER';
  else if (rec === 'PLAYER' || rec === 'P' || rec.startsWith('PLAY')) recommendation = 'PLAYER';

  if (recommendation === 'UNKNOWN') {
    let vf = sig2?.vector_forecast;
    if (!Array.isArray(vf) || vf.length === 0) vf = sig?.vector_forecast;
    if (!Array.isArray(vf) || vf.length === 0) vf = r.vector_forecast;
    const fromVec = mapVectorForecastToRecommendation(Array.isArray(vf) ? vf : []);
    if (fromVec === 'PLAYER' || fromVec === 'BANKER') recommendation = fromVec;
  }

  const idVal = r.id ?? r.signalId ?? sig?.id ?? sig?.signalId ?? sig2?.id ?? sig2?.signalId;

  const rForKey = { ...r, mesa: mesa || r.mesa, round: round || r.round };
  return {
    providerSignalId: idVal != null ? String(idVal) : null,
    mesa,
    round,
    martingale: Number(pickFirst(sig?.martingale, r.martingale, r.martinGale) ?? 0) || 0,
    recommendation,
    correlationKey: buildCorrelationKey(rForKey),
    raw: r,
  };
}

/**
 * @param {unknown} raw
 * @returns {{
 *   providerSignalId: string | null,
 *   mesa: string,
 *   round: string,
 *   winStatus: boolean,
 *   correlationKey: string,
 *   raw: Record<string, unknown>,
 * }}
 */
export function normalizeNewResultPayload(raw) {
  const r = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const idVal = r.signalId ?? r.id;
  const w = r.winStatus;
  const winStatus = w === true || w === 'true' || w === 1 || w === '1';
  return {
    providerSignalId: idVal != null ? String(idVal) : null,
    mesa: String(r.mesa ?? r.table ?? r.desk ?? ''),
    round: r.round != null ? String(r.round) : '',
    winStatus,
    correlationKey: buildCorrelationKey(r),
    raw: r,
  };
}
