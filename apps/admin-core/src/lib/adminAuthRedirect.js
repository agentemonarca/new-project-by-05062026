import { ADMIN_AUTH_STORAGE_KEY } from './adminAuthConstants.js';

export const ADMIN_LOGIN_PATH = '/admin/login';

/** Limpieza cliente ante 401 / socket rechazado (cookie la invalida el servidor). */
export function clearAdminClientSession() {
  try {
    localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
  } catch {
    /* */
  }
  try {
    sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
  } catch {
    /* */
  }
}

/** Redirección completa fuera del panel (evita estado React obsoleto). */
export function redirectToAdminLogin() {
  clearAdminClientSession();
  const p = typeof window !== 'undefined' ? window.location.pathname : '';
  if (p === ADMIN_LOGIN_PATH || p.startsWith(`${ADMIN_LOGIN_PATH}/`)) return;
  window.location.replace(ADMIN_LOGIN_PATH);
}
