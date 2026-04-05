import { SiweMessage } from 'siwe';
import { getApiBaseUrl } from './genesisConfig.js';
import { fetchWallet, fetchEarnings, fetchNetwork, postClaim } from './genesisApi.js';

export { fetchWallet as fetchCompensationWallet };
export { fetchEarnings as fetchCompensationEarnings };
export { fetchNetwork as fetchCompensationNetwork };
export { postClaim as postCompensationClaim };

const SIWE_STATEMENT = 'Sign in to G-Pulse with Ethereum.';

/**
 * Fetch a fresh SIWE nonce (session cookie required; single-use after successful verify).
 * @param {string} base API origin (same-origin in dev via Vite proxy).
 */
export async function fetchSiweNonce(base) {
  const nonceRes = await fetch(`${base}/auth/nonce`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const nonceJson = await nonceRes.json().catch(() => ({}));
  if (!nonceRes.ok || !nonceJson?.nonce) {
    throw new Error(nonceJson?.reason || nonceJson?.message || 'nonce_failed');
  }
  return String(nonceJson.nonce);
}

/**
 * SIWE (EIP-4361) login — cookie session on core-api (`GET /auth/nonce`, `POST /auth/verify`).
 * Use with Vite dev proxy (empty `VITE_API_URL`) so cookies are same-origin.
 * Message binds domain, chainId, nonce, uri, and a short expiration window.
 */
export async function walletLoginWithSigner({ address, signer }) {
  const base = getApiBaseUrl();
  const nonce = await fetchSiweNonce(base);

  const network = await signer.provider.getNetwork();
  const chainId = Number(network.chainId);
  const domain = window.location.host;
  const issuedAt = new Date();
  const expirationTime = new Date(issuedAt.getTime() + 10 * 60 * 1000);

  const message = new SiweMessage({
    domain,
    address,
    statement: SIWE_STATEMENT,
    uri: window.location.origin,
    version: '1',
    chainId,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expirationTime: expirationTime.toISOString(),
  });

  const prepared = message.prepareMessage();
  const signature = await signer.signMessage(prepared);

  const vr = await fetch(`${base}/auth/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: prepared, signature }),
  });
  const vrJson = await vr.json().catch(() => ({}));
  if (!vr.ok || vrJson?.success !== true) {
    throw new Error(vrJson?.reason || 'verify_failed');
  }
  return { address: vrJson.address || address, sessionAuth: true };
}

export async function siweLogout() {
  const base = getApiBaseUrl();
  await fetch(`${base}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
}
