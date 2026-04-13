import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  MERCHANT_DEBT_DUE_MS,
  computeDebtPenaltiesAccrued,
} from '../marketplace/hybridPaymentEngine.js';
import { nextOpaqueId } from '../../utils/gpulseRngPolicy.js';

/**
 * @typedef {'open' | 'settled' | 'defaulted'} DebtStatus
 * @typedef {{
 *   id: string,
 *   merchantId: string,
 *   merchantName: string,
 *   purchaseId: string,
 *   principalUsdt: number,
 *   createdAt: number,
 *   dueAt: number,
 *   status: DebtStatus,
 *   penaltiesAccrued: number,
 *   settledAt: number | null,
 * }} MerchantDebtRecord
 */

export const useMerchantDebtStore = create(
  persist(
    (set, get) => ({
      /** @type {MerchantDebtRecord[]} */
      debts: [],

      /**
       * Fiat / USDT leg creates a settlement obligation on the merchant.
       * @param {{ merchantId: string, merchantName: string, purchaseId: string, principalUsdt: number, createdAt?: number }} p
       */
      addDebtFromFiatLeg(p) {
        const principal = Math.max(0, Number(p.principalUsdt) || 0);
        if (principal <= 0) return null;
        const createdAt = p.createdAt ?? Date.now();
        const rec = {
          id: nextOpaqueId('debt'),
          merchantId: p.merchantId,
          merchantName: p.merchantName,
          purchaseId: p.purchaseId,
          principalUsdt: principal,
          createdAt,
          dueAt: createdAt + MERCHANT_DEBT_DUE_MS,
          status: /** @type {DebtStatus} */ ('open'),
          penaltiesAccrued: 0,
          settledAt: null,
        };
        set((s) => ({ debts: [rec, ...s.debts] }));
        return rec;
      },

      /** Recompute penalties for open debts past due (demo). */
      tickPenalties(now = Date.now()) {
        set((s) => ({
          debts: s.debts.map((d) => {
            if (d.status !== 'open') return d;
            const pen = computeDebtPenaltiesAccrued(d.principalUsdt, d.dueAt, now);
            return { ...d, penaltiesAccrued: pen };
          }),
        }));
      },

      /** @param {string} id */
      settleDebt(id) {
        const t = Date.now();
        set((s) => ({
          debts: s.debts.map((d) =>
            d.id === id && d.status === 'open'
              ? { ...d, status: /** @type {DebtStatus} */ ('settled'), settledAt: t }
              : d,
          ),
        }));
      },

      /** Demo: mark overdue with heavy penalty as defaulted */
      markDefaulted(id) {
        const t = Date.now();
        set((s) => ({
          debts: s.debts.map((d) =>
            d.id === id && d.status === 'open'
              ? { ...d, status: /** @type {DebtStatus} */ ('defaulted'), settledAt: t }
              : d,
          ),
        }));
      },
    }),
    {
      name: 'gpulse-merchant-debt-v1',
      partialize: (s) => ({ debts: s.debts }),
    },
  ),
);
