const DEFAULT_MAX_BYTES = 14_000;

/**
 * Reduce y acota payload crudo para Mongo (evita documentos gigantes / prototipo pollution).
 * @param {unknown} raw
 * @param {number} [maxBytes]
 * @returns {Record<string, unknown> | null}
 */
export function capRawPayload(raw, maxBytes = DEFAULT_MAX_BYTES) {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    try {
      const s = JSON.stringify(raw);
      if (s.length > maxBytes) return { _truncated: true, _preview: s.slice(0, 2048) };
      return { _primitive: raw };
    } catch {
      return { _error: 'non_serializable' };
    }
  }
  try {
    const s = JSON.stringify(raw);
    if (s.length <= maxBytes) return /** @type {Record<string, unknown>} */ (JSON.parse(s));
    const shallow = {};
    let n = 0;
    for (const [k, v] of Object.entries(raw)) {
      if (n++ > 40) break;
      try {
        const vs = JSON.stringify(v);
        shallow[k] = vs.length > 512 ? `${vs.slice(0, 300)}…` : JSON.parse(vs);
      } catch {
        shallow[k] = String(v);
      }
    }
    shallow._truncated = true;
    return shallow;
  } catch {
    return { _error: 'sanitize_failed' };
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {Date | null}
 */
export function extractProviderTimestamp(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const t =
    raw.ts ??
    raw.timestamp ??
    raw.time ??
    raw.sentAt ??
    raw.createdAt ??
    raw.serverTime ??
    null;
  if (t == null) return null;
  if (typeof t === 'number' && Number.isFinite(t)) return new Date(t < 1e12 ? t * 1000 : t);
  if (typeof t === 'string' && t.trim()) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
