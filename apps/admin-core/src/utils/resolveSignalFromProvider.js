/**
 * Dirección y nombre de algoritmo desde el anidado del proveedor (`vector_forecast`, `nombre_algoritmo`).
 * Espejo conceptual de `mapVectorForecastToRecommendation` en `signalNormalize.js` (backend).
 *
 * @param {unknown} vector
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | null}
 */
export function mapForecast(vector) {
  if (!Array.isArray(vector) || vector.length === 0) return null;
  const v = vector[0];
  if (v == null) return null;
  const s = String(v).trim().toUpperCase();
  if (s === 'P' || s.startsWith('PLAY')) return 'PLAYER';
  if (s === 'B' || s.startsWith('BANK')) return 'BANKER';
  if (s === 'E' || s === 'T' || s.startsWith('TIE')) return 'TIE';
  return null;
}

/**
 * @param {unknown} payload
 * @returns {{ signalName: string | null, direction: 'PLAYER' | 'BANKER' | 'TIE' | null }}
 */
export function resolveSignalFromProvider(payload) {
  const p =
    payload != null && typeof payload === 'object' && !Array.isArray(payload)
      ? /** @type {Record<string, unknown>} */ (payload)
      : null;
  if (!p) return { signalName: null, direction: null };

  const d =
    p.data != null && typeof p.data === 'object' && !Array.isArray(p.data)
      ? /** @type {Record<string, unknown>} */ (p.data)
      : null;
  const d2 =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;

  const signal =
    (d2?.signal != null && typeof d2.signal === 'object' && !Array.isArray(d2.signal)
      ? /** @type {Record<string, unknown>} */ (d2.signal)
      : null) ??
    (d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
      ? /** @type {Record<string, unknown>} */ (d.signal)
      : null) ??
    (p.signal != null && typeof p.signal === 'object' && !Array.isArray(p.signal)
      ? /** @type {Record<string, unknown>} */ (p.signal)
      : null);

  if (!signal) {
    const vfRoot = p.vector_forecast;
    const dirFlat = mapForecast(Array.isArray(vfRoot) ? vfRoot : []);
    const nameFlat = p.nombre_algoritmo;
    const signalNameFlat =
      nameFlat != null && String(nameFlat).trim() !== '' ? String(nameFlat).trim() : null;
    return { signalName: signalNameFlat, direction: dirFlat };
  }

  const rawName = signal.nombre_algoritmo;
  const signalName = rawName != null && String(rawName).trim() !== '' ? String(rawName).trim() : null;
  const vf = signal.vector_forecast;
  const direction = mapForecast(Array.isArray(vf) ? vf : []);

  return { signalName, direction };
}
