import type { ProductPack } from '../domain/types.js';

export type AllocationLine = {
  productId: string;
  applied: number;
  /** Remaining headroom before this allocation (for audit). */
  headroomBefore: number;
};

export type AllocateResult = {
  /** Ordered allocations (stable sort by product id). */
  allocations: AllocationLine[];
  /** Sum of applied amounts. */
  totalApplied: number;
  /** Input amount that could not be placed (no headroom). */
  remainder: number;
};

/**
 * Deterministic, sequential absorption of an incoming amount across active packs.
 * Replaces legacy async forEach + non-deterministic ordering.
 *
 * Rules:
 * - Products processed in ascending `id` order (lexicographic).
 * - Each pack absorbs up to: principal * roiCap - totalClaimed (non-negative).
 * - Inactive packs skipped.
 */
export function allocateAmountAcrossProducts(
  amount: number,
  products: ProductPack[],
  roiCap: number,
): AllocateResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { allocations: [], totalApplied: 0, remainder: 0 };
  }

  const sorted = [...products].filter((p) => p.active).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  let remaining = amount;
  const allocations: AllocationLine[] = [];

  for (const p of sorted) {
    if (remaining <= 0) break;
    const cap = p.principal * roiCap;
    const headroom = Math.max(0, cap - p.totalClaimed);
    if (headroom <= 0) continue;

    const applied = Math.min(remaining, headroom);
    allocations.push({
      productId: p.id,
      applied,
      headroomBefore: headroom,
    });
    remaining -= applied;
  }

  const totalApplied = allocations.reduce((s, a) => s + a.applied, 0);
  return {
    allocations,
    totalApplied,
    remainder: remaining,
  };
}

/**
 * Apply allocation lines to product objects **mutating** `totalClaimed` in stable order.
 * Caller must hold any lock / transaction.
 */
export function applyAllocationsToProducts(
  productsById: Map<string, ProductPack>,
  allocations: AllocationLine[],
  roiCap: number,
): void {
  const sorted = [...allocations].sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0));
  for (const line of sorted) {
    const p = productsById.get(line.productId);
    if (!p || !p.active) continue;
    p.totalClaimed += line.applied;
    const cap = p.principal * roiCap;
    if (p.totalClaimed >= cap - 1e-9) {
      p.active = false;
    }
  }
}
