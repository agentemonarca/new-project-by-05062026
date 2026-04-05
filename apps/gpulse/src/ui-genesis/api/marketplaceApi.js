/**
 * Marketplace catalog — mock data today; swap `fetchMarketplaceItems` body for API later.
 * @returns {Promise<Array<MarketplaceItem>>}
 */

/** @typedef {{ id: string, name: string, usd: number, aig: number, aigPercent: number, image?: string, category?: string }} MarketplaceItem */

/** Seed dataset (UI + future API contract) */
export const MOCK_MARKETPLACE_ITEMS = [
  {
    id: 'm1',
    name: 'Acer Predator',
    usd: 1800,
    aig: 1000,
    aigPercent: 50,
    category: 'tech',
    image: 'https://picsum.photos/seed/gpulse-acer/640/400',
  },
  {
    id: 'm2',
    name: 'AirPods',
    usd: 200,
    aig: 120,
    aigPercent: 60,
    category: 'audio',
    image: 'https://picsum.photos/seed/gpulse-pods/640/400',
  },
  {
    id: 'm3',
    name: 'Rolex Submariner',
    usd: 10000,
    aig: 6400,
    aigPercent: 80,
    category: 'luxury',
    image: 'https://picsum.photos/seed/gpulse-rolex/640/400',
  },
  {
    id: 'm4',
    name: 'MacBook Pro 16"',
    usd: 3200,
    aig: 2000,
    aigPercent: 65,
    category: 'tech',
    image: 'https://picsum.photos/seed/gpulse-mbp/640/400',
  },
  {
    id: 'm5',
    name: 'Sony A7 IV',
    usd: 2400,
    aig: 1500,
    aigPercent: 55,
    category: 'photo',
    image: 'https://picsum.photos/seed/gpulse-sony/640/400',
  },
];

/**
 * Fetch marketplace items. Replace with `fetch(\`\${getApiBaseUrl()}/api/marketplace/items\`)` when backend exists.
 */
export async function fetchMarketplaceItems() {
  await new Promise((r) => setTimeout(r, 180));
  return [...MOCK_MARKETPLACE_ITEMS];
}
