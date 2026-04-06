import { getAigPriceUsd, usdEquivalentFromDualLegs } from '../payment/dualTokenPayment.js';
import { aigToUsd } from '../../utils/pricing.js';

/**
 * Smart revenue distribution for local / Web3 marketplace purchases.
 * Referral legs pay out only when {@link evaluateRevenueShareEligibility} passes; forfeited legs accrue to platform.
 */

/** Default split: merchant 85%, merchant ref 5%, buyer ref 5%, platform 5% (basis points). */
export const DEFAULT_REVENUE_BPS = Object.freeze({
  merchant: 8500,
  merchantReferrer: 500,
  buyerReferrer: 500,
  platform: 500,
});

/**
 * @typedef {{
 *   isActiveUser: boolean,
 *   stakingActive: boolean,
 *   holdingRatio01: number,
 *   accountFrozen: boolean,
 * }} RevenueEligibilitySnapshot
 */

/**
 * @typedef {{
 *   grossUsd: number,
 *   grossAig: number,
 *   grossBinaryPts: number,
 *   merchantReferrerEligible: boolean,
 *   buyerReferrerEligible: boolean,
 *   bps: typeof DEFAULT_REVENUE_BPS,
 *   merchant: { usd: number, aig: number, binaryPts: number },
 *   merchantReferrer: { usd: number, aig: number, binaryPts: number },
 *   buyerReferrer: { usd: number, aig: number, binaryPts: number },
 *   platform: { usd: number, aig: number, binaryPts: number },
 *   eligibilityNotes: { merchantRef: string[], buyerRef: string[] },
 * }} MarketplaceRevenueDistribution
 */

/**
 * Demo-friendly snapshot when no CoreProvider (e.g. standalone `/marketplace/local`).
 * @returns {RevenueEligibilitySnapshot}
 */
export function defaultRevenueEligibilitySnapshot() {
  return {
    isActiveUser: true,
    stakingActive: true,
    holdingRatio01: 0.12,
    accountFrozen: false,
  };
}

/**
 * @param {Record<string, any> | null | undefined} ctx
 * @returns {RevenueEligibilitySnapshot}
 */
export function buildRevenueEligibilitySnapshotFromCore(ctx) {
  if (!ctx) return defaultRevenueEligibilitySnapshot();

  const frozen = Boolean(ctx.claimUi?.accountFrozen);
  const active = Boolean(ctx.hasSession && ctx.economicActive);
  const stakingOn = Number(ctx.stakingYield) > 0.001;
  const minH = Number(ctx.claimUi?.minHoldingUsdt ?? 0);
  const ledger = Number(ctx.claimUi?.ledgerNetUsdt ?? 0);
  let holdingRatio01 = 0;
  if (minH > 0 && Number.isFinite(ledger)) {
    holdingRatio01 = ledger / minH;
  } else {
    holdingRatio01 = Math.min(1, Number(ctx.stakingYield) || 0);
  }

  return {
    isActiveUser: active,
    stakingActive: stakingOn,
    holdingRatio01,
    accountFrozen: frozen,
  };
}

/**
 * Conditions: active user, staking on, holding >= 7% (ratio or staking proxy), not frozen.
 * @param {RevenueEligibilitySnapshot} snap
 * @returns {{ eligible: boolean, reasons: string[] }}
 */
export function evaluateRevenueShareEligibility(snap) {
  const reasons = [];
  if (snap.accountFrozen) reasons.push('account_frozen');
  if (!snap.isActiveUser) reasons.push('inactive_user');
  if (!snap.stakingActive) reasons.push('staking_inactive');
  if (snap.holdingRatio01 < 0.07) reasons.push('below_min_holding_7pct');
  return { eligible: reasons.length === 0, reasons };
}

/**
 * Optional binary volume points from notional checkout (UI / demo).
 * Uses AIG oracle USD price for the AIG leg.
 * @param {number} usd
 * @param {number} aig
 * @param {number} [aigPriceUsd]
 * @returns {number}
 */
export function defaultBinaryVolumePtsFromGross(usd, aig, aigPriceUsd = getAigPriceUsd()) {
  const notion = usdEquivalentFromDualLegs(usd, aig, aigPriceUsd);
  return Math.round(Math.max(0, notion) * 0.012);
}

/**
 * Split one numeric leg by effective basis points (integer math, remainder to merchant).
 * @param {number} gross
 * @param {number} mRefBps
 * @param {number} bRefBps
 * @param {number} platBps
 */
function splitLeg(gross, mRefBps, bRefBps, platBps) {
  if (gross <= 0) {
    return { merchant: 0, merchantReferrer: 0, buyerReferrer: 0, platform: 0 };
  }
  const totalBps = 10_000;
  const mref = Math.floor((gross * mRefBps) / totalBps);
  const bref = Math.floor((gross * bRefBps) / totalBps);
  const plat = Math.floor((gross * platBps) / totalBps);
  const merchant = Math.max(0, gross - mref - bref - plat);
  return { merchant, merchantReferrer: mref, buyerReferrer: bref, platform: plat };
}

/**
 * @param {{
 *   grossUsd: number,
 *   grossAig: number,
 *   grossBinaryPts?: number,
 *   aigPriceUsd?: number,
 *   merchantReferrerSnapshot: RevenueEligibilitySnapshot,
 *   buyerReferrerSnapshot: RevenueEligibilitySnapshot,
 *   bps?: Partial<typeof DEFAULT_REVENUE_BPS>,
 * }} input
 * @returns {MarketplaceRevenueDistribution}
 */
export function calculateMarketplaceRevenueDistribution(input) {
  const grossUsd = Math.max(0, Number(input.grossUsd) || 0);
  const grossAig = Math.max(0, Number(input.grossAig) || 0);
  const grossBinaryPts = Math.max(
    0,
    input.grossBinaryPts != null
      ? Number(input.grossBinaryPts)
      : defaultBinaryVolumePtsFromGross(grossUsd, grossAig, input.aigPriceUsd),
  );

  const base = { ...DEFAULT_REVENUE_BPS, ...input.bps };
  const merEval = evaluateRevenueShareEligibility(input.merchantReferrerSnapshot);
  const buyEval = evaluateRevenueShareEligibility(input.buyerReferrerSnapshot);

  const merchantReferrerEligible = merEval.eligible;
  const buyerReferrerEligible = buyEval.eligible;

  let mRefBps = merchantReferrerEligible ? base.merchantReferrer : 0;
  let bRefBps = buyerReferrerEligible ? base.buyerReferrer : 0;
  const forfeited = (merchantReferrerEligible ? 0 : base.merchantReferrer) + (buyerReferrerEligible ? 0 : base.buyerReferrer);
  const platBps = base.platform + forfeited;
  const merchantBps = base.merchant;

  const usdParts = splitLeg(grossUsd, mRefBps, bRefBps, platBps);
  const aigParts = splitLeg(grossAig, mRefBps, bRefBps, platBps);
  const binParts = splitLeg(grossBinaryPts, mRefBps, bRefBps, platBps);

  return {
    grossUsd,
    grossAig,
    grossBinaryPts,
    merchantReferrerEligible,
    buyerReferrerEligible,
    bps: {
      merchant: merchantBps,
      merchantReferrer: mRefBps,
      buyerReferrer: bRefBps,
      platform: platBps,
    },
    merchant: {
      usd: usdParts.merchant,
      aig: aigParts.merchant,
      binaryPts: binParts.merchant,
    },
    merchantReferrer: {
      usd: usdParts.merchantReferrer,
      aig: aigParts.merchantReferrer,
      binaryPts: binParts.merchantReferrer,
    },
    buyerReferrer: {
      usd: usdParts.buyerReferrer,
      aig: aigParts.buyerReferrer,
      binaryPts: binParts.buyerReferrer,
    },
    platform: {
      usd: usdParts.platform,
      aig: aigParts.platform,
      binaryPts: binParts.platform,
    },
    eligibilityNotes: {
      merchantRef: merEval.reasons,
      buyerRef: buyEval.reasons,
    },
  };
}

/**
 * Build raw ledger event payloads (normalized later by paymentLedgerStore).
 * @param {{
 *   ts: number,
 *   txHash: string,
 *   purchaseId: string,
 *   merchantId: string,
 *   merchantName: string,
 *   productName: string,
 *   buyerWallet: string | null,
 *   merchantReferrerWallet: string | null,
 *   buyerReferrerWallet: string | null,
 *   distribution: MarketplaceRevenueDistribution,
 * }} p
 */
export function buildMarketplaceRevenueLedgerRaws(p) {
  const {
    ts,
    txHash,
    purchaseId,
    merchantId,
    merchantName,
    productName,
    buyerWallet,
    merchantReferrerWallet,
    buyerReferrerWallet,
    distribution: d,
  } = p;

  const equivUsdt = d.grossUsd + aigToUsd(d.grossAig);

  const purchaseMeta = {
    purchaseId,
    merchantId,
    merchantName,
    productName,
    buyerWallet,
    paymentTypes: [
      d.grossUsd > 0 ? 'USDT' : null,
      d.grossAig > 0 ? 'AIG' : null,
      d.grossBinaryPts > 0 ? 'binary_points' : null,
    ].filter(Boolean),
    distribution: d,
    merchantReferrerWallet,
    buyerReferrerWallet,
    smartRevenue: true,
  };

  /** @type {Record<string, unknown>[]} */
  const rows = [];

  rows.push({
    id: `mkt-purchase-${purchaseId}`,
    ts,
    category: 'marketplace',
    kind: 'marketplace_purchase',
    title: `Marketplace purchase · ${productName}`,
    summary: `Gross USDT ${d.grossUsd.toFixed(2)} · AIG ${d.grossAig.toFixed(0)} · binary ${d.grossBinaryPts} pts · equiv ~${equivUsdt.toFixed(2)} USDT`,
    amountUsdt: equivUsdt,
    amountAig: d.grossAig,
    txHash,
    txStatus: 'confirmed',
    meta: {
      ...purchaseMeta,
      grossUsd: d.grossUsd,
      grossAig: d.grossAig,
      grossBinaryPts: d.grossBinaryPts,
      merchantShare: d.merchant,
      platformShare: d.platform,
    },
  });

  const refEquiv =
    d.merchantReferrer.usd +
    aigToUsd(d.merchantReferrer.aig) +
    d.buyerReferrer.usd +
    aigToUsd(d.buyerReferrer.aig);

  if (refEquiv > 0 || d.merchantReferrer.binaryPts + d.buyerReferrer.binaryPts > 0) {
    rows.push({
      id: `mkt-ref-bonus-${purchaseId}`,
      ts: ts + 1,
      category: 'marketplace',
      kind: 'referral_bonus',
      title: 'Referral bonus · marketplace revenue share',
      summary: `Merchant ref ${d.merchantReferrerEligible ? 'paid' : 'skipped'} · Buyer ref ${d.buyerReferrerEligible ? 'paid' : 'skipped'} — USDT ${(d.merchantReferrer.usd + d.buyerReferrer.usd).toFixed(4)} · AIG ${(d.merchantReferrer.aig + d.buyerReferrer.aig).toFixed(0)} · pts ${d.merchantReferrer.binaryPts + d.buyerReferrer.binaryPts}`,
      amountUsdt: d.merchantReferrer.usd + d.buyerReferrer.usd,
      amountAig: d.merchantReferrer.aig + d.buyerReferrer.aig,
      txHash,
      txStatus: 'confirmed',
      meta: {
        purchaseId,
        merchantReferrerWallet,
        buyerReferrerWallet,
        merchantReferrerShare: d.merchantReferrer,
        buyerReferrerShare: d.buyerReferrer,
        merchantReferrerEligible: d.merchantReferrerEligible,
        buyerReferrerEligible: d.buyerReferrerEligible,
        eligibilityNotes: d.eligibilityNotes,
        binaryPtsTotal: d.merchantReferrer.binaryPts + d.buyerReferrer.binaryPts,
      },
    });
  }

  const platEquiv = d.platform.usd + aigToUsd(d.platform.aig);
  if (platEquiv > 0 || d.platform.binaryPts > 0) {
    rows.push({
      id: `mkt-platform-${purchaseId}`,
      ts: ts + 2,
      category: 'marketplace',
      kind: 'platform_fee',
      title: 'Platform fee · marketplace pool',
      summary: `Pool USDT ${d.platform.usd.toFixed(4)} · AIG ${d.platform.aig.toFixed(0)} · binary ${d.platform.binaryPts} pts (includes forfeited referral legs)`,
      amountUsdt: d.platform.usd,
      amountAig: d.platform.aig,
      txHash,
      txStatus: 'confirmed',
      meta: {
        purchaseId,
        platformShare: d.platform,
        effectiveBps: d.bps,
        note: 'Includes base platform bps plus any referral share when referrers fail eligibility',
      },
    });
  }

  return rows;
}
