/**
 * URL ↔ sidebar `nav` id for Genesis dashboard navigation.
 * Marketplace: `/marketplace` · GPulse lobby: `/gpulse-lobby` · full shell: `/gpulse`
 */

/** Registered dashboard nav ids with a concrete path (invalid / unknown URLs fall back to genesis lobby). */
const NAV_TO_PATH = {
  dashboard: '/dashboard',
  mining: '/mining',
  booster: '/booster',
  staking: '/staking',
  network: '/network',
  wallet: '/wallet',
  marketplace: '/marketplace',
  gpulse: '/gpulse',
  'gpulse-lobby': '/gpulse-lobby',
  'genesis-lobby': '/genesis-lobby',
  promo: '/promo',
  p2p: '/p2p',
  topg: '/topg',
  nft: '/nft',
  profile: '/profile',
  history: '/history',
  support: '/support',
};

const PATH_TO_NAV = {
  '/': 'genesis-lobby',
  '/dashboard': 'dashboard',
  '/mining': 'mining',
  '/booster': 'booster',
  '/staking': 'staking',
  '/gpulse': 'gpulse',
  '/marketplace': 'marketplace',
  '/marketplace/local': 'marketplace',
  '/marketplace/merchant': 'marketplace',
  '/network': 'network',
  '/comunidad': 'network',
  '/wallet': 'wallet',
  '/portfolio': 'wallet',
  '/ledger': 'history',
  '/transactions': 'history',
  '/history': 'history',
  '/profile': 'profile',
  '/support': 'support',
  '/ai': 'support',
  '/settings': 'profile',
  '/gpulse-lobby': 'gpulse-lobby',
  '/genesis-lobby': 'genesis-lobby',
  '/promo': 'promo',
  '/p2p': 'p2p',
  '/topg': 'topg',
  '/nft': 'nft',
};

/** @type {readonly string[]} */
export const GENESIS_NAV_IDS = Object.freeze(Object.keys(NAV_TO_PATH));

/** @param {string | null | undefined} navId */
export function normalizeGenesisNav(navId) {
  const id = String(navId ?? '').trim();
  if (id && Object.prototype.hasOwnProperty.call(NAV_TO_PATH, id)) return id;
  return 'genesis-lobby';
}

/** @param {string} pathname */
export function pathToNav(pathname) {
  const p = (pathname || '/').replace(/\/$/, '') || '/';
  return PATH_TO_NAV[p] ?? 'genesis-lobby';
}

/** @param {string} navId */
export function navToPath(navId) {
  const id = normalizeGenesisNav(navId);
  return NAV_TO_PATH[id] ?? '/genesis-lobby';
}
