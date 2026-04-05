import { randomUUID } from 'node:crypto';
import type { LedgerEntry, UserId } from '../domain/types.js';

export type LedgerAppendInput = {
  userId: UserId;
  direction: 'CREDIT' | 'DEBIT';
  category: string;
  amount: number;
  currency: 'USDT';
  referenceType: string;
  referenceId: string;
  metadata?: Record<string, unknown>;
};

const MAX_USDT_NOTIONAL = 1e12;
const MIN_POSITIVE = 1e-12;

function validateLedgerWrite(input: LedgerAppendInput): void {
  if (!input.userId || typeof input.userId !== 'string') throw new Error('ledger_invalid_user');
  if (!input.category || typeof input.category !== 'string') throw new Error('ledger_invalid_category');
  if (!input.referenceType || !input.referenceId) throw new Error('ledger_invalid_reference');
  if (input.currency !== 'USDT') throw new Error('ledger_invalid_currency');
  const a = input.amount;
  if (!Number.isFinite(a) || a < MIN_POSITIVE || a > MAX_USDT_NOTIONAL) {
    throw new Error('ledger_invalid_amount');
  }
  const rounded = Math.round(a * 1e8) / 1e8;
  if (Math.abs(rounded - a) > 1e-10) throw new Error('ledger_amount_precision');
}

/**
 * Append-only ledger: entries are never updated or deleted in place.
 */
export class LedgerService {
  private readonly entries: LedgerEntry[];
  private readonly onAppend?: (row: LedgerEntry) => void;

  constructor(
    initial?: readonly LedgerEntry[],
    onAppend?: (row: LedgerEntry) => void,
  ) {
    this.entries = initial?.length ? [...initial] : [];
    this.onAppend = onAppend;
  }

  append(input: LedgerAppendInput): LedgerEntry {
    validateLedgerWrite(input);
    const row: LedgerEntry = {
      id: randomUUID(),
      ts: Date.now(),
      userId: input.userId,
      direction: input.direction,
      category: input.category,
      amount: Math.round(input.amount * 1e8) / 1e8,
      currency: input.currency,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      metadata: input.metadata ?? {},
    };
    this.entries.push(row);
    this.onAppend?.(row);
    return row;
  }

  listForUser(userId: UserId, limit = 200): LedgerEntry[] {
    return this.entries.filter((e) => e.userId === userId).slice(-limit);
  }

  /** Sum credits minus debits for wallet balance (USDT). */
  balanceUsdt(userId: UserId): number {
    let b = 0;
    for (const e of this.entries) {
      if (e.userId !== userId) continue;
      if (e.direction === 'CREDIT') b += e.amount;
      else b -= e.amount;
    }
    const rounded = Math.round(b * 1e8) / 1e8;
    if (rounded < -1e-6) throw new Error('ledger_negative_net_balance');
    return rounded;
  }

  allEntries(): readonly LedgerEntry[] {
    return this.entries;
  }

  /**
   * Net USDT for direct-referral bucket: credits `direct_referral` (+ optional overflow) minus debits `claim_direct`.
   * Source of truth for claimable direct payouts.
   */
  netDirectReferralClaimable(userId: UserId): number {
    let s = 0;
    for (const e of this.entries) {
      if (e.userId !== userId) continue;
      if (e.direction === 'CREDIT' && (e.category === 'direct_referral' || e.category === 'direct_referral_overflow')) {
        s += e.amount;
      }
      if (e.direction === 'DEBIT' && e.category === 'claim_direct') {
        s -= e.amount;
      }
    }
    const rounded = Math.round(s * 1e8) / 1e8;
    if (rounded < -1e-6) throw new Error('ledger_negative_direct_claimable');
    return rounded;
  }

  /** Aggregate net by category (credits − debits tagged to that category). */
  aggregateNetByCategory(userId: UserId): Record<string, number> {
    const m: Record<string, number> = {};
    for (const e of this.entries) {
      if (e.userId !== userId) continue;
      const k = e.category;
      if (!m[k]) m[k] = 0;
      if (e.direction === 'CREDIT') m[k] += e.amount;
      else m[k] -= e.amount;
    }
    for (const k of Object.keys(m)) {
      m[k] = Math.round(m[k] * 1e8) / 1e8;
    }
    return m;
  }
}
