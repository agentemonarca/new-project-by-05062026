/**
 * AIG / USDT pricing helpers (oracle USD per AIG + leg equivalence).
 * **USD/AIG rate** comes from `src/utils/pricing.js` only.
 * **Module splits** live in paymentRuleEngine.js — use getPaymentSplit there.
 */

import { getAigPrice, usdToAig } from '../../utils/pricing.js';

const EPS = 1e-4;

/**
 * USD price of 1 AIG (single global oracle).
 * @returns {number}
 */
export function getAigPriceUsd() {
  return getAigPrice();
}

/**
 * @param {number} priceUSD
 * @param {number} [aigPriceUsd]
 * @returns {number}
 */
export function aigUnitsForFullUsdPayment(priceUSD, aigPriceUsd) {
  const usd = Math.max(0, Number(priceUSD) || 0);
  const override = Number(aigPriceUsd);
  if (Number.isFinite(override) && override > 0 && Math.abs(override - getAigPrice()) > 1e-12) {
    return usd / Math.max(1e-12, override);
  }
  return usdToAig(usd);
}

/**
 * @param {number} aigAmount
 * @param {number} aigPriceUsd
 */
export function usdValueOfAig(aigAmount, aigPriceUsd) {
  const px = Math.max(1e-12, Number(aigPriceUsd) || getAigPriceUsd());
  return Math.max(0, Number(aigAmount) || 0) * px;
}

/**
 * @param {number} usdtLeg
 * @param {number} aigLeg
 * @param {number} aigPriceUsd
 */
export function usdEquivalentFromDualLegs(usdtLeg, aigLeg, aigPriceUsd) {
  const u = Math.max(0, Number(usdtLeg) || 0);
  return u + usdValueOfAig(aigLeg, aigPriceUsd);
}

/**
 * @param {number} usdtLeg
 * @param {number} aigLeg
 * @param {number} aigPriceUsd
 */
export function totalAigVolumeUnits(usdtLeg, aigLeg, aigPriceUsd) {
  const px = Math.max(1e-12, Number(aigPriceUsd) || getAigPriceUsd());
  return Math.max(0, Number(aigLeg) || 0) + Math.max(0, Number(usdtLeg) || 0) / px;
}

/** @param {{ valid: boolean, validationError?: string | null, totalUsdCovered?: number, priceUSD?: number }} split */
export function assertDualPlanCoversPrice(split) {
  if (!split?.valid) {
    throw new Error(split?.validationError || 'Plan de pago inválido');
  }
  if (
    split.priceUSD != null &&
    split.totalUsdCovered != null &&
    Math.abs(split.totalUsdCovered - split.priceUSD) > EPS
  ) {
    throw new Error('Validación USD→AIG+USDT fallida');
  }
}
