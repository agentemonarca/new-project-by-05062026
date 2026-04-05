/**
 * Central HTTP client for Genesis ↔ core-api compensation routes.
 * Base URL: {@link getApiBaseUrl} (`VITE_API_URL` / `VITE_BACKEND_URL`).
 */
import { getApiBaseUrl } from './genesisConfig.js';

function authHeaders(token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/**
 * @param {string} method
 * @param {string} path — e.g. `/api/wallet`
 * @param {{ token?: string | null, body?: string }} [opts]
 */
async function requestJson(method, path, opts = {}) {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  console.log('FETCHING:', url);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: authHeaders(opts.token),
      body: opts.body,
      credentials: 'include',
    });
  } catch (e) {
    console.error('API error:', e);
    const name = e?.name || '';
    const msg = String(e?.message || e);
    if (name === 'TypeError' || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      const wrapped = new Error(
        `Network / CORS / offline — check VITE_API_URL, Railway URL, and browser console. (${msg})`,
      );
      console.error('API error:', wrapped);
      throw wrapped;
    }
    throw e;
  }

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const rawText = await res.text();
  const looksHtml = ct.includes('text/html') || rawText.trimStart().startsWith('<!');

  let data = {};
  if (looksHtml) {
    const err = new Error(
      `API returned HTML (${res.status}) at ${url} — wrong base URL, proxy, or SPA route. Set VITE_API_URL to your core-api origin.`,
    );
    console.error('API error:', err);
    throw err;
  }
  if (rawText.length === 0) {
    data = {};
  } else {
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      const err = new Error(
        `Non-JSON response (${res.status}) from ${url}: ${rawText.slice(0, 120)}${rawText.length > 120 ? '…' : ''}`,
      );
      console.error('API error:', err, parseErr);
      throw err;
    }
  }

  if (!res.ok) {
    const msg = data?.error || data?.reason || data?.message || `HTTP ${res.status}`;
    const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
    const err =
      res.status >= 500
        ? new Error(`Server error (${res.status}): ${text}`)
        : res.status === 401 || res.status === 403
          ? new Error(`Auth failed (${res.status}): ${text}`)
          : new Error(text);
    console.error('API error:', err);
    throw err;
  }

  console.log('API response:', data);
  return data;
}

/**
 * @param {string | null | undefined} token
 */
export async function fetchWallet(token) {
  return requestJson('GET', '/api/wallet', { token });
}

export async function fetchEarnings(token, limit = 100) {
  return requestJson('GET', `/api/earnings?limit=${limit}`, { token });
}

export async function fetchNetwork(token) {
  return requestJson('GET', '/api/network', { token });
}

/**
 * @param {'direct'|'mining'|'binary'} type
 * @param {Record<string, unknown>} [extra] — e.g. `{ coreId }` for per-core claims when API supports it
 */
export async function postClaim(token, type, extra = {}) {
  return requestJson('POST', '/api/claim', {
    token,
    body: JSON.stringify({ type, ...extra }),
  });
}
