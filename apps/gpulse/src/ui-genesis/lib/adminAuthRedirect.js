const ADMIN_AUTH_LS_KEY = 'admin_auth';

export const ADMIN_LOGIN_PATH = '/admin/login';

export function clearAdminClientSession() {
  try {
    localStorage.removeItem(ADMIN_AUTH_LS_KEY);
  } catch {
    /* */
  }
}

export function redirectToAdminLogin() {
  clearAdminClientSession();
  const p = typeof window !== 'undefined' ? window.location.pathname : '';
  if (p === ADMIN_LOGIN_PATH || p.startsWith(`${ADMIN_LOGIN_PATH}/`)) return;
  window.location.replace(ADMIN_LOGIN_PATH);
}
