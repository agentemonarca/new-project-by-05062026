/**
 * Correlación canónica: `${mesa}|${roundId}` (último `|` separa ronda; mesa puede contener `|`).
 * Claves `id:…` no se comparan con mesa+round (prioridad id del formatter).
 */

/**
 * @param {unknown} mesa
 * @param {unknown} round
 * @returns {string}
 */
export function formatMesaRoundCorrelationKey(mesa, round) {
  const m = String(mesa ?? '').trim() || 'UNKNOWN';
  const rd = String(round ?? '').trim() || '-';
  return `${m}|${rd}`;
}

/**
 * @param {string | null | undefined} correlationKey
 * @returns {{ mesa: string, roundId: string } | null}
 */
export function parseMesaRoundCorrelationKey(correlationKey) {
  const ck = String(correlationKey ?? '').trim();
  if (!ck || ck.startsWith('id:')) return null;
  const i = ck.lastIndexOf('|');
  if (i <= 0) return null;
  return { mesa: ck.slice(0, i), roundId: ck.slice(i + 1) };
}

/**
 * @param {{ correlationKey?: string | null, mesa?: unknown, round?: unknown } | null | undefined} row
 * @returns {{ ok: true } | { ok: false, expected: string, actual: string }}
 */
export function auditMesaRoundCorrelationKey(row) {
  if (!row || typeof row !== 'object') return { ok: true };
  const ck = String(row.correlationKey ?? '').trim();
  if (!ck || ck.startsWith('id:')) return { ok: true };
  const expected = formatMesaRoundCorrelationKey(row.mesa, row.round);
  if (ck === expected) return { ok: true };
  return { ok: false, expected, actual: ck };
}
