/**
 * Entrada de log en vivo (store). Compatibilidad: mezcla con `string` legado.
 *
 * @typedef {{
 *   type: string,
 *   ts: number,
 *   reason?: string,
 *   payload?: unknown,
 * }} AdminDebugLogEntry
 */

/** @param {unknown} entry */
export function formatAdminDebugLogLine(entry) {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const o = /** @type {Record<string, unknown>} */ (entry);
    if (o.type === 'TEXT' && typeof o.payload === 'string') {
      const ts = typeof o.ts === 'number' ? new Date(o.ts).toISOString() : new Date().toISOString();
      return `[${ts}] ${o.payload}`;
    }
    try {
      return JSON.stringify(entry);
    } catch {
      return String(entry);
    }
  }
  return String(entry);
}
