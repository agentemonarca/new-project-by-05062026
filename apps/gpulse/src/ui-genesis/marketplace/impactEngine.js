import { getAigPriceUsd } from '../payment/dualTokenPayment.js';
import { aigToUsd } from '../../utils/pricing.js';
import {
  catalogCategoryToModule,
  getPaymentSplit as paymentEngineSplit,
} from '../payment/paymentRuleEngine.js';
import { getLegacyProtocolNextAction } from '../core/nextActionEngine.js';

/**
 * @typedef {import('./normalize.js').NormalizedMarketplaceProduct} NormalizedMarketplaceProduct
 */

/** Sales-facing verb per category (replace raw category IDs in UI). */
export const MARKETPLACE_CATEGORY_VERB = /** @type {const} */ ({
  mining: 'Generate',
  booster: 'Boost',
  staking: 'Earn',
  upgrade: 'Boost',
});

/** Stand-in when `useOptionalCore()` is null (standalone marketplace route). */
export const STANDALONE_CORE_SNAPSHOT = {
  totalYieldAigPerSecond: 0.00012,
  totalYieldUsdtPerSecond: 0.00013,
  totalPower: 0.0004,
  energy: 42,
  multiplier: 1.18,
  power: 0.28,
  stakingYield: 0.04,
  aigBalance: 5000,
};

/**
 * Map product impact to a unified % lift on displayed output.
 * @param {NormalizedMarketplaceProduct} product
 * @returns {number}
 */
export function impactToOutputPercent(product) {
  const v = Number(product.impact?.value ?? 12);
  const t = product.impact?.type ?? 'yield';
  const cap = (x) => Math.min(48, Math.max(4, x));
  switch (t) {
    case 'power':
      return cap(v * 1.15);
    case 'multiplier':
      return cap(v * 1.05);
    case 'yield':
    default:
      return cap(v * 1.08);
  }
}

/**
 * @param {NormalizedMarketplaceProduct} product
 * @param {Record<string, unknown> | null | undefined} core
 * @returns {{
 *   estimatedAigPerDay: number,
 *   estimatedUsdtPerSecond: number,
 *   percentageIncrease: number,
 *   paybackTime: number,
 * }}
 */
export function calculateProductImpact(product, core) {
  const baseAigS = Number(core?.totalYieldAigPerSecond ?? STANDALONE_CORE_SNAPSHOT.totalYieldAigPerSecond);
  const pct = impactToOutputPercent(product);
  const afterAigS = baseAigS * (1 + pct / 100);
  const incAigS = Math.max(0, afterAigS - baseAigS);
  const estimatedAigPerDay = incAigS * 86400;
  const estimatedUsdtPerSecond = incAigS > 0 ? aigToUsd(incAigS) : 0;
  const incrementalUsdtDay = estimatedUsdtPerSecond * 86400;
  const paybackRaw = product.priceUsdt / Math.max(1e-12, incrementalUsdtDay);
  const paybackTime = Number.isFinite(paybackRaw) ? Math.min(9999, Math.max(0, paybackRaw)) : 9999;

  return {
    estimatedAigPerDay,
    estimatedUsdtPerSecond,
    percentageIncrease: Math.round(pct * 10) / 10,
    paybackTime,
  };
}

/**
 * Before / after for UI (AIG/s display path).
 * @param {Record<string, unknown> | null | undefined} core
 * @param {NormalizedMarketplaceProduct} product
 */
export function compareBeforeAfter(core, product) {
  const baseAigS = Number(core?.totalYieldAigPerSecond ?? STANDALONE_CORE_SNAPSHOT.totalYieldAigPerSecond);
  const pct = impactToOutputPercent(product);
  const afterAigS = baseAigS * (1 + pct / 100);
  return {
    beforeAigPerSecond: baseAigS,
    afterAigPerSecond: afterAigS,
    beforeAigPerDay: baseAigS * 86400,
    afterAigPerDay: afterAigS * 86400,
    percentageIncrease: Math.round(pct * 10) / 10,
  };
}

const CATEGORY_ORDER = { mining: 0, booster: 1, staking: 2, upgrade: 3 };

/**
 * @param {NormalizedMarketplaceProduct} a
 * @param {NormalizedMarketplaceProduct} b
 */
function categoryPriority(a, b) {
  return (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9);
}

/**
 * Sort for conversion: ROI (payback) → % increase → category.
 * @param {NormalizedMarketplaceProduct[]} products
 * @param {Record<string, unknown> | null | undefined} core
 * @returns {NormalizedMarketplaceProduct[]}
 */
export function sortMarketplaceProducts(products, core) {
  const scored = products.map((p) => ({
    p,
    imp: calculateProductImpact(p, core),
  }));
  scored.sort((x, y) => {
    const pb = x.imp.paybackTime - y.imp.paybackTime;
    if (Math.abs(pb) > 1e-6) return pb;
    const pc = y.imp.percentageIncrease - x.imp.percentageIncrease;
    if (Math.abs(pc) > 1e-6) return pc;
    return categoryPriority(x.p, y.p);
  });
  return scored.map((s) => s.p);
}

/**
 * Loss aversion line (incremental AIG/day left on table if user skips upgrades in this tier).
 * @param {Record<string, unknown> | null | undefined} core
 * @param {NormalizedMarketplaceProduct} product
 */
export function formatLossAversionLine(core, product) {
  const imp = calculateProductImpact(product, core);
  const v = Math.round(imp.estimatedAigPerDay);
  if (v < 1) return null;
  return `Earn +${v.toLocaleString()} AIG/day when you activate — don’t leave this boost on the table`;
}

/**
 * Contextual merchandising tags.
 * @param {NormalizedMarketplaceProduct} product
 * @param {Record<string, unknown> | null | undefined} core
 * @param {number} sortedIndex
 */
export function getProductContextTag(product, core, sortedIndex) {
  if (sortedIndex === 0) return { icon: '🔥', label: 'Max earn rate' };
  const mult = Number(core?.multiplier ?? 1);
  if (product.category === 'booster' && mult < 1.5) {
    return { icon: '⚡', label: 'Boost ready' };
  }
  const stake = Number(core?.stakingYield ?? 0);
  if (product.category === 'staking' && stake < 0.05) {
    return { icon: '💎', label: 'Earn more' };
  }
  if (sortedIndex < 3) return { icon: '✨', label: 'Smart pick' };
  return { icon: '✨', label: 'Strong earn' };
}

/**
 * Whether this listing aligns with `getLegacyProtocolNextAction(core)` (conversion funnel).
 * @param {NormalizedMarketplaceProduct} product
 * @param {Record<string, unknown> | null | undefined} core
 */
export function productAlignsWithNextAction(product, core) {
  if (!core) return false;
  const next = getLegacyProtocolNextAction(core);
  switch (next.type) {
    case 'activate_booster':
      return product.category === 'booster';
    case 'inject_mining':
      return product.category === 'mining';
    case 'start_staking':
      return product.category === 'staking';
    case 'go_marketplace':
    default:
      return true;
  }
}

/**
 * Checkout amounts for marketplace catalog — uses **paymentRuleEngine** (no hardcoded ratios here).
 * @param {NormalizedMarketplaceProduct} product
 * @param {{
 *   module?: import('../payment/paymentRuleEngine.js').PaymentModule,
 *   internalAigBalance?: number,
 *   internalUsdtBalance?: number,
 *   aigPriceUsd?: number,
 * }} [options]
 */
export function getPaymentSplit(product, options = {}) {
  const priceUSD = Number(product.priceUsdt ?? 0);
  const module = options.module ?? catalogCategoryToModule(product.category);
  const internalAigBalance =
    options.internalAigBalance ?? Number(STANDALONE_CORE_SNAPSHOT.aigBalance ?? 0);
  const internalUsdtBalance = options.internalUsdtBalance;
  const aigPriceUsd = options.aigPriceUsd ?? getAigPriceUsd();
  const plan = paymentEngineSplit(module, priceUSD, aigPriceUsd, {
    internalAigBalance,
    internalUsdtBalance,
  });
  const aigPercent = priceUSD > 0 ? Math.round(plan.aigShareOfPrice * 100) : 0;
  return {
    usdtAmount: plan.usdtAmount,
    aigAmount: plan.aigAmount,
    aigPercent,
    listUsdt: priceUSD,
    points: plan.points,
    module: plan.module,
    plan,
  };
}

/** High-conversion primary button label by listing category. */
export function getProductCtaLabel(product) {
  switch (product.category) {
    case 'booster':
      return 'Activate now';
    case 'mining':
      return 'Start earning';
    case 'staking':
      return 'Activate now';
    case 'upgrade':
    default:
      return 'Start earning';
  }
}

/**
 * Social proof — stable per calendar day (demo catalogue).
 * @param {string} [salt]
 */
export function getMarketplaceSocialProofToday(salt = '') {
  const d = new Date();
  const dayKey = d.getFullYear() * 366 + d.getMonth() * 31 + d.getDate();
  let h = dayKey;
  for (let i = 0; i < salt.length; i++) h = (h * 33 + salt.charCodeAt(i)) | 0;
  const activations = 620 + (Math.abs(h) % 380);
  const slotsLeft = 8 + (Math.abs(h >> 3) % 14);
  return { activations, slotsLeft };
}

/**
 * @param {number} sortedIndex
 * @returns {{ label: string, variant: 'fire'|'bolt'|'star'|'spark' }}
 */
export function getPopularityBadge(sortedIndex) {
  if (sortedIndex === 0) return { label: 'Best ROI', variant: 'fire' };
  if (sortedIndex === 1) return { label: 'Trending', variant: 'bolt' };
  if (sortedIndex < 4) return { label: 'Fan favorite', variant: 'star' };
  return { label: 'Popular', variant: 'spark' };
}

/**
 * Deterministic “slots filled” % for urgency bar (58–94).
 * @param {import('./normalize.js').NormalizedMarketplaceProduct} product
 */
export function getListingUrgencyPercent(product) {
  const id = String(product?.id ?? 'x');
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return 58 + (Math.abs(h) % 37);
}
