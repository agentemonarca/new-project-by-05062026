/**
 * Global payment rule engine: 1 USD = 1 point; module-driven AIG/USDT mix.
 * Do not duplicate these ratios in UI — use getPaymentSplit(module, priceUSD, aigPrice).
 */

import { getAigPriceUsd } from './dualTokenPayment.js';
import { assertPaymentMatchesPrice, PRICING_EPS } from '../../utils/pricing.js';

const EPS = PRICING_EPS;

/** @typedef {'mining' | 'booster' | 'staking' | 'membership' | 'gpulse' | 'gmarket'} PaymentModule */

/**
 * Central rule table: fixed = shares of **USD notional** per leg; dynamic = gmarket only.
 * @type {Record<PaymentModule, {
 *   key: PaymentModule,
 *   label: string,
 *   mode: 'fixed' | 'dynamic',
 *   aigUsdShare?: number,
 *   usdtUsdShare?: number,
 * }>}
 */
export const PAYMENT_MODULE_RULES = {
  mining: {
    key: 'mining',
    label: 'Mining · 100% AIG',
    mode: 'fixed',
    aigUsdShare: 1,
    usdtUsdShare: 0,
  },
  booster: {
    key: 'booster',
    label: 'Booster · 20% AIG / 80% USDT',
    mode: 'fixed',
    aigUsdShare: 0.2,
    usdtUsdShare: 0.8,
  },
  staking: {
    key: 'staking',
    label: 'Staking · 100% AIG',
    mode: 'fixed',
    aigUsdShare: 1,
    usdtUsdShare: 0,
  },
  membership: {
    key: 'membership',
    label: 'Membership · 50% AIG / 50% USDT',
    mode: 'fixed',
    aigUsdShare: 0.5,
    usdtUsdShare: 0.5,
  },
  gpulse: {
    key: 'gpulse',
    label: 'GPulse · 50% AIG / 50% USDT',
    mode: 'fixed',
    aigUsdShare: 0.5,
    usdtUsdShare: 0.5,
  },
  gmarket: {
    key: 'gmarket',
    label: 'Marketplace · dynamic (max AIG, rest USDT)',
    mode: 'dynamic',
  },
};

/**
 * @param {string} module
 * @returns {PaymentModule}
 */
export function normalizePaymentModule(module) {
  const k = String(module || '').toLowerCase();
  if (k in PAYMENT_MODULE_RULES) return /** @type {PaymentModule} */ (k);
  if (k === 'marketplace' || k === 'local_marketplace' || k === 'catalog') return 'gmarket';
  return 'gmarket';
}

/**
 * Genesis marketplace catalog category → engine module (fixed per category or gmarket).
 * @param {string} [category]
 * @returns {PaymentModule}
 */
export function catalogCategoryToModule(category) {
  switch (String(category || '').toLowerCase()) {
    case 'mining':
      return 'mining';
    case 'booster':
      return 'booster';
    case 'staking':
      return 'staking';
    case 'upgrade':
    default:
      return 'gmarket';
  }
}

/**
 * @param {number} priceUSD
 * @param {number} usdValueAig
 * @param {number} usdtAmount
 * @param {number} [eps]
 */
export function validateLegsSumMatchesPrice(priceUSD, usdValueAig, usdtAmount, eps = EPS) {
  const usd = Math.max(0, Number(priceUSD) || 0);
  if (usd <= 0) return false;
  const sum = Math.max(0, Number(usdValueAig) || 0) + Math.max(0, Number(usdtAmount) || 0);
  return Math.abs(sum - usd) <= eps;
}

/**
 * @param {PaymentModule | string} module
 * @param {number} priceUSD
 * @param {number} [aigPrice] USD per 1 AIG; defaults getAigPriceUsd()
 * @param {{ internalAigBalance?: number }} [options] required for gmarket dynamic / balance checks
 */
export function getPaymentSplit(module, priceUSD, aigPrice, options = {}) {
  const mod = normalizePaymentModule(module);
  const rule = PAYMENT_MODULE_RULES[mod];
  const usd = Math.max(0, Number(priceUSD) || 0);
  const px = Math.max(1e-12, Number(aigPrice) > 0 ? Number(aigPrice) : getAigPriceUsd());
  const bal = Math.max(0, Number(options.internalAigBalance) || 0);

  let usdValueAig = 0;
  let usdtAmount = 0;

  if (rule.mode === 'fixed') {
    const aS = Number(rule.aigUsdShare);
    const uS = Number(rule.usdtUsdShare);
    usdValueAig = usd * aS;
    usdtAmount = usd * uS;
  } else {
    const aigNeeded = usd / px;
    const aigApplied = Math.min(bal, aigNeeded);
    usdValueAig = aigApplied * px;
    usdtAmount = Math.max(0, usd - usdValueAig);
  }

  const aigAmount = usdValueAig / px;
  const totalUsdCovered = usdValueAig + usdtAmount;

  if (usd > 0) {
    assertPaymentMatchesPrice(usd, aigAmount, usdtAmount);
  }

  let valid = usd > 0;
  /** @type {string | null} */
  let validationError = null;
  if (usd <= 0) {
    validationError = 'Precio USD inválido';
  }

  if (valid && options.internalAigBalance != null && usdValueAig > 0) {
    if (aigAmount > bal + EPS) {
      valid = false;
      validationError = 'Saldo AIG insuficiente para este desglose';
    }
  }
  if (valid && options.internalUsdtBalance != null && usdtAmount > Number(options.internalUsdtBalance) + EPS) {
    valid = false;
    validationError = 'Saldo USDT insuficiente para este desglose';
  }

  /** Core ledger rule: 1 USD = 1 point */
  const points = usd;

  return {
    module: mod,
    ruleLabel: rule.label,
    priceUSD: usd,
    points,
    aigPriceUsd: px,
    aigAmount,
    usdtAmount,
    usdValueAig,
    usdValueUsdt: usdtAmount,
    totalUsdCovered,
    aigShareOfPrice: usd > 0 ? usdValueAig / usd : 0,
    requiresChainConfirmation: usdtAmount > EPS,
    valid,
    validationError,
  };
}
