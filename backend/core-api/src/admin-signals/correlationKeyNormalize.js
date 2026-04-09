/**
 * Misma semántica que admin-core: CK canónico `Mesa|ronda`.
 * @param {unknown} ck
 * @returns {string | null}
 */
export function normalizeCorrelationKey(ck) {
  if (ck == null) return null;
  const s = String(ck).trim();
  if (s === '') return null;

  const lower = s.toLowerCase();
  if (lower.includes('mesa:') && lower.includes('round:')) {
    try {
      const afterMesa = s.split(/mesa:/i)[1];
      if (afterMesa == null) return s;
      const mesa = afterMesa.split('|')[0].trim();
      const afterRound = s.split(/round:/i)[1];
      if (afterRound == null) return s;
      const round = afterRound.split('|')[0].trim();
      if (mesa !== '' && round !== '') return `${mesa}|${round}`;
    } catch {
      return s;
    }
  }

  if (s.includes('|')) return s;
  return s;
}
