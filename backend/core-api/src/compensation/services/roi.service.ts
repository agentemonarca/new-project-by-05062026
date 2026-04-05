import type { CompensationRules } from '../config/compensation.js';
import type { ProductPack, UserId } from '../domain/types.js';

/**
 * Per-second ROI accrual, capped per product at principal * roiCap.
 * Legacy: rewardPerSecond = (principal * (roiMonthly / secondsPerMonth)) — equivalent to
 * linear accrual of roiMonthly * principal over one month window.
 */
export function accruedRoiUsdt(product: ProductPack, nowMs: number, rules: CompensationRules): number {
  if (!product.active || !product.isPaying) return 0;
  const elapsedSec = Math.max(0, (nowMs - product.claimDateMs) / 1000);
  const perSecond = (product.principal * rules.roiMonthly) / rules.secondsPerRoiMonth;
  const raw = perSecond * elapsedSec;
  const capTotal = product.principal * rules.roiCap;
  const remaining = Math.max(0, capTotal - product.totalClaimed);
  return Math.min(raw, remaining);
}

export function roiHeadroom(product: ProductPack, rules: CompensationRules): number {
  const capTotal = product.principal * rules.roiCap;
  return Math.max(0, capTotal - product.totalClaimed);
}

export type MiningClaimPreview = {
  products: ProductPack[];
  totalAccrued: number;
  meetsMinimum: boolean;
};

export function previewMiningClaim(
  userId: UserId,
  products: ProductPack[],
  nowMs: number,
  rules: CompensationRules,
): MiningClaimPreview {
  const mine = products.filter((p) => p.userId === userId && p.active && p.isPaying);
  let totalAccrued = 0;
  for (const p of mine) {
    totalAccrued += accruedRoiUsdt(p, nowMs, rules);
  }
  return {
    products: mine,
    totalAccrued: Math.round(totalAccrued * 1e8) / 1e8,
    meetsMinimum: totalAccrued >= rules.minWithdraw,
  };
}
