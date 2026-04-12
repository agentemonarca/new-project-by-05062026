/**
 * Canonical correlation key for GPulse Lab signal ↔ result pairing (socket + middleware + validation).
 * @param {unknown} mesa
 * @param {unknown} round
 * @returns {string}
 */
export function buildLabCorrelationKey(mesa, round) {
  return `mesa:${String(mesa)}|round:${String(round)}`;
}

/**
 * @param {unknown} ck
 * @returns {{ mesaId: string, round: string } | null}
 */
export function parseLabCorrelationKeyParts(ck) {
  if (ck == null || String(ck).trim() === '') return null;
  const s = String(ck).trim();
  const sep = '|round:';
  const at = s.indexOf(sep);
  if (at === -1 || !s.startsWith('mesa:')) return null;
  const mesaId = s.slice('mesa:'.length, at);
  const round = s.slice(at + sep.length);
  if (mesaId === '') return null;
  return { mesaId, round };
}

/**
 * @param {unknown} key
 * @param {unknown} mesa
 * @param {unknown} round
 * @returns {string | null}
 */
export function normalizeCorrelationKey(key, mesa, round) {
  if (key && String(key).includes('mesa:')) {
    const out = String(key).trim();
    console.log('CORRELATION NORMALIZED:', out);
    return out;
  }

  if (mesa != null && mesa !== '' && round != null && String(round).trim() !== '') {
    const out = buildLabCorrelationKey(mesa, round);
    console.log('CORRELATION NORMALIZED:', out);
    return out;
  }

  if (key != null && String(key).trim() !== '') {
    const out = String(key).trim();
    console.log('CORRELATION NORMALIZED:', out);
    return out;
  }

  console.log('CORRELATION NORMALIZED:', null);
  return null;
}
