/**
 * Normalización espejo de `apps/gpulse/.../externalSignalsTypes.js` (sin dependencia cross-package).
 */

export function buildCorrelationKey(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const id = r.id ?? r.signalId;
  if (id != null && String(id).trim() !== '') {
    return `id:${String(id).trim()}`;
  }
  const mesa = String(
    r.mesa ?? r.table ?? r.desk ?? r.tableName ?? r.tableId ?? r.mesaName ?? '',
  ).trim();
  const round =
    r.round != null
      ? String(r.round).trim()
      : r.gameRound != null
        ? String(r.gameRound).trim()
        : r.hand != null
          ? String(r.hand).trim()
          : '';
  return `mesa:${mesa}|round:${round}`;
}

export function normalizeNewSignalPayload(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const rec = String(
    r.recommendation ?? r.forecast ?? r.signal ?? r.side ?? r.prediction ?? '',
  ).toUpperCase();
  let recommendation = 'UNKNOWN';
  if (rec === 'BANKER' || rec === 'B' || rec.startsWith('BANK')) recommendation = 'BANKER';
  else if (rec === 'PLAYER' || rec === 'P' || rec.startsWith('PLAY')) recommendation = 'PLAYER';
  const idVal = r.id ?? r.signalId;
  const roundStr =
    r.round != null ? String(r.round) : r.gameRound != null ? String(r.gameRound) : '';
  return {
    providerSignalId: idVal != null ? String(idVal) : null,
    mesa: String(r.mesa ?? r.table ?? r.desk ?? r.tableName ?? r.tableId ?? ''),
    round: roundStr,
    martingale: Number(r.martingale ?? r.martinGale ?? 0) || 0,
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
  return (
    String(r.mesa ?? r.table ?? r.desk ?? r.tableName ?? r.tableId ?? r.mesaName ?? '') || '—'
  );
}
