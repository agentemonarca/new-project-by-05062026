/**
 * Unifica correlationKey del proveedor al formato canónico `Mesa|ronda` para matching y resolución de mesa.
 *
 * Soporta:
 * - `mesa:Baccarat 9|round:30` → `Baccarat 9|30`
 * - `Baccarat 9|30` → sin cambio
 * - `id:…` u otras cadenas sin `mesa:`/`round:` → se devuelven recortadas
 *
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

/**
 * Asigna `record.correlationKey` normalizado y opcionalmente loguea.
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
