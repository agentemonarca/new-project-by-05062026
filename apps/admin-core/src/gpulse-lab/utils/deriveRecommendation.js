/**
 * VistaLabs-enriched (`recommendation`) y proveedor crudo (`vector_forecast` anidado o plano).
 * @param {unknown} payload
 * @returns {string | null}
 */
export function deriveRecommendation(payload) {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const p = /** @type {Record<string, unknown>} */ (payload);

  if (p.recommendation) return /** @type {string} */ (p.recommendation);

  const senal = p.señal ?? p['señal'];
  if (senal != null && typeof senal === 'object' && !Array.isArray(senal)) {
    const dir = /** @type {Record<string, unknown>} */ (senal).direccion;
    if (dir != null && String(dir).trim() !== '') return String(dir).trim();
  }

  const d = p.data != null && typeof p.data === 'object' && !Array.isArray(p.data) ? /** @type {Record<string, unknown>} */ (p.data) : null;
  const d2 = d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data) ? /** @type {Record<string, unknown>} */ (d.data) : null;
  const prov = p.providerPayload != null && typeof p.providerPayload === 'object' && !Array.isArray(p.providerPayload)
    ? /** @type {Record<string, unknown>} */ (p.providerPayload)
    : null;
  const provD = prov?.data != null && typeof prov.data === 'object' && !Array.isArray(prov.data) ? /** @type {Record<string, unknown>} */ (prov.data) : null;

  const sigFromData = d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal) ? d.signal : null;
  const sigFromD2 = d2?.signal != null && typeof d2.signal === 'object' && !Array.isArray(d2.signal) ? d2.signal : null;
  const sigFromProv = provD?.signal != null && typeof provD.signal === 'object' && !Array.isArray(provD.signal) ? provD.signal : null;

  const vector =
    p.vector_forecast ||
    (sigFromData && /** @type {Record<string, unknown>} */ (sigFromData).vector_forecast) ||
    (sigFromD2 && /** @type {Record<string, unknown>} */ (sigFromD2).vector_forecast) ||
    (sigFromProv && /** @type {Record<string, unknown>} */ (sigFromProv).vector_forecast) ||
    (d && /** @type {Record<string, unknown>} */ (d).vector_forecast);

  if (Array.isArray(vector) && vector.length > 0) {
    const first = vector[0];
    const c = String(first).trim().toUpperCase();
    if (c === 'P' || c.startsWith('PLAY')) return 'PLAYER';
    if (c === 'B' || c.startsWith('BANK')) return 'BANKER';
    if (c === 'T' || c === 'E' || c.startsWith('TIE')) return 'TIE';
  }

  return null;
}

/**
 * Misma prioridad visual que el vector usado en derive (plano + `data.signal`), para logs.
 * @param {unknown} payload
 */
export function vectorForecastForDebug(payload) {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  const p = /** @type {Record<string, unknown>} */ (payload);
  const top = p.vector_forecast;
  const d = p.data;
  if (d != null && typeof d === 'object' && !Array.isArray(d)) {
    const s = /** @type {Record<string, unknown>} */ (d).signal;
    if (s != null && typeof s === 'object' && !Array.isArray(s)) {
      const nested = /** @type {Record<string, unknown>} */ (s).vector_forecast;
      return top ?? nested;
    }
  }
  return top;
}
