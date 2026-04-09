/**
 * Campos VistaLab desde el proveedor real (mesa_info + martingalaData).
 */

/**
 * @param {unknown} contador
 * @returns {string}
 */
export function martingaleStepLabel(contador) {
  const n = Number(contador);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n === 0) return 'ENTRADA';
  if (n === 1) return 'MG1';
  if (n === 2) return 'MG2';
  return `MG${n}`;
}

/**
 * @param {unknown} raw
 * @returns {number | null} epoch ms
 */
export function parseProviderTiempoActual(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const isoish = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(isoish);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * @param {Record<string, unknown> | null | undefined} working
 * @returns {Record<string, unknown> | null}
 */
export function pickMesaInfoRawFromPayload(working) {
  if (!working || typeof working !== 'object') return null;
  const w = /** @type {Record<string, unknown>} */ (working);
  const top = w.mesa_info != null && typeof w.mesa_info === 'object' && !Array.isArray(w.mesa_info) ? w.mesa_info : null;
  const d =
    w.data != null && typeof w.data === 'object' && !Array.isArray(w.data)
      ? /** @type {Record<string, unknown>} */ (w.data)
      : null;
  const d2 =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;
  const nested =
    d2?.results != null && typeof d2.results === 'object' && !Array.isArray(d2.results)
      ? /** @type {Record<string, unknown>} */ (d2.results).mesa_info
      : null;
  const nestedShallow =
    d?.results != null && typeof d.results === 'object' && !Array.isArray(d.results)
      ? /** @type {Record<string, unknown>} */ (d.results).mesa_info
      : null;

  const fromNested =
    nested != null && typeof nested === 'object' && !Array.isArray(nested)
      ? /** @type {Record<string, unknown>} */ (nested)
      : nestedShallow != null && typeof nestedShallow === 'object' && !Array.isArray(nestedShallow)
        ? /** @type {Record<string, unknown>} */ (nestedShallow)
        : null;

  if (fromNested && top) {
    return { ...fromNested, ...top };
  }
  if (fromNested) return fromNested;
  if (top) return top;
  return null;
}

/**
 * @param {Record<string, unknown> | null | undefined} working
 * @returns {Record<string, unknown> | null}
 */
export function pickMartingalaDataRoot(working) {
  if (!working || typeof working !== 'object') return null;
  const w = /** @type {Record<string, unknown>} */ (working);
  const d =
    w.data != null && typeof w.data === 'object' && !Array.isArray(w.data)
      ? /** @type {Record<string, unknown>} */ (w.data)
      : null;
  const md = d?.martingalaData ?? w.martingalaData;
  if (md != null && typeof md === 'object' && !Array.isArray(md)) return /** @type {Record<string, unknown>} */ (md);
  return null;
}

/**
 * @param {Record<string, unknown> | null} mi
 * @param {Record<string, unknown> | null} martingalaDataRoot
 * @returns {Record<string, unknown>}
 */
/**
 * Asegura `mesa_info` completo del proveedor (martingala, data_evento) cuando el envelope viene anidado en `data`.
 * @param {Record<string, unknown>} row
 */
export function mergeMesaInfoFromNestedIntoRow(row) {
  const merged = pickMesaInfoRawFromPayload(row);
  if (!merged) return;
  row.mesa_info = merged;
}

export function buildVistaLabExtras(mi, martingalaDataRoot) {
  const martFromMi =
    mi?.martingala != null && typeof mi.martingala === 'object' && !Array.isArray(mi.martingala)
      ? /** @type {Record<string, unknown>} */ (mi.martingala)
      : null;
  const mart = martFromMi ?? martingalaDataRoot;

  const de =
    mi?.data_evento != null && typeof mi.data_evento === 'object' && !Array.isArray(mi.data_evento)
      ? /** @type {Record<string, unknown>} */ (mi.data_evento)
      : null;

  const vr = Array.isArray(mart?.vector_resultado) ? mart.vector_resultado.map((x) => String(x)) : [];
  const vw = Array.isArray(mart?.vector_win) ? mart.vector_win.map((x) => String(x)) : [];
  const vf = Array.isArray(mart?.vector_forecast) ? mart.vector_forecast : [];
  const shotTotal = vf.length > 0 ? vf.length : 6;
  const shotCurrent = Math.min(vr.length, shotTotal);

  const contador = mart?.contador_martingala;
  const active = mart?.active === true;

  let tiempoRaw = de?.tiempo_actual;
  if (tiempoRaw == null && de && 'tiempo_actual' in de) tiempoRaw = de.tiempo_actual;
  const tiempoActualIso = tiempoRaw != null ? String(tiempoRaw) : null;

  return {
    martingaleStepLabel: martingaleStepLabel(contador),
    martingaleContador: contador != null && contador !== '' ? Number(contador) : null,
    martingaleActive: active,
    vectorResultado: vr,
    vectorWin: vw,
    tiempoActualIso,
    shotCurrent,
    shotTotal,
    hasProviderMartingala: Boolean(mart),
  };
}
