/**
 * Ronda real del proveedor: rutas anidadas primero; `payload.round` vacío no bloquea.
 * Espejo de `backend/core-api/src/admin-signals/signalNormalize.js` (mantener alineado).
 *
 * @param {unknown} payload
 * @returns {string | null}
 */
export function resolveRoundFromProvider(payload) {
  const p =
    payload != null && typeof payload === 'object' && !Array.isArray(payload)
      ? /** @type {Record<string, unknown>} */ (payload)
      : null;
  if (!p) return null;

  /** @param {...unknown} vals */
  const pick = (...vals) => {
    for (const v of vals) {
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return null;
  };

  /** @param {unknown} mi */
  const pickFromMesaInfo = (mi) => {
    if (mi == null || typeof mi !== 'object' || Array.isArray(mi)) return null;
    const m = /** @type {Record<string, unknown>} */ (mi);
    const ev = m.data_evento ?? m.data_event;
    const evRec = ev != null && typeof ev === 'object' && !Array.isArray(ev) ? /** @type {Record<string, unknown>} */ (ev) : null;
    const fromEv = evRec ? pick(evRec.Ronda, evRec.ronda, evRec.round) : null;
    /** Resultado: ronda_objetivo alinea con la señal; ronda_actual solo último recurso. */
    return pick(m.ronda_objetivo, fromEv, m.Ronda, m.round, m.gameRound, m.ronda_actual);
  };

  const d =
    p.data != null && typeof p.data === 'object' && !Array.isArray(p.data)
      ? /** @type {Record<string, unknown>} */ (p.data)
      : null;
  const d2 =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;

  const resultsDeep =
    d2?.results != null && typeof d2.results === 'object' && !Array.isArray(d2.results)
      ? /** @type {Record<string, unknown>} */ (d2.results)
      : null;
  const resultsShallow =
    d?.results != null && typeof d.results === 'object' && !Array.isArray(d.results)
      ? /** @type {Record<string, unknown>} */ (d.results)
      : null;

  const miDeep = resultsDeep?.mesa_info;
  const miShallow = resultsShallow?.mesa_info;

  const sigDeep =
    d2?.signal != null && typeof d2.signal === 'object' && !Array.isArray(d2.signal)
      ? /** @type {Record<string, unknown>} */ (d2.signal)
      : null;
  const sigShallow =
    d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
      ? /** @type {Record<string, unknown>} */ (d.signal)
      : null;
  const sigRoot =
    p.signal != null && typeof p.signal === 'object' && !Array.isArray(p.signal)
      ? /** @type {Record<string, unknown>} */ (p.signal)
      : null;

  /** @param {unknown} holder */
  const roundFromDataEventBlock = (holder) => {
    if (holder == null || typeof holder !== 'object' || Array.isArray(holder)) return null;
    const h = /** @type {Record<string, unknown>} */ (holder);
    const ev = h.data_evento ?? h.data_event;
    if (ev == null || typeof ev !== 'object' || Array.isArray(ev)) return null;
    const o = /** @type {Record<string, unknown>} */ (ev);
    return pick(o.Ronda, o.ronda, o.round);
  };

  // RESULT (nested primero) → SIGNAL → data.ronda → raíz
  const nested = pick(
    pickFromMesaInfo(miDeep),
    pickFromMesaInfo(miShallow),
    pickFromMesaInfo(p.mesa_info),
    sigDeep?.ronda_actual,
    sigShallow?.ronda_actual,
    sigRoot?.ronda_actual,
    d2?.ronda,
    d?.ronda,
    roundFromDataEventBlock(sigDeep),
    roundFromDataEventBlock(sigShallow),
    roundFromDataEventBlock(sigRoot),
    roundFromDataEventBlock(d2),
    roundFromDataEventBlock(d),
    roundFromDataEventBlock(p),
    sigDeep?.ronda_objetivo,
    sigDeep?.gameRound,
    sigShallow?.ronda_objetivo,
    sigShallow?.gameRound,
    d2?.ronda_actual,
    d2?.ronda_objetivo,
    d?.ronda_actual,
    d?.ronda_objetivo,
  );

  if (nested) return nested;

  return pick(p.round, p.ronda, p.ronda_actual, p.Ronda, p.gameRound, p.roundId, p.hand);
}
