import type { CompensationRules } from '../config/compensation.js';
import type { ProductPack } from '../domain/types.js';
import { allocateAmountAcrossProducts, type AllocateResult } from '../engines/productAllocator.js';

/**
 * Direct referral bonus: percentage of purchase principal credited to referrer,
 * then absorbed across referrer's product caps (deterministic allocator).
 */
export function computeDirectBonusAmount(principal: number, rules: CompensationRules): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  return Math.round(principal * rules.directBonus * 1e8) / 1e8;
}

export function allocateDirectBonusToReferrerProducts(
  bonusAmount: number,
  referrerProducts: ProductPack[],
  rules: CompensationRules,
): AllocateResult {
  return allocateAmountAcrossProducts(bonusAmount, referrerProducts, rules.roiCap);
}
