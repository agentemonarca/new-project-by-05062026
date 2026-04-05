/**
 * @typedef {'mining' | 'booster' | 'staking' | 'upgrade'} MarketplaceCategory
 *
 * @typedef {{
 *   type: 'power' | 'multiplier' | 'yield',
 *   value: number,
 * }} ProductImpact
 *
 * @typedef {{
 *   id: string,
 *   title: string,
 *   priceUsdt: number,
 *   aigPercent: number,
 *   category: MarketplaceCategory,
 *   impact: ProductImpact,
 *   image?: string,
 *   aigEquivalent?: number,
 *   legacyCategory?: string,
 * }} NormalizedMarketplaceProduct
 */

const CATEGORY_MAP = {
  tech: 'upgrade',
  audio: 'mining',
  luxury: 'staking',
  photo: 'booster',
  lifestyle: 'upgrade',
};

/**
 * @param {string} raw
 * @returns {MarketplaceCategory}
 */
export function mapLegacyCategory(raw) {
  const k = String(raw || '').toLowerCase();
  return CATEGORY_MAP[k] ?? 'upgrade';
}

/**
 * Infer protocol impact from category when API omits it.
 * @param {MarketplaceCategory} category
 */
function defaultImpactForCategory(category) {
  switch (category) {
    case 'mining':
      return { type: 'power', value: 18 };
    case 'booster':
      return { type: 'multiplier', value: 22 };
    case 'staking':
      return { type: 'yield', value: 16 };
    case 'upgrade':
    default:
      return { type: 'yield', value: 14 };
  }
}

/**
 * @param {import('../api/marketplaceApi.js').MarketplaceItem | Record<string, unknown>} raw
 * @returns {NormalizedMarketplaceProduct}
 */
export function normalizeMarketplaceItem(raw) {
  const id = String(raw.id ?? '');
  const title = String(raw.name ?? raw.title ?? 'Item');
  const priceUsdt = Number(raw.usd ?? raw.priceUsdt ?? 0);
  const aigPercent = Math.min(100, Math.max(0, Number(raw.aigPercent ?? 50)));
  const legacyCategory = raw.category != null ? String(raw.category) : undefined;
  const category = raw.category
    ? mapLegacyCategory(String(raw.category))
    : mapLegacyCategory('tech');
  const impact =
    raw.impact && typeof raw.impact === 'object' && raw.impact.type && raw.impact.value != null
      ? {
          type: raw.impact.type,
          value: Number(raw.impact.value),
        }
      : defaultImpactForCategory(category);

  return {
    id,
    title,
    priceUsdt,
    aigPercent,
    category,
    impact,
    image: raw.image,
    aigEquivalent: raw.aig != null ? Number(raw.aig) : undefined,
    legacyCategory,
  };
}

/**
 * @param {Array<import('../api/marketplaceApi.js').MarketplaceItem>} rows
 * @returns {NormalizedMarketplaceProduct[]}
 */
export function normalizeMarketplaceItems(rows) {
  return rows.map(normalizeMarketplaceItem);
}
