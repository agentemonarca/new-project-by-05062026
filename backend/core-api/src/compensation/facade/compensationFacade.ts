import { randomUUID } from 'node:crypto';
import type { CompensationRules } from '../config/compensation.js';
import type { PersistedCompensationStateV1 } from '../domain/persistence.js';
import type { ProductPack, UserId } from '../domain/types.js';
import {
  allocateAmountAcrossProducts,
  applyAllocationsToProducts,
} from '../engines/productAllocator.js';
import {
  allocateDirectBonusToReferrerProducts,
  computeDirectBonusAmount,
} from '../services/directBonus.service.js';
import { LedgerService } from '../services/ledger.service.js';
import { BinaryBonusService } from '../services/binaryBonus.service.js';
import { accruedRoiUsdt, previewMiningClaim } from '../services/roi.service.js';
import { PayoutService } from '../services/payout.service.js';
import { createExecutionQueue, createPersistingExecutionQueue } from '../store/executionQueue.js';

export type PurchaseInput = {
  buyerId: UserId;
  referrerId: UserId | null;
  principal: number;
  /** 1 = left leg placement under referrer */
  binarySide: 1 | 2;
  txRef: string;
  /** Skip direct bonus (e.g. corporate). */
  skipDirectBonus?: boolean;
};

function monthKeyUtc(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export type CompensationFacadeOptions = {
  persisted?: PersistedCompensationStateV1 | null;
  onPersistState?: (s: PersistedCompensationStateV1) => Promise<void>;
  audit?: (event: string, meta: Record<string, unknown>) => void;
};

/**
 * Single entry point for compensation operations — controllers call only this.
 */
export class CompensationFacade {
  private readonly products = new Map<string, ProductPack[]>();
  /** Deposit / purchase tx hashes already applied (idempotent recordPurchase). */
  private readonly processedPurchaseTx = new Set<string>();
  private readonly settledOnchainPayoutTxHashes = new Set<string>();
  private readonly run: <T>(fn: () => Promise<T>) => Promise<T>;
  private readonly onPersistState?: (s: PersistedCompensationStateV1) => Promise<void>;

  readonly ledger: LedgerService;
  readonly binary: BinaryBonusService;
  readonly payouts: PayoutService;

  constructor(
    private readonly rules: CompensationRules,
    payout: PayoutService,
    opts?: CompensationFacadeOptions,
  ) {
    const init = opts?.persisted;
    const audit = opts?.audit;
    this.onPersistState = opts?.onPersistState;

    this.ledger = new LedgerService(init?.ledger, (row) => {
      audit?.('audit_ledger_append', {
        entryId: row.id,
        userId: row.userId,
        direction: row.direction,
        category: row.category,
        amount: row.amount,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        ts: row.ts,
      });
    });
    this.binary = new BinaryBonusService(rules);
    if (init?.binary?.nodes?.length || init?.binary?.volumePoints?.length) {
      this.binary.hydrateSnapshot(init.binary);
    }
    this.payouts = payout;

    for (const h of init?.processedPurchaseTx ?? []) {
      this.processedPurchaseTx.add(String(h).toLowerCase());
    }
    for (const h of init?.settledOnchainPayoutTxHashes ?? []) {
      this.settledOnchainPayoutTxHashes.add(String(h).toLowerCase());
    }
    if (init?.productsByUser) {
      for (const [uid, packs] of Object.entries(init.productsByUser)) {
        this.products.set(uid, [...packs]);
      }
    }

    if (this.onPersistState) {
      const persist = this.onPersistState;
      this.run = createPersistingExecutionQueue(() => persist(this.exportState()));
    } else {
      this.run = createExecutionQueue();
    }
  }

  exportState(): PersistedCompensationStateV1 {
    return {
      version: 1,
      ledger: [...this.ledger.allEntries()],
      processedPurchaseTx: [...this.processedPurchaseTx],
      settledOnchainPayoutTxHashes: [...this.settledOnchainPayoutTxHashes],
      productsByUser: Object.fromEntries(this.products),
      binary: this.binary.exportSnapshot(),
      payouts: { records: this.payouts.allRecords() },
    };
  }

  private productsFor(userId: UserId): ProductPack[] {
    if (!this.products.has(userId)) this.products.set(userId, []);
    return this.products.get(userId)!;
  }

  private productMap(userId: UserId): Map<string, ProductPack> {
    const m = new Map<string, ProductPack>();
    for (const p of this.productsFor(userId)) m.set(p.id, p);
    return m;
  }

  /**
   * On pack purchase: create buyer product, optional direct bonus to referrer, binary placement, volume propagation.
   */
  async recordPurchase(input: PurchaseInput): Promise<void> {
    await this.run(async () => {
      const txKey = String(input.txRef || '').toLowerCase();
      if (!txKey) return;
      if (this.processedPurchaseTx.has(txKey)) return;
      const now = Date.now();
      const buyerProduct: ProductPack = {
        id: randomUUID(),
        userId: input.buyerId,
        principal: input.principal,
        totalClaimed: 0,
        claimDateMs: now,
        active: true,
        isPaying: true,
      };
      this.productsFor(input.buyerId).push(buyerProduct);

      this.ledger.append({
        userId: input.buyerId,
        direction: 'CREDIT',
        category: 'purchase_principal',
        amount: input.principal,
        currency: 'USDT',
        referenceType: 'tx',
        referenceId: input.txRef,
        metadata: { productId: buyerProduct.id },
      });

      if (input.referrerId && !input.skipDirectBonus) {
        const bonus = computeDirectBonusAmount(input.principal, this.rules);
        if (bonus > 0) {
          const refProducts = this.productsFor(input.referrerId);
          const alloc = allocateDirectBonusToReferrerProducts(bonus, refProducts, this.rules);
          const map = this.productMap(input.referrerId);
          applyAllocationsToProducts(map, alloc.allocations, this.rules.roiCap);

          this.ledger.append({
            userId: input.referrerId,
            direction: 'CREDIT',
            category: 'direct_referral',
            amount: alloc.totalApplied,
            currency: 'USDT',
            referenceType: 'purchase',
            referenceId: input.txRef,
            metadata: { allocations: alloc.allocations, remainder: alloc.remainder },
          });

          if (alloc.remainder > 0) {
            this.ledger.append({
              userId: input.referrerId,
              direction: 'CREDIT',
              category: 'direct_referral_overflow',
              amount: Math.round(alloc.remainder * 1e8) / 1e8,
              currency: 'USDT',
              referenceType: 'purchase',
              referenceId: input.txRef,
              metadata: { reason: 'no_pack_headroom' },
            });
          }
        }
      }

      if (input.referrerId) {
        if (!this.binary.getNode(input.referrerId)) this.binary.ensureRoot(input.referrerId);
        if (!this.binary.getNode(input.buyerId)) {
          this.binary.placeUser(input.buyerId, input.referrerId, input.binarySide);
        }
      } else {
        this.binary.ensureRoot(input.buyerId);
      }

      this.binary.distributeVolumeFromPurchase(input.buyerId, input.principal, now);

      this.processedPurchaseTx.add(txKey);
    });
  }

  /**
   * Wallet view — all compensation balances derived from append-only ledger (+ products live in memory).
   */
  getWallet(userId: UserId): {
    directClaimableUsdt: number;
    ledgerNetUsdt: number;
    byCategory: Record<string, number>;
  } {
    return {
      directClaimableUsdt: this.ledger.netDirectReferralClaimable(userId),
      ledgerNetUsdt: this.ledger.balanceUsdt(userId),
      byCategory: this.ledger.aggregateNetByCategory(userId),
    };
  }

  listEarnings(userId: UserId, limit = 100) {
    return this.ledger.listForUser(userId, limit);
  }

  getNetwork(userId: UserId) {
    return this.binary.snapshotNetwork(userId);
  }

  async claimDirect(userId: UserId): Promise<{ ok: boolean; amount: number; payoutId?: string }> {
    return this.run(async () => {
      const amount = this.ledger.netDirectReferralClaimable(userId);
      if (amount <= 0) return { ok: false, amount: 0 };

      const debit = this.ledger.append({
        userId,
        direction: 'DEBIT',
        category: 'claim_direct',
        amount,
        currency: 'USDT',
        referenceType: 'claim',
        referenceId: `direct_claim:${randomUUID()}`,
      });

      const p = await this.payouts.enqueue({
        userId,
        amount,
        source: 'direct',
        idempotencyKey: `direct:${userId}:${debit.id}`,
      });

      return { ok: true, amount, payoutId: p.id };
    });
  }

  async claimMining(userId: UserId): Promise<{ ok: boolean; amount: number; error?: string; payoutId?: string }> {
    return this.run(async () => {
      const now = Date.now();
      const all = this.productsFor(userId);
      const prev = previewMiningClaim(userId, all, now, this.rules);
      if (!prev.meetsMinimum) {
        return { ok: false, amount: prev.totalAccrued, error: 'below_min_withdraw' };
      }

      let total = 0;
      const map = this.productMap(userId);
      for (const p of prev.products) {
        const add = accruedRoiUsdt(p, now, this.rules);
        if (add <= 0) continue;
        p.totalClaimed += add;
        p.claimDateMs = now;
        total += add;
        if (p.totalClaimed >= p.principal * this.rules.roiCap - 1e-9) p.active = false;
      }

      total = Math.round(total * 1e8) / 1e8;
      const credit = this.ledger.append({
        userId,
        direction: 'CREDIT',
        category: 'mining_claim',
        amount: total,
        currency: 'USDT',
        referenceType: 'claim',
        referenceId: `mining_claim:${randomUUID()}`,
      });

      const pay = await this.payouts.enqueue({
        userId,
        amount: total,
        source: 'mining',
        idempotencyKey: `mining:${userId}:${credit.id}`,
      });

      return { ok: true, amount: total, payoutId: pay.id };
    });
  }

  async claimBinary(userId: UserId): Promise<{ ok: boolean; amount: number; error?: string; payoutId?: string }> {
    return this.run(async () => {
      if (!this.binary.canClaimBinary(userId)) {
        return { ok: false, amount: 0, error: 'binary_not_qualified' };
      }
      const mk = monthKeyUtc(Date.now());
      const { reward, case: k } = this.binary.computeMonthlyBinaryReward(userId, mk);
      if (reward <= 0) return { ok: false, amount: 0, error: 'no_binary_reward' };

      const refProducts = this.productsFor(userId);
      const alloc = allocateAmountAcrossProducts(reward, refProducts, this.rules.roiCap);
      const map = this.productMap(userId);
      applyAllocationsToProducts(map, alloc.allocations, this.rules.roiCap);

      if (k === 'tie') this.binary.clearMonthRemaindersAfterPayout(userId, mk, 'tie');
      else if (k === 'left') {
        this.binary.clearMonthRemaindersAfterPayout(userId, mk, 'left');
        this.binary.discountStrongerLeg(userId, mk, 'left');
      } else {
        this.binary.clearMonthRemaindersAfterPayout(userId, mk, 'right');
        this.binary.discountStrongerLeg(userId, mk, 'right');
      }

      this.ledger.append({
        userId,
        direction: 'CREDIT',
        category: 'binary_monthly',
        amount: alloc.totalApplied,
        currency: 'USDT',
        referenceType: 'claim',
        referenceId: mk,
        metadata: { case: k, rawReward: reward },
      });

      const pay = await this.payouts.enqueue({
        userId,
        amount: alloc.totalApplied,
        source: 'binary',
        idempotencyKey: `binary:${userId}:${mk}`,
      });

      return { ok: true, amount: alloc.totalApplied, payoutId: pay.id };
    });
  }

  /**
   * After on-chain payout confirms: offsets `mining_claim` / `binary_monthly` credits.
   * Direct claims are settled only by `claim_direct` (no duplicate debit).
   * Idempotent by tx hash (exactly one `payout_onchain` debit per chain tx).
   */
  async recordPayoutSettled(input: {
    userId: UserId;
    amount: number;
    source: 'direct' | 'mining' | 'binary';
    txHash: string;
    payoutId: string;
  }): Promise<void> {
    await this.run(async () => {
      if (input.source === 'direct') return;
      const h = String(input.txHash || '').toLowerCase();
      if (!h.startsWith('0x') || h.length < 66) return;
      if (this.settledOnchainPayoutTxHashes.has(h)) return;
      const dup = [...this.ledger.allEntries()].some(
        (e) =>
          e.userId === input.userId &&
          e.category === 'payout_onchain' &&
          e.referenceType === 'tx' &&
          String(e.referenceId).toLowerCase() === h,
      );
      if (dup) {
        this.settledOnchainPayoutTxHashes.add(h);
        return;
      }

      this.ledger.append({
        userId: input.userId,
        direction: 'DEBIT',
        category: 'payout_onchain',
        amount: input.amount,
        currency: 'USDT',
        referenceType: 'tx',
        referenceId: input.txHash,
        metadata: { source: input.source, payoutId: input.payoutId },
      });
      this.settledOnchainPayoutTxHashes.add(h);
    });
  }
}

export function createCompensationFacade(
  rules: CompensationRules,
  payout: PayoutService,
  opts?: CompensationFacadeOptions,
): CompensationFacade {
  return new CompensationFacade(rules, payout, opts);
}
