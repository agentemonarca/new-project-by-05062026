import type { PayoutRecord } from '../domain/types.js';

function normalizeTxHash(ref: string | undefined): string | null {
  const s = String(ref || '').trim().toLowerCase();
  if (!s.startsWith('0x') || s.length < 66) return null;
  return s;
}

/**
 * Ensures each on-chain tx hash is tied to at most one payout row (collision detection).
 */
export class PayoutTxHashRegistry {
  private readonly ownerByHash = new Map<string, string>();

  constructor(seed?: readonly PayoutRecord[]) {
    if (seed?.length) this.seed(seed);
  }

  seed(records: readonly PayoutRecord[]): void {
    for (const r of records) {
      const h = normalizeTxHash(r.externalRef) ?? normalizeTxHash(r.pendingTxHash);
      if (h) {
        const ex = this.ownerByHash.get(h);
        if (ex != null && ex !== r.id) {
          throw new Error('PAYOUT_STATE_CORRUPT_DUP_TX');
        }
        this.ownerByHash.set(h, r.id);
      }
    }
  }

  /** True if a canonical tx hash is already bound to any payout. */
  hasTxHash(txHash: string): boolean {
    const h = normalizeTxHash(txHash);
    return h != null && this.ownerByHash.has(h);
  }

  /**
   * Before reserving: ensure this hash is unused or already owned by payoutId.
   */
  assertAvailableForPayout(txHash: string, payoutId: string): void {
    const h = normalizeTxHash(txHash);
    if (!h) throw new Error('PAYOUT_INVALID_TX_HASH');
    const owner = this.ownerByHash.get(h);
    if (owner != null && owner !== payoutId) {
      throw new Error('PAYOUT_TX_HASH_ALREADY_USED');
    }
  }

  /** After broadcast: bind hash → payout (must call assert first or idempotent same owner). */
  reserve(txHash: string, payoutId: string): void {
    this.assertAvailableForPayout(txHash, payoutId);
    const h = normalizeTxHash(txHash)!;
    this.ownerByHash.set(h, payoutId);
  }

  /**
   * Pre-execution guard: payout row must not already be settled on-chain for this id.
   * (Record identity is enforced by Map; this blocks bogus duplicate execution attempts.)
   */
  assertPayoutRowExecutable(rec: PayoutRecord): void {
    if (rec.status === 'completed') throw new Error('PAYOUT_ALREADY_COMPLETED');
    if (rec.status === 'rejected') throw new Error('PAYOUT_REJECTED');
    if (rec.status === 'failed') throw new Error('PAYOUT_ALREADY_FAILED');
  }
}
