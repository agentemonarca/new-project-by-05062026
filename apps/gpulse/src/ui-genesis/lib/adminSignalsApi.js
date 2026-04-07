/**
 * Llamadas a /api/admin/signals/* con cookie SIWE, sesión admin (POST /api/admin/auth/login)
 * y/o `X-Admin-Api-Key` (mismo valor que GENESIS_ADMIN_API_KEY en core-api).
 *
 * Debug en consola: `VITE_ADMIN_SIGNALS_DEBUG=1` en apps/gpulse/.env (también activo en `import.meta.env.DEV`).
 */
import { redirectToAdminLogin } from './adminAuthRedirect.js';

const ADMIN_KEY = String(import.meta.env.VITE_GENESIS_ADMIN_API_KEY || '').trim();

const DEBUG =
  Boolean(import.meta.env.DEV) || String(import.meta.env.VITE_ADMIN_SIGNALS_DEBUG || '').trim() === '1';

function logFetchRequest(path, headers) {
  if (!DEBUG) return;
  const hk =
    headers.get('X-Admin-Api-Key') || headers.get('x-admin-api-key') || '';
  console.log('[adminSignalsFetch] →', path, {
    credentials: 'include',
    xAdminApiKey: hk ? `set (len=${hk.length})` : 'missing',
    viteAdminKeyEnv: ADMIN_KEY ? `set (len=${ADMIN_KEY.length})` : 'missing',
  });
}

async function logFetchResponse(path, res) {
  if (!DEBUG) return res;
  let preview = '';
  try {
    preview = (await res.clone().text()).slice(0, 500);
  } catch {
    preview = '(could not read body)';
  }
  console.log('[adminSignalsFetch] ←', path, res.status, preview);
  return res;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export function adminSignalsFetch(path, init = {}) {
  const headers = new Headers(init.headers ?? undefined);
  if (ADMIN_KEY && !headers.has('X-Admin-Api-Key') && !headers.has('x-admin-api-key')) {
    headers.set('X-Admin-Api-Key', ADMIN_KEY);
  }
  logFetchRequest(path, headers);

  return fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  })
    .then((res) => logFetchResponse(path, res))
    .then((res) => {
      if (res.status === 401) {
        redirectToAdminLogin();
        throw new Error('Unauthorized');
      }
      return res;
    });
}
