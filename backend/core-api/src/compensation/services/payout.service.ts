import { randomUUID } from 'node:crypto';
import type { PayoutRecord, UserId } from '../domain/types.js';
import { createKeyedMutex } from '../utils/keyedMutex.js';
import type { PayoutTxHashRegistry } from './payoutTxRegistry.js';

export type PayoutExecuteContext = {
  /** Called immediately after a tx is broadcast; persist here so hash is never "lost". */
  onBroadcast: (txHash: string) => Promise<void>;
};

export type PayoutExecuteFn = (
  p: PayoutRecord,
  ctx: PayoutExecuteContext,
) => Promise<{ externalRef: string }>;

export type PayoutServiceOptions = {
  /** If true, auto-approve and run execute hook immediately. */
  isWhitelisted: (userId: UserId) => boolean;
  /** Mint / chain transfer — optional for tests. */
  onExecute?: PayoutExecuteFn;
  /** Optional: reject duplicate tx hashes across payout rows. */
  txRegistry?: PayoutTxHashRegistry;
  /** Persist durable state after payout row mutations (e.g. pending tx). */
  onAfterPayoutRecordChange?: () => Promise<void>;
};

export type PayoutServiceInit = {
  records?: readonly PayoutRecord[];
};

/**
 * Pending vs approved queue with idempotency keys (no duplicate payouts).
 */
export class PayoutService {
  private readonly records = new Map<string, PayoutRecord>();
  private readonly idempotency = new Set<string>();
  private readonly mutex = createKeyedMutex();

  constructor(
    private readonly opts: PayoutServiceOptions,
    init?: PayoutServiceInit,
  ) {
    if (init?.records?.length) {
      for (const r of init.records) {
        this.records.set(r.id, { ...r });
        this.idempotency.add(r.idempotencyKey);
      }
    }
  }

  allRecords(): PayoutRecord[] {
    return [...this.records.values()];
  }

  private isTerminalSuccess(rec: PayoutRecord): boolean {
    if (rec.status !== 'completed') return false;
    const ref = rec.externalRef || '';
    return (
      (ref.startsWith('0x') && ref.length >= 66) ||
      ref.startsWith('noop:') ||
      ref.startsWith('skipped') ||
      ref.startsWith('zero:')
    );
  }

  /**
   * Enqueue a payout. Whitelist users are marked approved and executed synchronously when onExecute is set.
   */
  async enqueue(input: {
    userId: UserId;
    amount: number;
    source: PayoutRecord['source'];
    idempotencyKey: string;
  }): Promise<PayoutRecord> {
    if (this.idempotency.has(input.idempotencyKey)) {
      const existing = [...this.records.values()].find((r) => r.idempotencyKey === input.idempotencyKey);
      if (existing) return existing;
    }

    const wl = this.opts.isWhitelisted(input.userId);
    const rec: PayoutRecord = {
      id: randomUUID(),
      userId: input.userId,
      amount: input.amount,
      currency: 'USDT',
      source: input.source,
      status: wl ? 'approved' : 'pending',
      idempotencyKey: input.idempotencyKey,
      createdAtMs: Date.now(),
      resolvedAtMs: wl ? Date.now() : undefined,
    };

    this.records.set(rec.id, rec);
    this.idempotency.add(input.idempotencyKey);

    if (wl && this.opts.onExecute) {
      await this.runExecuteOnce(rec);
    }

    return rec;
  }

  get(id: string): PayoutRecord | undefined {
    return this.records.get(id);
  }

  listPending(): PayoutRecord[] {
    return [...this.records.values()].filter((r) => r.status === 'pending');
  }

  private async runExecuteOnce(rec: PayoutRecord): Promise<void> {
    if (!this.opts.onExecute) return;
    if (this.isTerminalSuccess(rec)) return;
    if (rec.status === 'failed' || rec.status === 'rejected') return;

    await this.mutex.runExclusive(`user:${rec.userId}`, async () => {
      await this.mutex.runExclusive(`payout:${rec.id}`, async () => {
        await this.runExecuteUnderLocks(rec);
      });
    });
  }

  private async runExecuteUnderLocks(rec: PayoutRecord): Promise<void> {
    if (!this.opts.onExecute) return;
    if (this.isTerminalSuccess(rec)) return;
    if (rec.status === 'failed' || rec.status === 'rejected') return;

    if (rec.executionStartedAtMs == null) {
      rec.executionStartedAtMs = Date.now();
    }

    this.opts.txRegistry?.assertPayoutRowExecutable(rec);

    const ctx: PayoutExecuteContext = {
      onBroadcast: async (txHash: string) => {
        this.exportsTxAssertAndStage(rec, txHash);
        await this.opts.onAfterPayoutRecordChange?.();
      },
    };

    try {
      const { externalRef } = await this.opts.onExecute(rec, ctx);
      rec.externalRef = externalRef;
      const realTx = externalRef.startsWith('0x') && externalRef.length >= 66;
      if (realTx) {
        rec.chainStatus = 'confirmed';
        rec.pendingTxHash = undefined;
      }
      rec.status = 'completed';
      rec.resolvedAtMs = Date.now();
    } catch (e) {
      if (rec.pendingTxHash) {
        rec.chainStatus = 'failed';
      }
      rec.status = 'failed';
      throw e;
    } finally {
      await this.opts.onAfterPayoutRecordChange?.();
    }
  }

  private exportsTxAssertAndStage(rec: PayoutRecord, txHash: string): void {
    this.opts.txRegistry?.assertAvailableForPayout(txHash, rec.id);
    this.opts.txRegistry?.reserve(txHash, rec.id);
    rec.pendingTxHash = txHash;
    rec.chainStatus = 'broadcast';
  }

  async approve(payoutId: string, approve: boolean): Promise<PayoutRecord | undefined> {
    const rec = this.records.get(payoutId);
    if (!rec || rec.status !== 'pending') return undefined;
    rec.status = approve ? 'approved' : 'rejected';
    rec.resolvedAtMs = Date.now();
    if (approve && this.opts.onExecute) {
      await this.runExecuteOnce(rec);
    }
    return rec;
  }
}
