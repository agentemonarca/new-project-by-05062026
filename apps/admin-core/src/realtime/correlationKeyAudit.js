/**
 * `correlationKey` basado en mesa+round debe coincidir con el contexto resuelto.
 * Si la clave es `id:…` no se compara (prioridad id del formatter).
 *
 * @param {{ correlationKey?: string | null, mesa?: unknown, round?: unknown } | null | undefined} row
 * @returns {{ ok: true } | { ok: false, expected: string, actual: string }}
 */
export function auditMesaRoundCorrelationKey(row) {
  if (!row || typeof row !== 'object') return { ok: true };
  const ck = String(row.correlationKey ?? '').trim();
  if (!ck || ck.startsWith('id:')) return { ok: true };
  const expected = `mesa:${String(row.mesa ?? '').trim()}|round:${String(row.round ?? '').trim()}`;
  if (ck === expected) return { ok: true };
  return { ok: false, expected, actual: ck };
}
