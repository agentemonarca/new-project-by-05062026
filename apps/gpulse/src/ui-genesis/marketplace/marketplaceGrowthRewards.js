/**
 * AiGenesis marketplace growth engine: binary volume + 11% direct bonus on eligible purchases.
 * Staking SKUs credit 11% volume to binary instead of 100%.
 */

import { useBinaryEngineStore } from '../binary/binaryEngineStore.js';
import { usePaymentLedgerStore } from '../stores/paymentLedgerStore.js';
import { USDT_TO_AIG_DISPLAY } from '../types/miningCore.js';
import { totalTransactionAigValue } from './hybridPaymentEngine.js';
import {
  buildRevenueEligibilitySnapshotFromCore,
  defaultRevenueEligibilitySnapshot,
  evaluateRevenueShareEligibility,
} from './revenueDistribution.js';

/** 11% direct bonus on USDT-equivalent checkout. */
export const MARKETPLACE_DIRECT_BONUS_RATE = 0.11;

/** Binary volume = 100% of equivalent for standard listings. */
export const MARKETPLACE_BINARY_VOLUME_FULL_RATE = 1;

/** Staking / staking-class SKUs: only this fraction of volume counts toward binary. */
export const MARKETPLACE_BINARY_VOLUME_STAKING_SKU_RATE = 0.11;

/**
 * @typedef {import('./revenueDistribution.js').RevenueEligibilitySnapshot & { hasActiveProduct: boolean }} MarketplaceGrowthEligibilitySnapshot
 */

/**
 * @param {number} usd
 * @param {number} aig
 */
export function marketplacePurchaseUsdtEquivalent(usd, aig) {
  const u = Math.max(0, Number(usd) || 0);
  const a = Math.max(0, Number(aig) || 0);
  return u + a * USDT_TO_AIG_DISPLAY;
}

/**
 * Active product: at least one core that still accrues (mining / booster / staking).
 * @param {Record<string, any> | null | undefined} ctx
 */
export function computeHasActiveProductFromCore(ctx) {
  if (!ctx) return true;
  const cores = ctx.cores ?? [];
  if (!cores.length) return false;
  return cores.some((c) => {
    const max = Number(c.maxGeneration) || 0;
    const gen = Number(c.totalGenerated) || 0;
    const acc = Number(c.accumulated) || 0;
    const rate = Number(c.ratePerSecond) || 0;
    const notExhausted = max <= 0 || gen + acc < max - 1e-9;
    const typed = c.type === 'mining' || c.type === 'booster' || c.type === 'staking';
    return typed && notExhausted && (rate > 0 || acc > 0 || gen > 0);
  });
}

/**
 * @param {Record<string, any> | null | undefined} ctx
 * @returns {MarketplaceGrowthEligibilitySnapshot}
 */
export function buildMarketplaceGrowthEligibilityFromCore(ctx) {
  const base = ctx ? buildRevenueEligibilitySnapshotFromCore(ctx) : defaultRevenueEligibilitySnapshot();
  const hasActiveProduct = computeHasActiveProductFromCore(ctx);
  return { ...base, hasActiveProduct };
}

/**
 * @returns {MarketplaceGrowthEligibilitySnapshot}
 */
export function defaultMarketplaceGrowthEligibilitySnapshot() {
  return { ...defaultRevenueEligibilitySnapshot(), hasActiveProduct: true };
}

/**
 * Eligibility: staking on, holding ≥7%, not frozen, active product (and session active).
 * @param {MarketplaceGrowthEligibilitySnapshot} snap
 */
export function evaluateMarketplaceGrowthEligibility(snap) {
  const base = evaluateRevenueShareEligibility(snap);
  const reasons = [...base.reasons];
  if (!snap.hasActiveProduct) reasons.push('no_active_product');
  return { eligible: reasons.length === 0, reasons };
}

/**
 * Binary leg uses **total AIG value** of the transaction (paid AIG + USDT×rate).
 * Direct bonus remains **11% of USDT-equivalent** checkout (protocol rule).
 * @param {number} equivUsdt
 * @param {number} totalAigValue
 * @param {boolean} isStakingSku
 * @param {boolean} eligible
 */
export function computeMarketplaceGrowthRewards(equivUsdt, totalAigValue, isStakingSku, eligible) {
  const eq = Math.max(0, Number(equivUsdt) || 0);
  const aigV = Math.max(0, Number(totalAigValue) || 0);
  if (!eligible) {
    return {
      binaryVolumeUsdtEquivalent: 0,
      directBonusUsdt: 0,
      binaryVolumeRateApplied: 0,
      totalAigValueBasis: aigV,
    };
  }
  const volRate = isStakingSku ? MARKETPLACE_BINARY_VOLUME_STAKING_SKU_RATE : MARKETPLACE_BINARY_VOLUME_FULL_RATE;
  return {
    binaryVolumeUsdtEquivalent: aigV * volRate,
    directBonusUsdt: eq * MARKETPLACE_DIRECT_BONUS_RATE,
    binaryVolumeRateApplied: volRate,
    totalAigValueBasis: aigV,
  };
}

/**
 * @param {{
 *   ts: number,
 *   txHash: string,
 *   purchaseId: string,
 *   productName: string,
 *   directBonusUsdt: number,
 *   eligible: boolean,
 *   reasons: string[],
 *   equivUsdt: number,
 *   binaryVolumeCredited: number,
 *   totalAigValueBasis: number,
 *   stakingRule: boolean,
 * }} p
 * @returns {Record<string, unknown> | null}
 */
export function buildMarketplaceDirectBonusLedgerRaw(p) {
  if (p.directBonusUsdt <= 0) return null;
  return {
    id: `mkt-direct-${p.purchaseId}`,
    ts: p.ts + 3,
    category: 'network',
    kind: 'direct_bonus_marketplace',
    title: 'Bono directo · marketplace (11%)',
    summary: `+${p.directBonusUsdt.toFixed(4)} USDT equiv · ${p.productName} · bin ${p.binaryVolumeCredited.toFixed(2)}`,
    amountUsdt: p.directBonusUsdt,
    txHash: p.txHash,
    txStatus: 'confirmed',
    meta: {
      bonusSource: 'direct',
      parentKind: 'marketplace_purchase',
      purchaseId: p.purchaseId,
      growthEligible: p.eligible,
      ineligibleReasons: p.reasons,
      directRate: MARKETPLACE_DIRECT_BONUS_RATE,
      checkoutEquivUsdt: p.equivUsdt,
      binaryVolumeCredited: p.binaryVolumeCredited,
      binaryBasisAigValue: p.totalAigValueBasis,
      marketplaceStakingVolumeRule: p.stakingRule,
    },
  };
}

/**
 * Protocol catalogue checkout row (near-me flow already logs purchase via smart revenue).
 * @param {{
 *   ts: number,
 *   txHash: string,
 *   purchaseId: string,
 *   productName: string,
 *   grossUsd: number,
 *   grossAig: number,
 *   equivUsdt: number,
 * }} p
 */
export function buildGrowthEngineMarketplacePurchaseLedgerRaw(p) {
  return {
    id: `mkt-growth-purchase-${p.purchaseId}`,
    ts: p.ts,
    category: 'marketplace',
    kind: 'marketplace_purchase',
    title: `Marketplace purchase · ${p.productName}`,
    summary: `Growth checkout · USDT ${p.grossUsd.toFixed(2)} · AIG ${p.grossAig.toFixed(0)} · equiv ${p.equivUsdt.toFixed(2)}`,
    amountUsdt: p.equivUsdt,
    amountAig: p.grossAig,
    txHash: p.txHash,
    txStatus: 'confirmed',
    meta: {
      purchaseId: p.purchaseId,
      growthEngine: true,
      grossUsd: p.grossUsd,
      grossAig: p.grossAig,
    },
  };
}

/**
 * Run growth payouts: binary legs + optional purchase row + direct bonus ledger (if eligible).
 * @param {{
 *   purchaseId: string,
 *   productLabel: string,
 *   grossUsd: number,
 *   grossAig: number,
 *   isStakingVolumeRule: boolean,
 *   core: Record<string, any> | null | undefined,
 *   txHash?: string,
 *   ts?: number,
 *   recordMarketplacePurchaseLedger?: boolean,
 * }} opts
 */
export function executeMarketplaceGrowthPayout(opts) {
  const ts = opts.ts ?? Date.now();
  const txHash = opts.txHash ?? `sim-mkt-${opts.purchaseId}`;
  const snap = buildMarketplaceGrowthEligibilityFromCore(opts.core);
  const { eligible, reasons } = evaluateMarketplaceGrowthEligibility(snap);
  const equiv = marketplacePurchaseUsdtEquivalent(opts.grossUsd, opts.grossAig);
  const totalAig = totalTransactionAigValue(opts.grossUsd, opts.grossAig);
  const rewards = computeMarketplaceGrowthRewards(equiv, totalAig, opts.isStakingVolumeRule, eligible);

  if (rewards.binaryVolumeUsdtEquivalent > 0) {
    useBinaryEngineStore.getState().applyPurchaseBinaryVolume(rewards.binaryVolumeUsdtEquivalent, {
      product: 'marketplace',
      source: 'marketplace',
      purchaseId: opts.purchaseId,
      marketplaceStakingRule: opts.isStakingVolumeRule,
      productLabel: opts.productLabel,
      totalAigValueBasis: totalAig,
    });
  }

  const bonusRaw = buildMarketplaceDirectBonusLedgerRaw({
    ts,
    txHash,
    purchaseId: opts.purchaseId,
    productName: opts.productLabel,
    directBonusUsdt: rewards.directBonusUsdt,
    eligible,
    reasons,
    equivUsdt: equiv,
    binaryVolumeCredited: rewards.binaryVolumeUsdtEquivalent,
    totalAigValueBasis: rewards.totalAigValueBasis ?? totalAig,
    stakingRule: opts.isStakingVolumeRule,
  });

  /** @type {Record<string, unknown>[]} */
  const batch = [];
  if (opts.recordMarketplacePurchaseLedger) {
    batch.push(
      buildGrowthEngineMarketplacePurchaseLedgerRaw({
        ts,
        txHash,
        purchaseId: opts.purchaseId,
        productName: opts.productLabel,
        grossUsd: opts.grossUsd,
        grossAig: opts.grossAig,
        equivUsdt: equiv,
      }),
    );
  }
  if (bonusRaw) batch.push(bonusRaw);
  if (batch.length) {
    usePaymentLedgerStore.getState().appendLedgerEvents(batch);
  }

  return { eligible, reasons, equivUsdt: equiv, ...rewards };
}
