/**
 * Extrae vistas completas del proveedor (mismas rutas que core-api signalNormalize / buildAdminSignalsClientPayload).
 * No lanza; campos ausentes → null.
 */

/** @param {unknown} v */
function asRec(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : null;
}

/**
 * Señal canónica: payload.data.data.signal o data.signal o raíz parcial.
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
export function extractNestedSignal(raw) {
  const r = asRec(raw);
  if (!r) return null;
  const d = asRec(r.data);
  const inner = d?.data != null ? asRec(d.data) : null;
  const sig2 = inner?.signal != null && typeof inner.signal === 'object' && !Array.isArray(inner.signal) ? asRec(inner.signal) : null;
  const sig1 = d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal) ? asRec(d.signal) : null;
  const sig = sig2 ?? sig1;
  if (sig && Object.keys(sig).length > 0) return sig;
  if (r.vector_forecast != null || r.recommendation != null || r.nombre_mesa != null) return r;
  return null;
}

/**
 * mesa_info: data.data.results.mesa_info | data.results.mesa_info | mesa_info plano.
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
export function extractNestedMesaInfo(raw) {
  const r = asRec(raw);
  if (!r) return null;
  const d = asRec(r.data);
  const inner = d?.data != null ? asRec(d.data) : null;
  const resultsDeep = inner?.results != null ? asRec(inner.results) : null;
  const resultsShallow = d?.results != null ? asRec(d.results) : null;
  const rRoot = r.results != null ? asRec(r.results) : null;
  const mi =
    (resultsDeep?.mesa_info != null && typeof resultsDeep.mesa_info === 'object' && !Array.isArray(resultsDeep.mesa_info)
      ? asRec(resultsDeep.mesa_info)
      : null) ??
    (resultsShallow?.mesa_info != null && typeof resultsShallow.mesa_info === 'object' && !Array.isArray(resultsShallow.mesa_info)
      ? asRec(resultsShallow.mesa_info)
      : null) ??
    (rRoot?.mesa_info != null && typeof rRoot.mesa_info === 'object' && !Array.isArray(rRoot.mesa_info) ? asRec(rRoot.mesa_info) : null) ??
    (r.mesa_info != null && typeof r.mesa_info === 'object' && !Array.isArray(r.mesa_info) ? asRec(r.mesa_info) : null);
  return mi && Object.keys(mi).length > 0 ? mi : null;
}

/**
 * Combina mesa_info previo con actualizaciones del proveedor (misma mano).
 * Arrays (cartas): conserva la versión con más elementos (reparto progresivo).
 * Objetos anidados: merge recursivo superficial.
 * @param {Record<string, unknown> | null | undefined} prev
 * @param {Record<string, unknown>} incoming
 * @returns {Record<string, unknown>}
 */
export function mergeMesaInfoProgressive(prev, incoming) {
  if (incoming == null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return prev != null && typeof prev === 'object' && !Array.isArray(prev) ? { ...prev } : {};
  }
  if (prev == null || typeof prev !== 'object' || Array.isArray(prev)) {
    return { ...incoming };
  }
  const out = { ...prev };
  for (const k of Object.keys(incoming)) {
    const v = incoming[k];
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      const pArr = Array.isArray(out[k]) ? out[k] : [];
      out[k] = v.length >= pArr.length ? v : pArr;
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const pSub = out[k] != null && typeof out[k] === 'object' && !Array.isArray(out[k]) ? /** @type {Record<string, unknown>} */ (out[k]) : {};
      out[k] = mergeMesaInfoProgressive(pSub, /** @type {Record<string, unknown>} */ (v));
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * @param {unknown} raw
 */
export function extractMesaKeyFromRaw(raw) {
  const r = asRec(raw);
  if (!r) return '';
  if (r.mesa != null && r.mesa !== '') return String(r.mesa);
  const sig = extractNestedSignal(raw);
  if (sig?.nombre_mesa != null && String(sig.nombre_mesa).trim() !== '') return String(sig.nombre_mesa).trim();
  const mi = extractNestedMesaInfo(raw);
  if (mi?.nombre_mesa != null && String(mi.nombre_mesa).trim() !== '') return String(mi.nombre_mesa).trim();
  return '';
}

/** @param {unknown} v */
export function formatForecastCell(v) {
  if (v == null) return '?';
  const s = String(v).trim().toUpperCase();
  if (s === 'B' || s.startsWith('BANK')) return 'B';
  if (s === 'P' || s.startsWith('PLAY')) return 'P';
  if (s === 'E' || s === 'T' || s.startsWith('TIE')) return 'T';
  return s.slice(0, 1) || '?';
}

/** @param {unknown} sig */
export function getVectorForecast6(sig) {
  const vf = sig?.vector_forecast;
  if (!Array.isArray(vf)) return [];
  return vf.slice(0, 6).map(formatForecastCell);
}

/** @param {unknown} sig */
export function getPatternString(sig) {
  const p = sig?.pattern ?? sig?.patron ?? sig?.secuencia;
  if (p == null) return null;
  if (Array.isArray(p)) return p.map(formatForecastCell).join(' ');
  return String(p);
}
