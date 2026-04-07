/**
 * Modelo interno — correlación NEW_SIGNAL ↔ NEW_RESULT.
 *
 * Estrategia de correlación:
 * 1) `providerSignalId` / `id` en payload (preferido).
 * 2) Clave compuesta `mesa` + `ronda` (fallback).
 */

/** @typedef {'PLAYER' | 'BANKER' | 'UNKNOWN'} BaccaratSide */

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
  return `mesa:${mesa}|round:${round}`;
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
  const rec = String(r.recommendation ?? r.signal ?? r.side ?? '').toUpperCase();
  /** @type {BaccaratSide} */
  let recommendation = 'UNKNOWN';
  if (rec === 'BANKER') recommendation = 'BANKER';
  else if (rec === 'PLAYER') recommendation = 'PLAYER';
  const idVal = r.id ?? r.signalId;
  return {
    providerSignalId: idVal != null ? String(idVal) : null,
    mesa: String(r.mesa ?? r.table ?? r.desk ?? ''),
    round: r.round != null ? String(r.round) : '',
    martingale: Number(r.martingale ?? r.martinGale ?? 0) || 0,
    recommendation,
    correlationKey: buildCorrelationKey(r),
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
