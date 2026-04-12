/**
 * Activa trazas extra en cliente al ingerir resultados (evita ruido por defecto).
 * `VITE_RESULT_FULL_TRACE=1` en `.env` y reiniciar Vite.
 */
export function isResultFullTraceClient() {
  return import.meta.env.VITE_RESULT_FULL_TRACE === '1';
}
