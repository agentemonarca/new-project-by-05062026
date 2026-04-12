/**
 * Correlation wire: `mesa:<table_id>|round:<round_id>` (canonical).
 * Upgrades legacy `Nombre|123` to labeled form.
 *
 * @param {unknown} ck
 * @returns {string | null}
 */
export function normalizeCorrelationKey(ck) {
  if (ck == null) return null;
  const s = String(ck).trim();
  if (s === '') return null;

  if (/mesa:/i.test(s) && /round:/i.test(s)) return s;

  const lower = s.toLowerCase();
  if (lower.includes('mesa:') && lower.includes('round:')) {
    try {
      const afterMesa = s.split(/mesa:/i)[1];
      if (afterMesa == null) return s;
      const mesa = afterMesa.split('|')[0].trim();
      const afterRound = s.split(/round:/i)[1];
      if (afterRound == null) return s;
      const round = afterRound.split('|')[0].trim();
      if (mesa !== '' && round !== '') return `mesa:${mesa}|round:${round}`;
    } catch {
      return s;
    }
  }

  if (s.toLowerCase().startsWith('id:')) return s;

  const pipe = s.indexOf('|');
  if (pipe > 0 && !/mesa:/i.test(s)) {
    const a = s.slice(0, pipe).trim();
    const b = s.slice(pipe + 1).trim();
    if (a !== '' && b !== '' && !a.includes(':')) {
      return `mesa:${a}|round:${b}`;
    }
  }

  return s;
}

/**
 * Misma mesa + misma ronda aunque `round:` difiera solo en formato numérico (`019` vs `19`).
 * Alinea motor reactivo ↔ fila lab cuando señal y resultado no repiten el mismo string de CK.
 *
 * @param {unknown} a
 * @param {unknown} b
 */
export function correlationKeysLooselyEqual(a, b) {
  const na = normalizeCorrelationKey(a);
  const nb = normalizeCorrelationKey(b);
  if (na != null && nb != null && na === nb) return true;
  const s1 = a != null ? String(a).trim() : '';
  const s2 = b != null ? String(b).trim() : '';
  if (s1 === '' || s2 === '') return false;
  const m1 = s1.match(/^mesa:([^|]+)\|round:(.+)$/i);
  const m2 = s2.match(/^mesa:([^|]+)\|round:(.+)$/i);
  if (!m1 || !m2) return false;
  if (m1[1].trim().toLowerCase() !== m2[1].trim().toLowerCase()) return false;
  const r1 = m1[2].trim();
  const r2 = m2[2].trim();
  if (r1 === r2) return true;
  const n1 = Number(r1);
  const n2 = Number(r2);
  return Number.isFinite(n1) && Number.isFinite(n2) && n1 === n2;
}

/**
 * @param {Record<string, unknown> | null | undefined} record
 */
export function normalizeCorrelationKeyInRecord(record) {
  if (record == null || typeof record !== 'object') return;
  const ck = record.correlationKey;
  if (ck == null || ck === '') return;
  const prev = String(ck).trim();
  const next = normalizeCorrelationKey(ck);
  if (next == null) return;
  const nxt = String(next).trim();
  record.correlationKey = nxt;
  const logOn =
    import.meta.env.DEV === true || import.meta.env.VITE_NORMALIZED_CK_LOG === '1' || prev !== nxt;
  if (logOn) {
    console.log('[NORMALIZED_CK]', nxt);
  }
}
