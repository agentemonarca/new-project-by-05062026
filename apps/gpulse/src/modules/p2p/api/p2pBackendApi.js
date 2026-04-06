/**
 * Cliente HTTP para P2P Genesis (core-api, prefijo /api).
 * Solo se usa cuando VITE_P2P_USE_BACKEND=true.
 *
 * Endpoints:
 * - POST /api/p2p/order/create
 * - POST /api/p2p/order/execute  body: { makerOrderId, qty? }
 * - GET  /api/p2p/orderbook?projectId=genesis&side=sell|buy
 * - GET  /api/p2p/orders/user?projectId=genesis
 */
import { getApiBaseUrl } from '@/ui-genesis/api/genesisConfig.js';

function headers(token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { _raw: text };
  }
}

/** @param {Record<string, unknown>} data */
function errMessage(data, fallback) {
  const e = data?.error;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e) return String(e.message);
  if (typeof data?.message === 'string') return data.message;
  return fallback;
}

/**
 * @param {unknown} data
 * @returns {Record<string, unknown>[]}
 */
export function normalizeP2pOrdersArray(data) {
  const raw = data && typeof data === 'object' && 'orders' in data ? data.orders : null;
  if (!Array.isArray(raw)) return [];
  return raw.filter((o) => o && typeof o === 'object');
}

/**
 * @param {string | null | undefined} token
 * @param {object} body
 */
export async function p2pCreateOrderBackend(token, body) {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/api/p2p/order/create`, {
    method: 'POST',
    credentials: 'include',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, `HTTP ${res.status}`));
  return data;
}

export async function p2pExecuteOrderBackend(token, { makerOrderId, qty }) {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/api/p2p/order/execute`, {
    method: 'POST',
    credentials: 'include',
    headers: headers(token),
    body: JSON.stringify({ makerOrderId, ...(qty != null ? { qty } : {}) }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, `HTTP ${res.status}`));
  return data;
}

export async function p2pCancelOrderBackend(token, orderId) {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/api/p2p/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    credentials: 'include',
    headers: headers(token),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, `HTTP ${res.status}`));
  return data;
}

export async function p2pFetchOrderbookBackend(token, { projectId = 'genesis', side = 'sell' }) {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const q = new URLSearchParams({ projectId, side });
  const res = await fetch(`${base}/api/p2p/orderbook?${q}`, {
    credentials: 'include',
    headers: headers(token),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, `HTTP ${res.status}`));
  return { ...data, orders: normalizeP2pOrdersArray(data) };
}

export async function p2pFetchUserOrdersBackend(token, { projectId = 'genesis' }) {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const q = new URLSearchParams({ projectId });
  const res = await fetch(`${base}/api/p2p/orders/user?${q}`, {
    credentials: 'include',
    headers: headers(token),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, `HTTP ${res.status}`));
  return { ...data, orders: normalizeP2pOrdersArray(data) };
}
