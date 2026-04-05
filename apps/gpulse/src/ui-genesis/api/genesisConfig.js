/** Backend + chain helpers for AiGenesis UI integration */

/**
 * Core API base URL (no trailing slash).
 * Prefer `VITE_API_URL`; falls back to `VITE_BACKEND_URL` for older configs.
 */
export function getApiBaseUrl() {
  const raw = String(import.meta.env.VITE_API_URL ?? import.meta.env.VITE_BACKEND_URL ?? '')
    .trim()
    .replace(/\/$/, '');
  if (raw !== '') return raw;
  /** DEV: empty base → same-origin `/api`, `/auth` (see vite proxy → core-api :5050). */
  if (import.meta.env.DEV) return '';
  return 'http://localhost:5050';
}

/** @deprecated Use {@link getApiBaseUrl} */
export function getBackendBaseUrl() {
  return getApiBaseUrl();
}

/** Optional dev-only Bearer for E2E when SIWE is not wired (never commit real tokens). */
export function getDevMockBearer() {
  return String(import.meta.env.VITE_DEV_MOCK_BEARER || '').trim() || null;
}

const TX_EXPLORERS = {
  1: 'https://etherscan.io/tx/',
  5: 'https://goerli.etherscan.io/tx/',
  56: 'https://bscscan.com/tx/',
  97: 'https://testnet.bscscan.com/tx/',
  137: 'https://polygonscan.com/tx/',
  42161: 'https://arbiscan.io/tx/',
};

/**
 * @param {string} txHash
 * @param {string | number} [chainId] — defaults to VITE_CHAIN_ID
 */
export function getTxExplorerUrl(txHash, chainId) {
  const h = String(txHash || '').trim();
  if (!h.startsWith('0x')) return null;
  const id = String(chainId ?? import.meta.env.VITE_CHAIN_ID ?? '1');
  const base = TX_EXPLORERS[id] || TX_EXPLORERS[1];
  return `${base}${h}`;
}

export function getMasterWalletAddress() {
  return String(import.meta.env.VITE_MASTER_WALLET_ADDRESS || '').trim();
}

if (import.meta.env.DEV && import.meta.env.VITE_VERBOSE_BOOT === '1') {
  const explicit = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL;
  if (!explicit) {
    console.debug(
      '[genesis] No VITE_API_URL / VITE_BACKEND_URL — base is "" in dev; /api is proxied to :5050 (vite.config). Set VITE_API_URL for an absolute URL.',
    );
  }
}
