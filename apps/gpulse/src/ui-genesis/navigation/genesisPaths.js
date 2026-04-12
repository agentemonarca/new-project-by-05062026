/**
 * URL ↔ sidebar `nav` id for Genesis dashboard navigation.
 *
 * - Shell de ejecución G-Pulse (App.jsx): **solo** {@link GPULSE_APP_SHELL_PATH} (`/gpulse`).
 * - Lobbies Genesis/GPulse en dashboard: unificados en `/dashboard?nav=genesis-lobby` y `?nav=gpulse-lobby`
 *   (las rutas `/genesis-lobby` y `/gpulse-lobby` redirigen allí).
 */

/** Ruta canónica del motor G-Pulse (baccarat / IA Real). No confundir con el lobby Genesis. */
export const GPULSE_APP_SHELL_PATH = '/gpulse';

/**
 * Registered dashboard nav ids with a concrete path (invalid / unknown URLs fall back to genesis lobby).
 * Módulos que solo viven en `GenesisDashboardPage` usan `/dashboard?nav=…` — no rutas sueltas como `/p2p`,
 * porque sin `<Route>` explícita caen en `*` y se monta el shell G-Pulse (`App.jsx`).
 */
const NAV_TO_PATH = {
  dashboard: '/dashboard',
  mining: '/dashboard?nav=mining',
  booster: '/dashboard?nav=booster',
  staking: '/dashboard?nav=staking',
  network: '/dashboard?nav=network',
  wallet: '/dashboard?nav=wallet',
  marketplace: '/marketplace',
  gpulse: GPULSE_APP_SHELL_PATH,
  'gpulse-lobby': '/dashboard?nav=gpulse-lobby',
  'genesis-lobby': '/dashboard?nav=genesis-lobby',
  promo: '/dashboard?nav=promo',
  p2p: '/dashboard?nav=p2p',
  topg: '/dashboard?nav=topg',
  nft: '/dashboard?nav=nft',
  profile: '/dashboard?nav=profile',
  history: '/dashboard?nav=history',
  support: '/dashboard?nav=support',
};

/**
 * Segmentos de path que antes resolvían a un `nav` pero no tenían `<Route>` (404 → `*` → G-Pulse).
 * Redirigen a `/dashboard?nav=…` para enlaces guardados.
 * @type {readonly [path: string, navId: string][]}
 */
export const LEGACY_DASHBOARD_PATH_REDIRECTS = Object.freeze([
  ['/mining', 'mining'],
  ['/booster', 'booster'],
  ['/staking', 'staking'],
  ['/network', 'network'],
  ['/comunidad', 'network'],
  ['/wallet', 'wallet'],
  ['/portfolio', 'wallet'],
  ['/ledger', 'history'],
  ['/transactions', 'history'],
  ['/history', 'history'],
  ['/profile', 'profile'],
  ['/support', 'support'],
  ['/ai', 'support'],
  ['/settings', 'profile'],
  ['/promo', 'promo'],
  ['/p2p', 'p2p'],
  ['/topg', 'topg'],
  ['/nft', 'nft'],
]);

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
  /** Compat: redirigen a `/dashboard?nav=…` */
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

/**
 * @param {string} pathname
 * @param {string} [search] — `location.search` (`?nav=gpulse-lobby` tiene prioridad sobre el segmento de path)
 */
export function pathToNav(pathname, search = '') {
  const qs = typeof search === 'string' && search.startsWith('?') ? search.slice(1) : String(search ?? '');
  const params = new URLSearchParams(qs);
  const navQ = params.get('nav');
  if (navQ) {
    const id = normalizeGenesisNav(navQ);
    if (id && Object.prototype.hasOwnProperty.call(NAV_TO_PATH, id)) {
      return id;
    }
  }
  const p = (pathname || '/').replace(/\/$/, '') || '/';
  return PATH_TO_NAV[p] ?? 'genesis-lobby';
}

/** @param {string} navId */
export function navToPath(navId) {
  const id = normalizeGenesisNav(navId);
  return NAV_TO_PATH[id] ?? '/dashboard?nav=genesis-lobby';
}
