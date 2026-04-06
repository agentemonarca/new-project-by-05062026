/**
 * @typedef {import('./operativeLedgerModel.js').OperativeTransaction} OperativeTransaction
 */

import { aigToUsd } from '../../utils/pricing.js';

/**
 * @param {import('./ledgerModel.js').LedgerEvent} ev
 * @returns {OperativeTransaction}
 */
export function mapLedgerEventToOperative(ev) {
  const meta = ev.meta && typeof ev.meta === 'object' ? ev.meta : {};

  const amount_usdt = Number(ev.amountUsdt ?? meta.amountUsdt ?? 0) || 0;
  const amount_aig = Number(ev.amountAig ?? meta.amountAig ?? 0) || 0;

  const related_user = {
    username: meta.username != null ? String(meta.username) : meta.relatedUserName != null ? String(meta.relatedUserName) : null,
    wallet: meta.wallet != null ? String(meta.wallet) : meta.relatedWallet != null ? String(meta.relatedWallet) : null,
    level: normalizeLevel(meta.teamLevel ?? meta.relationLevel),
  };

  const team =
    meta.teamUsername != null || meta.teamLevel != null || meta.volumeGenerated != null
      ? {
          username: meta.teamUsername != null ? String(meta.teamUsername) : related_user.username,
          level: meta.teamLevel === 'indirect' || meta.teamLevel === 'direct' ? meta.teamLevel : related_user.level === 'indirect' || related_user.level === 'direct' ? related_user.level : null,
          volumeGenerated: meta.volumeGenerated != null ? Number(meta.volumeGenerated) : undefined,
          commissionEarned:
            meta.commissionEarned != null ? Number(meta.commissionEarned) : amount_usdt || aigToUsd(amount_aig),
        }
      : null;

  /** @type {import('./operativeLedgerModel.js').OperativeIncomeSource} */
  let source = 'system';
  /** @type {import('./operativeLedgerModel.js').OperativeMiningTrack} */
  let mining_track = null;
  let type = String(ev.kind || 'event');

  if (ev.category === 'mining') {
    source = 'mining';
    mining_track = meta.miningTrack === 'booster' ? 'booster' : 'core';
  } else if (ev.category === 'booster') {
    source = 'mining';
    mining_track = 'booster';
    type = meta.boosterKind != null ? String(meta.boosterKind) : `booster_${ev.kind}`;
  } else if (ev.category === 'staking') {
    source = 'staking';
  } else if (ev.category === 'marketplace') {
    source = 'marketplace';
    if (
      ev.kind === 'order' ||
      ev.kind === 'purchase' ||
      ev.kind === 'quote' ||
      ev.kind === 'marketplace_purchase'
    ) {
      type = 'purchase';
    } else if (ev.kind === 'referral_bonus') {
      type = 'referral_bonus';
    } else if (ev.kind === 'platform_fee') {
      type = 'platform_fee';
    }
  } else if (ev.category === 'network') {
    const be = meta.binaryEvent;
    if (
      meta.bonusSource === 'direct' ||
      ev.kind === 'direct_bonus' ||
      ev.kind === 'direct_bonus_marketplace' ||
      ev.title.toLowerCase().includes('direct bonus')
    ) {
      source = 'direct';
    } else if (
      be === 'BINARY_MATCH' ||
      ev.kind === 'binary_match' ||
      meta.bonusSource === 'binary' ||
      (typeof ev.kind === 'string' && ev.kind.includes('binary'))
    ) {
      source = 'binary';
    } else {
      source = 'binary';
    }
    if (be === 'BINARY_FLASH') type = 'binary_flash';
    else if (be === 'BINARY_CONSUMPTION') type = 'binary_consumption';
    else if (ev.kind === 'binary_match') type = 'binary_match';
    else if (ev.kind === 'direct_bonus_marketplace') type = 'direct_bonus_marketplace';
  } else if (ev.category === 'transaction') {
    source = 'system';
    if (ev.kind === 'withdrawal') type = 'withdrawal';
    if (ev.kind === 'conversion' || meta.conversion === true) type = 'conversion';
    if (ev.kind === 'deposit') type = 'deposit';
  } else {
    source = 'system';
  }

  const conversion_price = meta.conversionPrice != null ? Number(meta.conversionPrice) : meta.priceUsdtPerAig != null ? Number(meta.priceUsdtPerAig) : null;
  const conversion_usdt_in = meta.conversionUsdtIn != null ? Number(meta.conversionUsdtIn) : type === 'conversion' ? amount_usdt : null;
  const conversion_aig_out = meta.conversionAigOut != null ? Number(meta.conversionAigOut) : type === 'conversion' ? amount_aig : null;

  const volume_generated = meta.volumeGenerated != null ? Number(meta.volumeGenerated) : meta.matchedVolume != null ? Number(meta.matchedVolume) : meta.left != null && meta.right != null ? Number(meta.left) + Number(meta.right) : 0;

  const commission_earned =
    meta.commissionEarned != null
      ? Number(meta.commissionEarned)
      : source === 'binary' || source === 'direct'
        ? amount_usdt || aigToUsd(amount_aig)
        : amount_usdt;

  const product = String(meta.product ?? meta.productName ?? ev.title ?? '—');
  const product_active = meta.productActive !== false && meta.activeProduct !== false;

  const status = resolveStatus(ev);

  const daily_accrual_usdt = meta.dailyAccrualUsdt != null ? Number(meta.dailyAccrualUsdt) : mining_track === 'core' && ev.kind === 'generation' ? amount_usdt : null;
  const booster_pct_dynamic = meta.boosterDynamicPct != null ? Number(meta.boosterDynamicPct) : mining_track === 'booster' ? Number(meta.dynamicPct ?? 12.5) : null;

  const importance =
    amount_usdt >= 100 || amount_aig >= 1000 || meta.highValue === true ? 'high' : 'normal';

  return {
    id: ev.id,
    type,
    source,
    related_user,
    product,
    amount_usdt,
    amount_aig,
    conversion_price,
    status,
    hash: ev.txHash ?? null,
    timestamp: ev.ts,
    title: ev.title,
    summary: ev.summary,
    mining_track,
    volume_generated,
    commission_earned,
    product_active,
    daily_accrual_usdt,
    booster_pct_dynamic,
    conversion_usdt_in,
    conversion_aig_out,
    team,
    importance,
    raw: ev,
  };
}

/**
 * @param {unknown} v
 * @returns {'direct' | 'indirect' | 'self' | null}
 */
function normalizeLevel(v) {
  if (v == null) return null;
  const s = String(v).toLowerCase();
  if (s === 'direct') return 'direct';
  if (s === 'indirect') return 'indirect';
  if (s === 'self') return 'self';
  return null;
}

/**
 * @param {import('./ledgerModel.js').LedgerEvent} ev
 * @returns {'pending' | 'confirmed' | 'failed'}
 */
function resolveStatus(ev) {
  if (ev.txStatus === 'pending') return 'pending';
  if (ev.txStatus === 'confirmed') return 'confirmed';
  if (ev.txHash && /^0x[a-fA-F0-9]{64}$/.test(ev.txHash)) return 'confirmed';
  return 'confirmed';
}

/**
 * @param {import('./ledgerModel.js').LedgerEvent[]} events
 * @returns {OperativeTransaction[]}
 */
export function mapLedgerEventsToOperative(events) {
  return events.map(mapLedgerEventToOperative);
}
