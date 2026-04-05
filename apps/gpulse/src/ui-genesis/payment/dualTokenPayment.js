/**
 * AIG / USDT pricing helpers (oracle USD per AIG + leg equivalence).
 * **Module splits** live in paymentRuleEngine.js — use getPaymentSplit there.
 */

import { USDT_TO_AIG_DISPLAY } from '../types/miningCore.js';

const EPS = 1e-4;

/**
 * USD price of 1 AIG (from contract). Fallback: invert legacy display rate.
 * @returns {number}
 */
export function getAigPriceUsd() {
  const raw = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_AIG_PRICE_USD : undefined;
  const n = raw != null && String(raw).trim() !== '' ? parseFloat(String(raw)) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return 1 / Math.max(1e-12, USDT_TO_AIG_DISPLAY);
}

/**
 * @param {number} priceUSD
 * @param {number} aigPriceUsd
 * @returns {number}
 */
export function aigUnitsForFullUsdPayment(priceUSD, aigPriceUsd) {
  const usd = Math.max(0, Number(priceUSD) || 0);
  const px = Math.max(1e-12, Number(aigPriceUsd) || getAigPriceUsd());
  return usd / px;
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
