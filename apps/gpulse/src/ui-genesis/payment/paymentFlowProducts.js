import { USDT_TO_AIG_DISPLAY } from '../types/miningCore.js';

/** @typedef {'booster' | 'mining' | 'gpulse' | 'staking'} PaymentFlowProductId */

/** @type {Record<PaymentFlowProductId, { id: PaymentFlowProductId, label: string, shortLabel: string, usdtShare: number, aigShare: number }>} */
export const PAYMENT_FLOW_PRODUCTS = {
  booster: {
    id: 'booster',
    label: 'AiG Booster',
    shortLabel: 'Booster',
    usdtShare: 0.8,
    aigShare: 0.2,
  },
  mining: {
    id: 'mining',
    label: 'Mining Core',
    shortLabel: 'Mining',
    usdtShare: 0,
    aigShare: 1,
  },
  gpulse: {
    id: 'gpulse',
    label: 'GPulse Membership',
    shortLabel: 'GPulse',
    usdtShare: 0.5,
    aigShare: 0.5,
  },
  staking: {
    id: 'staking',
    label: 'Staking',
    shortLabel: 'Staking',
    usdtShare: 0.5,
    aigShare: 0.5,
  },
};

/**
 * @param {PaymentFlowProductId} productId
 * @param {number} totalUsdtNotional — one input: economic size in USDT for all products
 * @returns {{ usdt: number, aig: number, totalUsdtEquivalent: number }}
 */
export function computeTokenBreakdown(productId, totalUsdtNotional) {
  const p = PAYMENT_FLOW_PRODUCTS[productId];
  const t = Math.max(0, Number(totalUsdtNotional) || 0);
  const usdt = t * p.usdtShare;
  const aigLeg = t * p.aigShare;
  const aig = p.aigShare > 0 ? aigLeg / USDT_TO_AIG_DISPLAY : 0;
  return { usdt, aig, totalUsdtEquivalent: t };
}
