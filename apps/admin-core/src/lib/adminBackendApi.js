/**
 * Llamadas al core-api con `?source=genesis|winx|gpulse` para lecturas multi-Mongo.
 * En dev, Vite debe hacer proxy de `/api` → core-api (p. ej. 5050).
 */

import { redirectToAdminLogin } from './adminAuthRedirect.js';

/** @type {readonly { id: 'genesis' | 'winx' | 'gpulse', label: string, short: string }[]} */
export const MONGO_DB_OPTIONS = [
  { id: 'genesis', label: 'Genesis', short: 'GNS' },
  { id: 'winx', label: 'Winx', short: 'WNX' },
  { id: 'gpulse', label: 'G-Pulse', short: 'GP' },
];

/**
 * @param {string} path — ruta relativa, p. ej. `/api/admin/signals/metrics` o con query previa
 * @param {'genesis' | 'winx' | 'gpulse'} source
 */
export function buildAdminApiUrl(path, source) {
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://127.0.0.1:5190';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const u = new URL(normalized, base);
  u.searchParams.set('source', source);
  return `${u.pathname}${u.search}`;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 * @param {'genesis' | 'winx' | 'gpulse'} source
 */
export async function adminApiFetch(path, init = {}, source = 'genesis') {
  const url = buildAdminApiUrl(path, source);
  const { headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders ?? undefined);
  if (
    rest.body != null &&
    !(rest.body instanceof FormData) &&
    !(rest.body instanceof URLSearchParams) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, {
    credentials: 'include',
    ...rest,
    headers,
  });

  if (res.status === 401) {
    redirectToAdminLogin();
    throw new Error('Unauthorized');
  }

  return res;
}
