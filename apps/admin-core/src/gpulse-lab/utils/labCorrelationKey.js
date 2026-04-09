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
