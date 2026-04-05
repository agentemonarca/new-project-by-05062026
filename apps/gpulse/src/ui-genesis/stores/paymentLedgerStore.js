import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeLedgerEvent } from '../ledger/normalize.js';

const MAX = 200;

/**
 * Client-side activation rows merged into LedgerProvider timeline.
 * @typedef {{
 *   product: string,
 *   usdt: number,
 *   aig: number,
 *   totalUsdtEquivalent: number,
 *   txHash: string,
 *   ts: number,
 *   binaryVolumePts: number,
 *   directBonusUsdt: number,
 *   paymentModule?: string,
 *   points?: number,
 * }} PaymentActivationDetail
 */

function trim(events) {
  return events.slice(0, MAX);
}

export const usePaymentLedgerStore = create(
  persist(
    (set, get) => ({
      /** @type {import('../ledger/ledgerModel.js').LedgerEvent[]} */
      events: [],

      /** @param {PaymentActivationDetail & { aigPriceUsd?: number, requiresChainConfirmation?: boolean }} d */
      appendActivation(d) {
        const ts = d.ts ?? Date.now();
        const mod = d.paymentModule != null ? String(d.paymentModule) : null;
        const pts = d.points != null ? Number(d.points) : d.totalUsdtEquivalent;
        const base = {
          id: `pay-act-${ts}-${Math.random().toString(36).slice(2, 9)}`,
          ts,
          category:
            d.product === 'booster'
              ? 'booster'
              : d.product === 'mining'
                ? 'mining'
                : d.product === 'staking'
                  ? 'staking'
                  : 'marketplace',
          kind: 'product_activation',
          title:
            d.product === 'booster'
              ? 'Activación · Booster'
              : d.product === 'mining'
                ? 'Activación · Mining Core'
                : d.product === 'staking'
                  ? 'Activación · Staking'
                  : 'Activación · GPulse Membership',
          summary: `USDT ${d.usdt.toFixed(4)} · AIG ${d.aig.toFixed(4)} · ${d.totalUsdtEquivalent.toFixed(2)} USD · ${pts.toFixed(2)} pts · ${mod ?? 'module'}`,
          amountUsdt: d.totalUsdtEquivalent,
          amountAig: d.aig,
          txHash: d.txHash,
          txStatus: 'confirmed',
          meta: {
            product: d.product,
            breakdown: { usdt: d.usdt, aig: d.aig },
            binaryVolumePts: d.binaryVolumePts,
            directBonusUsdt: d.directBonusUsdt,
            paymentModule: d.paymentModule,
            points: pts,
            aigPriceUsd: d.aigPriceUsd,
            requiresChainConfirmation: d.requiresChainConfirmation,
          },
        };
        const main = normalizeLedgerEvent(base);
        const bonusRaw = {
          id: `pay-direct-${ts}-${Math.random().toString(36).slice(2, 9)}`,
          ts: ts + 1,
          category: 'network',
          kind: 'direct_bonus_activation',
          title: 'Bono directo (referencia 11%)',
          summary: `Estimado +${d.directBonusUsdt.toFixed(4)} USDT sobre posición`,
          amountUsdt: d.directBonusUsdt,
          txHash: d.txHash,
          meta: { parentKind: 'activation', product: d.product },
        };
        const bonus = normalizeLedgerEvent(bonusRaw);
        set({ events: trim([main, bonus, ...get().events]) });
      },

      /**
       * Persist smart marketplace revenue rows (purchase + referral + platform fee).
       * @param {Array<Record<string, unknown>>} raws
       */
      appendLedgerEvents(raws) {
        if (!raws?.length) return;
        const normalized = raws.map((r) => normalizeLedgerEvent(r));
        set({ events: trim([...normalized, ...get().events]) });
      },

      clear() {
        set({ events: [] });
      },
    }),
    {
      name: 'genesis-payment-ledger-v1',
      partialize: (s) => ({ events: s.events }),
    },
  ),
);
