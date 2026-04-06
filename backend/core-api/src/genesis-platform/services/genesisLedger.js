/**
 * Ledger unificado + reconciliación balances vs p2p_transactions (única fuente ledger operativa).
 */

function round8(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 1e8) / 1e8;
}

/** Créditos ledger que no aumentan balances.usd hasta claim / liquidación explícita. */
export const USD_PENDING_ACCRUAL_CATEGORIES = new Set([
  'reward_bonus_direct_pending',
  'reward_bonus_binary_pending',
  'direct_referral',
  'binary_accrual',
  'mining_accrual',
]);

/**
 * @param {import('../store/MemoryGenesisStore.js').MemoryGenesisStore | import('../store/MongoGenesisStore.js').MongoGenesisStore} store
 * @param {string} userId
 * @param {number} limit
 */
export async function listUnifiedLedgerEvents(store, userId, limit = 100) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 100));
  const fetchN = Math.min(1000, lim * 2);
  const key = String(userId).toLowerCase();
  const p2pRows = await store.listLedger(key, fetchN);
  const rwRows = await store.listRewardsTransactions(key, fetchN);

  /** @type {Array<Record<string, unknown>>} */
  const events = [];

  for (const e of p2pRows) {
    events.push({
      source: 'p2p_transactions',
      id: e.id,
      ts: Number(e.ts) || 0,
      kind: 'ledger_entry',
      direction: e.direction || 'CREDIT',
      category: e.category,
      amount: round8(e.amount),
      currency: e.currency || 'USDT',
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      metadata: e.metadata && typeof e.metadata === 'object' ? e.metadata : {},
    });
  }

  for (const r of rwRows) {
    events.push({
      source: 'rewards_transactions',
      id: r.id,
      ts: Number(r.createdAt) || 0,
      kind: 'reward_line',
      rewardType: r.type,
      amount: round8(r.amount),
      currency: 'USDT',
      status: r.status,
      claimedAt: r.claimedAt ?? null,
      metadata: {},
    });
  }

  events.sort((a, b) => Number(b.ts) - Number(a.ts));
  return events.slice(0, lim);
}

/**
 * Compara balances.usd con red neto USDT del ledger excluyendo acumulaciones solo-pending.
 * @param {import('../store/MemoryGenesisStore.js').MemoryGenesisStore | import('../store/MongoGenesisStore.js').MongoGenesisStore} store
 * @param {string} userId
 * @param {number} [maxEntries]
 */
/**
 * Neto AIG en ledger vs balances.aig (sin categorías off-ledger: no hay pending AIG en rewards).
 * @param {import('../store/MemoryGenesisStore.js').MemoryGenesisStore | import('../store/MongoGenesisStore.js').MongoGenesisStore} store
 * @param {string} userId
 * @param {number} [maxEntries]
 */
export async function reconcileAigWalletVsLedger(store, userId, maxEntries = 5000) {
  const key = String(userId).toLowerCase();
  const u = await store.ensureUser(key);
  const rows = await store.listLedger(key, Math.min(20_000, Math.max(100, maxEntries)));

  let net = 0;
  for (const e of rows) {
    if (String(e.currency || '').toUpperCase() !== 'AIG') continue;
    const a = round8(e.amount);
    if (!Number.isFinite(a)) continue;
    net += String(e.direction).toUpperCase() === 'DEBIT' ? -a : a;
  }
  net = round8(net);
  const bal = round8(u.balances?.aig ?? 0);
  const drift = round8(bal - net);
  const epsilon = 1e-6;
  return {
    ok: Math.abs(drift) <= epsilon,
    balanceAig: bal,
    ledgerNetAig: net,
    drift,
    entriesScanned: rows.length,
  };
}

export async function reconcileUsdWalletVsLedger(store, userId, maxEntries = 5000) {
  const key = String(userId).toLowerCase();
  const u = await store.ensureUser(key);
  const rows = await store.listLedger(key, Math.min(20_000, Math.max(100, maxEntries)));

  let net = 0;
  for (const e of rows) {
    const cur = String(e.currency || 'USDT').toUpperCase();
    if (cur !== 'USDT' && cur !== 'USD') continue;
    const cat = String(e.category || '');
    if (USD_PENDING_ACCRUAL_CATEGORIES.has(cat)) continue;
    const a = round8(e.amount);
    if (!Number.isFinite(a)) continue;
    net += String(e.direction).toUpperCase() === 'DEBIT' ? -a : a;
  }

  net = round8(net);
  const bal = round8(u.balances?.usd ?? 0);
  const drift = round8(bal - net);
  const epsilon = 1e-6;
  return {
    ok: Math.abs(drift) <= epsilon,
    balanceUsd: bal,
    ledgerNetUsd: net,
    drift,
    entriesScanned: rows.length,
    excludedCategories: [...USD_PENDING_ACCRUAL_CATEGORIES],
  };
}

/**
 * Reconciliación USD + AIG para inspección operativa.
 */
export async function reconcileUnifiedWalletVsLedger(store, userId, maxEntries = 5000) {
  const [usd, aig] = await Promise.all([
    reconcileUsdWalletVsLedger(store, userId, maxEntries),
    reconcileAigWalletVsLedger(store, userId, maxEntries),
  ]);
  return {
    ok: usd.ok && aig.ok,
    usd,
    aig,
  };
}
