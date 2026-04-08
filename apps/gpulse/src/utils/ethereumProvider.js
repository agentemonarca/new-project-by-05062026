/**
 * Safe access to the browser EIP-1193 provider (MetaMask, multi-wallet `providers`, etc.).
 * Do not mutate or wrap the returned object in ways that break the extension's internals.
 */

function isEip1193Provider(p) {
  return Boolean(p && typeof p === 'object' && typeof p.request === 'function');
}

/**
 * @returns {import('ethers').Eip1193Provider | null}
 */
export function getInjectedEthereum() {
  if (typeof window === 'undefined') return null;
  const eth = window.ethereum;
  if (!eth) return null;

  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    const list = eth.providers;
    const preferred =
      list.find((p) => isEip1193Provider(p) && p.isMetaMask === true) ||
      list.find((p) => isEip1193Provider(p));
    if (isEip1193Provider(preferred)) return preferred;
  }

  return isEip1193Provider(eth) ? eth : null;
}
