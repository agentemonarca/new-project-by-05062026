/** Máximo de celdas martingala (T1–T6) — alineado con `executionEngine` / `padForecastVector`. */
export const PROVIDER_MARTINGALE_MAX_STEPS = 6;

/**
 * @param {unknown} arr
 * @param {number} [maxSteps]
 * @returns {unknown[]}
 */
export function clampArrayToMaxSteps(arr, maxSteps = PROVIDER_MARTINGALE_MAX_STEPS) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, maxSteps);
}

/**
 * Recorta vectores del proveedor para evitar OOB y datos incoherentes.
 * Con `vector_forecast` no vacío, `vector_resultado` / `vector_win` no pueden superar su longitud (tras el recorte a maxSteps).
 * `undefined` en entrada se mantiene (no se convierte en `[]`) para no romper dedupe que usa `fallbackContador` en huellas.
 *
 * @param {{
 *   vector_forecast?: unknown;
 *   vector_resultado?: unknown;
 *   vector_win?: unknown;
 * }} v
 * @param {number} [maxSteps]
 * @returns {{ vector_forecast: unknown[]; vector_resultado: unknown[] | undefined; vector_win: unknown[] | undefined }}
 */
export function clampProviderMartingaleVectors(v, maxSteps = PROVIDER_MARTINGALE_MAX_STEPS) {
  const vfIn = v.vector_forecast;
  const vrIn = v.vector_resultado;
  const vwIn = v.vector_win;

  let vector_forecast = Array.isArray(vfIn) ? vfIn.slice(0, maxSteps) : [];
  let vector_resultado =
    vrIn === undefined ? undefined : Array.isArray(vrIn) ? vrIn.slice(0, maxSteps) : [];
  let vector_win = vwIn === undefined ? undefined : Array.isArray(vwIn) ? vwIn.slice(0, maxSteps) : [];

  const cap = vector_forecast.length;
  if (cap > 0) {
    if (Array.isArray(vector_resultado) && vector_resultado.length > cap) {
      vector_resultado = vector_resultado.slice(0, cap);
    }
    if (Array.isArray(vector_win) && vector_win.length > cap) {
      vector_win = vector_win.slice(0, cap);
    }
  }

  return { vector_forecast, vector_resultado, vector_win };
}

/**
 * Índice 0-based seguro sobre un vector de predicción ya normalizado (p. ej. `state.vector`).
 * @param {number} idx
 * @param {unknown[]} vector
 */
export function safeForecastVectorIndex(idx, vector) {
  if (!Array.isArray(vector) || vector.length === 0) return 0;
  const maxIdx = vector.length - 1;
  const n = Number(idx);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(0, Math.floor(n)), maxIdx);
}
