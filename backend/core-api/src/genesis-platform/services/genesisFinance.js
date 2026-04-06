import { commitUnifiedBalances, commitWalletMutation, formatUnifiedWalletSnapshot } from './genesisUnifiedWallet.js';
import { recordLegacyWalletClaim } from './genesisObservability.js';

function round8(n) {
  return Math.round(Number(n) * 1e8) / 1e8;
}

function isEthAddress(s) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(s || '').trim());
}

export function computeUsdtByCategory(entries) {
  const by = {};
  for (const e of entries) {
    if ((e.currency || 'USDT') !== 'USDT') continue;
    const a = Number(e.amount);
    if (!Number.isFinite(a)) continue;
    const sign = e.direction === 'DEBIT' ? -1 : 1;
    const c = e.category || 'misc';
    by[c] = round8((by[c] || 0) + sign * a);
  }
  return by;
}

export function formatLedgerEntry(e) {
  return {
    id: e.id,
    ts: e.ts,
    userId: e.userId,
    direction: e.direction || 'CREDIT',
    category: e.category || e.type || 'misc',
    amount: round8(Number(e.amount) || 0),
    currency: e.currency || 'USDT',
    referenceType: e.referenceType || 'genesis',
    referenceId: e.referenceId || e.id,
    metadata: e.metadata && typeof e.metadata === 'object' ? e.metadata : {},
  };
}

export async function buildWalletView(store, address) {
  const u = await store.ensureUser(address);
  const all = await store.listLedger(address, 500);
  const byCategory = computeUsdtByCategory(all);
  return {
    unified: formatUnifiedWalletSnapshot(u),
    rewardsPendingUsd: round8(u.rewardsPendingUsd ?? 0),
    rewardsClaimedUsd: round8(u.rewardsClaimedUsd ?? 0),
    directClaimableUsdt: round8(u.rewardsPending.direct),
    binaryClaimableUsdt: round8(u.rewardsPending.binary),
    miningClaimableUsdt: round8(u.rewardsPending.mining),
    balanceUsd: round8(u.balances.usd),
    ledgerNetUsdt: round8(u.balances.usd),
    balanceAig: round8(u.balances.aig),
    frozenUsd: round8(u.frozen.usd),
    frozenAig: round8(u.frozen.aig),
    depositBalanceWei: '0',
    sourceOfTruth: 'genesis_platform',
    byCategory,
    role: u.role,
    permissions: u.permissions,
    miningActive: Boolean(u.miningActive),
  };
}

export async function listEarningsApi(store, address, limit) {
  const rows = await store.listLedger(address, Math.min(500, Math.max(1, limit) * 3));
  const formatted = rows
    .map(formatLedgerEntry)
    .filter((e) => e.amount > 1e-12 || ['p2p_trade', 'transfer_in', 'transfer_out', 'withdrawal'].includes(e.category));
  return formatted.slice(0, limit);
}

/**
 * @param {import('../store/MemoryGenesisStore.js').MemoryGenesisStore} store
 */
export async function transferInternal(store, from, to, currency, amount) {
  const a = round8(amount);
  if (!isEthAddress(to)) throw Object.assign(new Error('Destino inválido'), { code: 'bad_address' });
  if (!Number.isFinite(a) || a <= 0) throw Object.assign(new Error('Monto inválido'), { code: 'bad_amount' });
  const f = String(from).toLowerCase();
  const t = String(to).toLowerCase();
  if (f === t) throw Object.assign(new Error('Mismo usuario'), { code: 'self_transfer' });

  return store.runMongoTransaction(async (session) => {
    const uf = await store.ensureUser(f, session);
    const ut = await store.ensureUser(t, session);
    const cur = String(currency || '').toLowerCase();
    if (cur === 'usd' || cur === 'usdt') {
      const avail = round8(uf.balances.usd - uf.frozen.usd);
      if (avail < a) throw Object.assign(new Error('USD insuficiente'), { code: 'insufficient_usd' });
      uf.balances.usd = round8(uf.balances.usd - a);
      ut.balances.usd = round8(ut.balances.usd + a);
      const ref = `xfer:usd:${Date.now()}`;
      const opts = { session };
      await commitUnifiedBalances(store, f, { ...uf.balances }, {
        direction: 'DEBIT',
        category: 'transfer_out',
        amount: a,
        currency: 'USDT',
        referenceType: 'wallet',
        referenceId: ref,
        metadata: { to: t },
      }, opts);
      await commitUnifiedBalances(store, t, { ...ut.balances }, {
        direction: 'CREDIT',
        category: 'transfer_in',
        amount: a,
        currency: 'USDT',
        referenceType: 'wallet',
        referenceId: ref,
        metadata: { from: f },
      }, opts);
      return { ok: true, currency: 'USDT', amount: a };
    }
    if (cur === 'aig') {
      const avail = round8(uf.balances.aig - uf.frozen.aig);
      if (avail < a) throw Object.assign(new Error('AIG insuficiente'), { code: 'insufficient_aig' });
      uf.balances.aig = round8(uf.balances.aig - a);
      ut.balances.aig = round8(ut.balances.aig + a);
      const ref = `xfer:aig:${Date.now()}`;
      const opts = { session };
      await commitUnifiedBalances(store, f, { ...uf.balances }, {
        direction: 'DEBIT',
        category: 'transfer_out',
        amount: a,
        currency: 'AIG',
        referenceType: 'wallet',
        referenceId: ref,
        metadata: { to: t },
      }, opts);
      await commitUnifiedBalances(store, t, { ...ut.balances }, {
        direction: 'CREDIT',
        category: 'transfer_in',
        amount: a,
        currency: 'AIG',
        referenceType: 'wallet',
        referenceId: ref,
        metadata: { from: f },
      }, opts);
      return { ok: true, currency: 'AIG', amount: a };
    }
    throw Object.assign(new Error('Moneda no soportada'), { code: 'bad_currency' });
  });
}

export async function withdrawRequest(store, userId, currency, amount, destination) {
  const a = round8(amount);
  if (!isEthAddress(destination)) throw Object.assign(new Error('Destino inválido'), { code: 'bad_address' });
  if (!Number.isFinite(a) || a <= 0) throw Object.assign(new Error('Monto inválido'), { code: 'bad_amount' });
  const min = Math.max(0, Number(process.env.GENESIS_MIN_WITHDRAW_USD || 5));
  const uid = String(userId).toLowerCase();

  return store.runMongoTransaction(async (session) => {
    const u = await store.ensureUser(uid, session);
    const cur = String(currency || '').toLowerCase();
    const opts = { session };
    if (cur === 'usd' || cur === 'usdt') {
      if (a < min) throw Object.assign(new Error(`Mínimo retiro ${min} USD`), { code: 'below_min' });
      const avail = round8(u.balances.usd - u.frozen.usd);
      if (avail < a) throw Object.assign(new Error('USD insuficiente'), { code: 'insufficient_usd' });
      u.balances.usd = round8(u.balances.usd - a);
      const wid = `WDR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await commitUnifiedBalances(store, uid, { ...u.balances }, {
        direction: 'DEBIT',
        category: 'withdrawal',
        amount: a,
        currency: 'USDT',
        referenceType: 'wallet',
        referenceId: wid,
        metadata: { destination: String(destination).toLowerCase(), status: 'queued_offchain' },
      }, opts);
      return { ok: true, withdrawalId: wid, amount: a, currency: 'USDT' };
    }
    if (cur === 'aig') {
      const avail = round8(u.balances.aig - u.frozen.aig);
      if (avail < a) throw Object.assign(new Error('AIG insuficiente'), { code: 'insufficient_aig' });
      u.balances.aig = round8(u.balances.aig - a);
      const wid = `WDR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await commitUnifiedBalances(store, uid, { ...u.balances }, {
        direction: 'DEBIT',
        category: 'withdrawal',
        amount: a,
        currency: 'AIG',
        referenceType: 'wallet',
        referenceId: wid,
        metadata: { destination: String(destination).toLowerCase(), status: 'queued_offchain' },
      }, opts);
      return { ok: true, withdrawalId: wid, amount: a, currency: 'AIG' };
    }
    throw Object.assign(new Error('Moneda no soportada'), { code: 'bad_currency' });
  });
}

export async function accrueRewards(store, targetUserId, { direct = 0, binary = 0, mining = 0 }) {
  if (!isEthAddress(targetUserId)) throw Object.assign(new Error('Usuario inválido'), { code: 'bad_address' });
  const d = round8(direct);
  const b = round8(binary);
  const m = round8(mining);
  const u = await store.ensureUser(targetUserId);
  let addUsdAgg = 0;
  const ledgerBatch = [];
  const ts = Date.now();
  if (d > 0) {
    u.rewardsPending.direct = round8(u.rewardsPending.direct + d);
    addUsdAgg = round8(addUsdAgg + d);
    ledgerBatch.push({
      direction: 'CREDIT',
      category: 'direct_referral',
      amount: d,
      currency: 'USDT',
      referenceType: 'reward',
      referenceId: `accrue:direct:${ts}`,
    });
  }
  if (b > 0) {
    u.rewardsPending.binary = round8(u.rewardsPending.binary + b);
    addUsdAgg = round8(addUsdAgg + b);
    ledgerBatch.push({
      direction: 'CREDIT',
      category: 'binary_accrual',
      amount: b,
      currency: 'USDT',
      referenceType: 'reward',
      referenceId: `accrue:binary:${ts}`,
    });
  }
  if (m > 0) {
    u.rewardsPending.mining = round8(u.rewardsPending.mining + m);
    ledgerBatch.push({
      direction: 'CREDIT',
      category: 'mining_accrual',
      amount: m,
      currency: 'USDT',
      referenceType: 'reward',
      referenceId: `accrue:mining:${ts}`,
    });
  }
  const nextUsd = round8((u.rewardsPendingUsd || 0) + addUsdAgg);
  await commitWalletMutation(
    store,
    targetUserId,
    {
      rewardsPending: { ...u.rewardsPending },
      ...(addUsdAgg > 0 ? { rewardsPendingUsd: nextUsd } : {}),
    },
    ledgerBatch,
  );
  const u2 = await store.getUser(targetUserId);
  return { ok: true, rewardsPending: { ...u2.rewardsPending }, rewardsPendingUsd: round8(u2.rewardsPendingUsd ?? 0) };
}

export async function claimDirect(store, userId) {
  const u = await store.ensureUser(userId);
  const amt = round8(u.rewardsPending.direct);
  if (amt <= 0) return { ok: false, amount: 0, error: 'nothing_to_claim' };
  u.rewardsPending.direct = 0;
  u.rewardsPendingUsd = round8(Math.max(0, (u.rewardsPendingUsd || 0) - amt));
  u.balances.usd = round8(u.balances.usd + amt);
  await commitWalletMutation(
    store,
    userId,
    {
      rewardsPending: { ...u.rewardsPending },
      rewardsPendingUsd: u.rewardsPendingUsd,
      balances: { ...u.balances },
    },
    {
      direction: 'CREDIT',
      category: 'claim_direct_settled',
      amount: amt,
      currency: 'USDT',
      referenceType: 'claim',
      referenceId: `claim:direct:${Date.now()}`,
      metadata: { toWallet: true },
    },
  );
  recordLegacyWalletClaim({ kind: 'direct', userId, amount: amt });
  return { ok: true, amount: amt };
}

export async function claimBinary(store, userId) {
  const u = await store.ensureUser(userId);
  const amt = round8(u.rewardsPending.binary);
  if (amt <= 0) return { ok: false, amount: 0, error: 'nothing_to_claim' };
  u.rewardsPending.binary = 0;
  u.rewardsPendingUsd = round8(Math.max(0, (u.rewardsPendingUsd || 0) - amt));
  u.balances.usd = round8(u.balances.usd + amt);
  await commitWalletMutation(
    store,
    userId,
    {
      rewardsPending: { ...u.rewardsPending },
      rewardsPendingUsd: u.rewardsPendingUsd,
      balances: { ...u.balances },
    },
    {
      direction: 'CREDIT',
      category: 'claim_binary_settled',
      amount: amt,
      currency: 'USDT',
      referenceType: 'claim',
      referenceId: `claim:binary:${Date.now()}`,
      metadata: { toWallet: true },
    },
  );
  recordLegacyWalletClaim({ kind: 'binary', userId, amount: amt });
  return { ok: true, amount: amt };
}

export async function claimMining(store, userId) {
  const min = Math.max(0, Number(process.env.GENESIS_MINING_CLAIM_MIN_USD || 10));
  const u = await store.ensureUser(userId);
  const amt = round8(u.rewardsPending.mining);
  if (amt < min) return { ok: false, amount: amt, error: 'below_min_withdraw' };
  u.rewardsPending.mining = 0;
  u.balances.usd = round8(u.balances.usd + amt);
  await commitWalletMutation(
    store,
    userId,
    { rewardsPending: { ...u.rewardsPending }, balances: { ...u.balances } },
    {
      direction: 'CREDIT',
      category: 'claim_mining_settled',
      amount: amt,
      currency: 'USDT',
      referenceType: 'claim',
      referenceId: `claim:mining:${Date.now()}`,
      metadata: { toWallet: true },
    },
  );
  recordLegacyWalletClaim({ kind: 'mining', userId, amount: amt });
  return { ok: true, amount: amt };
}
