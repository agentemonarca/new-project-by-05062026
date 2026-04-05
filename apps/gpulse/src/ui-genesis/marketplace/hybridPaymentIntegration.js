/**
 * Orchestrates cashback accrual, merchant fiat debt, and ties into growth payout (AIG-based binary).
 */

import { useHybridRetentionStore } from '../stores/hybridRetentionStore.js';
import { useMerchantDebtStore } from '../stores/merchantDebtStore.js';
import { useLocalMarketplaceUserStore } from '../stores/localMarketplaceUserStore.js';
import { computeHybridCashbackAmounts } from './hybridPaymentEngine.js';

/**
 * @param {{
 *   purchaseId: string,
 *   merchantId: string,
 *   merchantName: string,
 *   usd: number,
 *   aig: number,
 * }} p
 */
export function applyHybridPurchaseSideEffects(p) {
  const { cashbackAig, cashbackUsdt } = computeHybridCashbackAmounts(p.usd, p.aig);
  if (cashbackAig > 0 || cashbackUsdt > 0) {
    useHybridRetentionStore.getState().accrueCashback({
      aig: cashbackAig,
      usdt: cashbackUsdt,
      purchaseId: p.purchaseId,
    });
  }

  const usd = Math.max(0, Number(p.usd) || 0);
  if (usd > 0 && p.merchantId) {
    useMerchantDebtStore.getState().addDebtFromFiatLeg({
      merchantId: p.merchantId,
      merchantName: p.merchantName,
      purchaseId: p.purchaseId,
      principalUsdt: usd,
    });
  }
}

/**
 * Run debt penalty tick + retention maturation (call on an interval or after purchase).
 * @param {number} [now]
 */
export function tickHybridFintechState(now = Date.now()) {
  useMerchantDebtStore.getState().tickPenalties(now);
  useHybridRetentionStore.getState().flushMaturedToClaimable(now);
}

/**
 * Claim hybrid rewards into demo wallet balances (local marketplace user store).
 * @returns {{ aig: number, usdt: number }}
 */
export function claimHybridRewardsToDemoWallet() {
  const { aig, usdt } = useHybridRetentionStore.getState().claimAllToWallet();
  if (aig > 0 || usdt > 0) {
    useLocalMarketplaceUserStore.setState((s) => ({
      balanceAIG: s.balanceAIG + aig,
      balanceUSD: s.balanceUSD + usdt,
    }));
  }
  return { aig, usdt };
}
