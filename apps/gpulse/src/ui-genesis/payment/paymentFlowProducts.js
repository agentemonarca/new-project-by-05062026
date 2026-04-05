/**
 * Genesis activation SKUs: fixed USD + **payment module** (see PAYMENT_MODULE_RULES).
 */

import { getAigPriceUsd } from './dualTokenPayment.js';
import { getPaymentSplit as engineGetPaymentSplit } from './paymentRuleEngine.js';

/** @typedef {'booster' | 'mining' | 'gpulse' | 'staking'} PaymentFlowProductId */

/** @type {Record<PaymentFlowProductId, { id: PaymentFlowProductId, label: string, shortLabel: string, priceUSD: number, module: import('./paymentRuleEngine.js').PaymentModule }>} */
export const PAYMENT_FLOW_PRODUCTS = {
  booster: {
    id: 'booster',
    label: 'AiG Booster',
    shortLabel: 'Booster',
    priceUSD: 299,
    module: 'booster',
  },
  mining: {
    id: 'mining',
    label: 'Mining Core',
    shortLabel: 'Mining',
    priceUSD: 500,
    module: 'mining',
  },
  gpulse: {
    id: 'gpulse',
    label: 'GPulse Membership',
    shortLabel: 'GPulse',
    priceUSD: 99,
    module: 'gpulse',
  },
  staking: {
    id: 'staking',
    label: 'Staking',
    shortLabel: 'Staking',
    priceUSD: 250,
    module: 'staking',
  },
};

/**
 * @param {PaymentFlowProductId} productId
 * @param {number} [internalAigBalance]
 * @param {number} [internalUsdtBalance]
 * @param {number} [aigPriceUsd]
 */
export function computeActivationPaymentPlan(
  productId,
  internalAigBalance = 0,
  internalUsdtBalance = 0,
  aigPriceUsd,
) {
  const p = PAYMENT_FLOW_PRODUCTS[productId] ?? PAYMENT_FLOW_PRODUCTS.booster;
  return engineGetPaymentSplit(p.module, p.priceUSD, aigPriceUsd ?? getAigPriceUsd(), {
    internalAigBalance,
    internalUsdtBalance,
  });
}

/**
 * @deprecated Use computeActivationPaymentPlan — signature kept for imports.
 */
export function computeTokenBreakdown(productId, _totalUsdtNotional, _rail, internalAigBalance = 0) {
  const plan = computeActivationPaymentPlan(productId, internalAigBalance);
  return {
    usdt: plan.usdtAmount,
    aig: plan.aigAmount,
    totalUsdtEquivalent: plan.priceUSD,
    points: plan.points,
  };
}

export { getAigPriceUsd };
