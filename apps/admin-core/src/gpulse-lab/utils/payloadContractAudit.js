/**
 * Payload contract verification: VistaLabs raw vs GPulseLab normalized (socket layer).
 * @param {unknown} raw
 * @param {unknown} normalized
 */
export function auditPayloadMapping(raw, normalized) {
  const r = raw != null && typeof raw === 'object' && !Array.isArray(raw) ? /** @type {Record<string, unknown>} */ (raw) : {};
  const n =
    normalized != null && typeof normalized === 'object' && !Array.isArray(normalized)
      ? /** @type {Record<string, unknown>} */ (normalized)
      : {};
  const rawMi = r.mesa_info != null && typeof r.mesa_info === 'object' && !Array.isArray(r.mesa_info) ? r.mesa_info : null;

  return {
    mesa: { raw: r.mesa, normalized: n.mesa },
    round: { raw: r.round ?? r.ronda_actual ?? rawMi?.ronda_actual, normalized: n.round },
    correlationKey: { raw: r.correlationKey, normalized: n.correlationKey },
    ganador: { raw: r.ganador ?? r.resultado, normalized: n.ganador },
    playerCards: { raw: r.playerCards ?? rawMi?.player, normalized: n.playerCards },
    bankerCards: { raw: r.bankerCards ?? rawMi?.banker, normalized: n.bankerCards },
    timestamp: { raw: r.timestamp ?? r.ts, normalized: n.ts ?? n.timestamp },
  };
}

function fingerprint(v) {
  if (v === undefined) return '__undefined__';
  if (v === null) return 'null';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/**
 * @param {ReturnType<typeof auditPayloadMapping>} audit
 * @returns {string[]}
 */
export function detectMismatch(audit) {
  const mismatches = [];

  for (const key of Object.keys(audit)) {
    const entry = /** @type {{ raw?: unknown, normalized?: unknown }} */ (audit)[key];
    if (entry == null) continue;
    if (entry.raw !== undefined && entry.normalized !== undefined) {
      if (fingerprint(entry.raw) !== fingerprint(entry.normalized)) {
        mismatches.push(key);
      }
    }
  }

  return mismatches;
}
