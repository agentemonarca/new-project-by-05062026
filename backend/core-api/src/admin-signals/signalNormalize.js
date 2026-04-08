/**
 * Normalización espejo de `apps/gpulse/.../externalSignalsTypes.js` (sin dependencia cross-package).
 * Incluye `data.signal` (nombre_mesa, ronda_actual, …) como en el proveedor real.
 */

/** @param {...unknown} vals */
function pickFirst(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return v;
  }
  return null;
}

/**
 * Misma forma que `readNestedDataSignal` en `apps/admin-core/.../signalFormatter.js`.
 * @param {Record<string, unknown>} r
 */
export function readNestedDataSignal(r) {
  const data =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  const sig =
    data?.signal != null && typeof data.signal === 'object' && !Array.isArray(data.signal)
      ? /** @type {Record<string, unknown>} */ (data.signal)
      : null;
  return { data, sig };
}

export function buildCorrelationKey(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const { data, sig } = readNestedDataSignal(r);
  const id = r.id ?? r.signalId ?? sig?.id ?? sig?.signalId;
  if (id != null && String(id).trim() !== '') {
    return `id:${String(id).trim()}`;
  }
  const mesa = String(
    pickFirst(
      sig?.nombre_mesa,
      sig?.tableName,
      data?.mesa,
      r.mesa,
      r.table,
      r.desk,
      r.tableName,
      r.tableId,
      r.mesaName,
    ) ?? '',
  ).trim();
  const roundV = pickFirst(
    sig?.ronda_actual,
    sig?.gameRound,
    data?.ronda,
    r.round,
    r.gameRound,
    r.hand,
  );
  const round = roundV != null ? String(roundV).trim() : '';
  return `mesa:${mesa}|round:${round}`;
}

export function normalizeNewSignalPayload(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const { data, sig } = readNestedDataSignal(r);

  const mesa = String(
    pickFirst(
      sig?.nombre_mesa,
      sig?.tableName,
      data?.mesa,
      r.mesa,
      r.tableName,
      r.table,
      r.desk,
      r.tableId,
    ) ?? '',
  ).trim();

  const roundV = pickFirst(
    sig?.ronda_actual,
    sig?.gameRound,
    data?.ronda,
    r.round,
    r.gameRound,
    r.roundId,
  );
  const roundStr = roundV != null ? String(roundV).trim() : '';

  const rec = String(
    pickFirst(
      sig?.recommendation,
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
  let recommendation = 'UNKNOWN';
  if (rec === 'BANKER' || rec === 'B' || rec.startsWith('BANK')) recommendation = 'BANKER';
  else if (rec === 'PLAYER' || rec === 'P' || rec.startsWith('PLAY')) recommendation = 'PLAYER';
  const idVal = r.id ?? r.signalId ?? sig?.id ?? sig?.signalId;

  return {
    providerSignalId: idVal != null ? String(idVal) : null,
    mesa,
    round: roundStr,
    martingale: Number(pickFirst(sig?.martingale, r.martingale, r.martinGale) ?? 0) || 0,
    recommendation,
    correlationKey: buildCorrelationKey(r),
    raw: r,
  };
}

export function normalizeNewResultPayload(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const idVal = r.signalId ?? r.id;
  let w = r.winStatus;
  if (w === undefined || w === null) {
    const res = r.result;
    if (res === true || res === false) w = res;
    else if (typeof res === 'string') {
      const s = res.trim().toLowerCase();
      if (['win', 'won', 'true', '1', 'yes', 'hit'].includes(s)) w = true;
      if (['loss', 'lost', 'false', '0', 'no', 'miss'].includes(s)) w = false;
    }
  }
  const winStatus = w === true || w === 'true' || w === 1 || w === '1';
  const roundStr =
    r.round != null ? String(r.round) : r.gameRound != null ? String(r.gameRound) : '';
  return {
    providerSignalId: idVal != null ? String(idVal) : null,
    mesa: String(r.mesa ?? r.table ?? r.desk ?? r.tableName ?? r.tableId ?? ''),
    round: roundStr,
    winStatus,
    correlationKey: buildCorrelationKey(r),
    raw: r,
  };
}

export function extractMesaFromPayload(payload) {
  const r = payload && typeof payload === 'object' ? payload : {};
  const { data, sig } = readNestedDataSignal(r);
  const m = String(
    pickFirst(
      sig?.nombre_mesa,
      sig?.tableName,
      data?.mesa,
      r.mesa,
      r.table,
      r.desk,
      r.tableName,
      r.tableId,
      r.mesaName,
    ) ?? '',
  ).trim();
  return m || '—';
}
