/**
 * Trazas de diagnóstico NEW_RESULT (no altera lógica de negocio).
 * `RESULT LOST AT` siempre en fallo (una línea). Cadena 🧨📍🧠… con RESULT_FULL_TRACE=1.
 */

const on = String(process.env.RESULT_FULL_TRACE ?? '').trim() === '1';

/** @param {string} layer */
export function logResultLostAt(layer) {
  console.error('RESULT LOST AT:', layer);
}

export function isResultFullTraceOn() {
  return on;
}

/** Logs de cadena 🧨📍🧠… solo con RESULT_FULL_TRACE=1 */
export function traceVerbose(...args) {
  if (!on) return;
  console.log(...args);
}

export function traceError(...args) {
  if (!on) return;
  console.error(...args);
}
