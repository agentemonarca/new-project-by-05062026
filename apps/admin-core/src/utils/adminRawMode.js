/**
 * Modo visor / RAW: sin rechazo por validadores; payload del proveedor se conserva y se enriquece
 * con campos de UI (mesa/ronda/forecast6/colores) leyendo también `data.signal`, etc.
 *
 * @see VITE_ADMIN_RAW_MODE=1 o VITE_ADMIN_VIEWER_MODE=1 en `.env` local (no commitear secretos).
 */
export function isAdminRawMode() {
  if (typeof import.meta === 'undefined' || !import.meta.env) return false;
  const e = /** @type {Record<string, string | undefined>} */ (import.meta.env);
  return e.VITE_ADMIN_RAW_MODE === '1' || e.VITE_ADMIN_VIEWER_MODE === '1';
}
