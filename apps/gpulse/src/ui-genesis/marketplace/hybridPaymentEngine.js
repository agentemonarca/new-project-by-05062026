/**
 * Hybrid checkout math: AIG-denominated transaction value, cashback, debt/retention constants.
 */

import { getAigPriceUsd, totalAigVolumeUnits } from '../payment/dualTokenPayment.js';

/** Cashback rate on amounts paid in each rail (1.5%). */
export const HYBRID_CASHBACK_RATE = 0.015;

/** Time merchant has to cover fiat leg (demo: 7 days). */
export const MERCHANT_DEBT_DUE_MS = 7 * 24 * 60 * 60 * 1000;

/** Daily penalty on overdue principal (demo: 0.5% / day on simulated debt). */
export const MERCHANT_DEBT_PENALTY_DAILY_RATE = 0.005;

/** Cashback sits in "processing" until this delay elapses (demo: 48h). */
export const RETENTION_PROCESSING_MS = 48 * 60 * 60 * 1000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Total transaction size in AIG units: paid AIG + USDT leg / AIG-price-USD (contract oracle).
 * @param {number} usd
 * @param {number} aig
 * @param {number} [aigPriceUsd]
 */
export function totalTransactionAigValue(usd, aig, aigPriceUsd = getAigPriceUsd()) {
  return totalAigVolumeUnits(usd, aig, aigPriceUsd);
}

/**
 * 1.5% of each paid leg, returned in the same asset (crypto rail).
 * @param {number} usd
 * @param {number} aig
 * @returns {{ cashbackAig: number, cashbackUsdt: number }}
 */
export function computeHybridCashbackAmounts(usd, aig) {
  const u = Math.max(0, Number(usd) || 0);
  const a = Math.max(0, Number(aig) || 0);
  return {
    cashbackAig: a * HYBRID_CASHBACK_RATE,
    cashbackUsdt: u * HYBRID_CASHBACK_RATE,
  };
}

/**
 * @param {number} principal
 * @param {number} dueAt
 * @param {number} now
 */
export function computeDebtPenaltiesAccrued(principal, dueAt, now = Date.now()) {
  const p = Math.max(0, Number(principal) || 0);
  if (p <= 0 || now <= dueAt) return 0;
  const days = Math.floor((now - dueAt) / MS_PER_DAY);
  return p * MERCHANT_DEBT_PENALTY_DAILY_RATE * Math.max(0, days);
}
