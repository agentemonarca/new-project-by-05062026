import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RETENTION_PROCESSING_MS } from '../marketplace/hybridPaymentEngine.js';
import { nextOpaqueId } from '../../utils/gpulseRngPolicy.js';

/**
 * @typedef {{
 *   id: string,
 *   aig: number,
 *   usdt: number,
 *   releaseAt: number,
 *   purchaseId: string,
 * }} CashbackPendingSlice
 */

export const useHybridRetentionStore = create(
  persist(
    (set, get) => ({
      /** Lifetime totals (cashback only in this demo slice). */
      totalEarnedAig: 0,
      totalEarnedUsdt: 0,
      claimableAig: 0,
      claimableUsdt: 0,
      /** @type {CashbackPendingSlice[]} */
      pendingCashback: [],

      /**
       * @param {{ aig: number, usdt: number, purchaseId: string }} p
       */
      accrueCashback(p) {
        const aig = Math.max(0, Number(p.aig) || 0);
        const usdt = Math.max(0, Number(p.usdt) || 0);
        if (aig <= 0 && usdt <= 0) return;
        const id = nextOpaqueId('cb');
        const releaseAt = Date.now() + RETENTION_PROCESSING_MS;
        set((s) => ({
          totalEarnedAig: s.totalEarnedAig + aig,
          totalEarnedUsdt: s.totalEarnedUsdt + usdt,
          pendingCashback: [...s.pendingCashback, { id, aig, usdt, releaseAt, purchaseId: p.purchaseId }],
        }));
      },

      /** Move matured slices from processing → claimable. */
      flushMaturedToClaimable(now = Date.now()) {
        const { pendingCashback, claimableAig, claimableUsdt } = get();
        let addA = 0;
        let addU = 0;
        const keep = [];
        for (const row of pendingCashback) {
          if (row.releaseAt <= now) {
            addA += row.aig;
            addU += row.usdt;
          } else {
            keep.push(row);
          }
        }
        if (addA <= 0 && addU <= 0 && keep.length === pendingCashback.length) return;
        set({
          pendingCashback: keep,
          claimableAig: claimableAig + addA,
          claimableUsdt: claimableUsdt + addU,
        });
      },

      /** Simulate wallet payout; zero claimable buckets. */
      claimAllToWallet() {
        const s = get();
        const aig = s.claimableAig;
        const usdt = s.claimableUsdt;
        if (aig <= 0 && usdt <= 0) return { aig: 0, usdt: 0 };
        set({ claimableAig: 0, claimableUsdt: 0 });
        return { aig, usdt };
      },
    }),
    {
      name: 'gpulse-hybrid-retention-v1',
      partialize: (s) => ({
        totalEarnedAig: s.totalEarnedAig,
        totalEarnedUsdt: s.totalEarnedUsdt,
        claimableAig: s.claimableAig,
        claimableUsdt: s.claimableUsdt,
        pendingCashback: s.pendingCashback,
      }),
    },
  ),
);

/** Processing = sum of pending buckets (UI). */
export function selectRetentionProcessing(s) {
  const processingAig = s.pendingCashback.reduce((acc, r) => acc + r.aig, 0);
  const processingUsdt = s.pendingCashback.reduce((acc, r) => acc + r.usdt, 0);
  return { processingAig, processingUsdt };
}
