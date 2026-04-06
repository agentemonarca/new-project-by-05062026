/**
 * Rewards USD: BONUS → PENDING → CLAIM → WALLET (balances.usd).
 * El claim unificado muta balances vía pipeline atómica en el store + línea ledger (misma fuente que P2P/mining).
 * @see genesisUnifiedWallet.js — todas las acreditaciones spendeables consolidan genesis_users.balances
 */

import { emitGenesisPlatformEvent } from './genesisPlatformEvents.js';

function round8(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 1e8) / 1e8;
}

function isEthAddress(s) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(s || '').trim());
}

function assertPositiveAmount(amount) {
  const a = round8(amount);
  if (!Number.isFinite(a) || a <= 0) {
    const err = new Error('INVALID_REWARD_AMOUNT');
    err.code = 'invalid_reward_amount';
    throw err;
  }
  return a;
}

/**
 * @param {unknown} raw
 * @returns {string | null | false} null = omitir; false = inválida
 */
export function normalizeClientIdempotencyKey(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  if (s.length < 8 || s.length > 128) return false;
  if (!/^[\w.-]+$/.test(s)) return false;
  return s;
}

function idempotencyStoresAvailable(store) {
  return (
    typeof store?.getRewardClaimIdempotency === 'function' &&
    typeof store?.setRewardClaimIdempotency === 'function'
  );
}

/**
 * @param {import('../store/MemoryGenesisStore.js').MemoryGenesisStore | import('../store/MongoGenesisStore.js').MongoGenesisStore} store
 * @param {string} userId
 * @param {number} amount
 * @param {{ idempotencyKey?: string }} [opts]
 */
export async function generateDirectBonus(store, userId, amount, opts = {}) {
  try {
    const key = String(userId).toLowerCase();
    if (!isEthAddress(key)) throw Object.assign(new Error('bad_address'), { code: 'bad_address' });
    const a = assertPositiveAmount(amount);
    const idem = normalizeClientIdempotencyKey(opts.idempotencyKey);
    if (opts.idempotencyKey != null && String(opts.idempotencyKey).trim() !== '' && idem === false) {
      return { ok: false, error: 'invalid_idempotency_key', code: 'invalid_idempotency_key' };
    }
    await store.ensureUser(key);
    const out = await store.grantRewardsBonus(key, 'direct', a, idem || null);
    if (out.idempotentReplay !== true) {
      await store.appendLedger(key, {
        direction: 'CREDIT',
        category: 'reward_bonus_direct_pending',
        amount: a,
        currency: 'USDT',
        referenceType: 'rewards',
        referenceId: out.transactionId,
        metadata: { flow: 'pending', type: 'direct', idempotencyKey: idem || null },
      });
      emitGenesisPlatformEvent('reward_created', {
        userId: key,
        rewardType: 'direct',
        amount: a,
        transactionId: out.transactionId,
        idempotencyKey: idem || null,
      });
    }
    const u = await store.getUser(key);
    return {
      ok: true,
      transactionId: out.transactionId,
      rewardsPendingUsd: round8(u?.rewardsPendingUsd ?? 0),
      ...(out.idempotentReplay ? { idempotentReplay: true } : {}),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, code: e?.code || 'generate_failed' };
  }
}

/**
 * @param {import('../store/MemoryGenesisStore.js').MemoryGenesisStore | import('../store/MongoGenesisStore.js').MongoGenesisStore} store
 * @param {string} userId
 * @param {number} amount
 * @param {{ idempotencyKey?: string }} [opts]
 */
export async function generateBinaryBonus(store, userId, amount, opts = {}) {
  try {
    const key = String(userId).toLowerCase();
    if (!isEthAddress(key)) throw Object.assign(new Error('bad_address'), { code: 'bad_address' });
    const a = assertPositiveAmount(amount);
    const idem = normalizeClientIdempotencyKey(opts.idempotencyKey);
    if (opts.idempotencyKey != null && String(opts.idempotencyKey).trim() !== '' && idem === false) {
      return { ok: false, error: 'invalid_idempotency_key', code: 'invalid_idempotency_key' };
    }
    await store.ensureUser(key);
    const out = await store.grantRewardsBonus(key, 'binary', a, idem || null);
    if (out.idempotentReplay !== true) {
      await store.appendLedger(key, {
        direction: 'CREDIT',
        category: 'reward_bonus_binary_pending',
        amount: a,
        currency: 'USDT',
        referenceType: 'rewards',
        referenceId: out.transactionId,
        metadata: { flow: 'pending', type: 'binary', idempotencyKey: idem || null },
      });
      emitGenesisPlatformEvent('reward_created', {
        userId: key,
        rewardType: 'binary',
        amount: a,
        transactionId: out.transactionId,
        idempotencyKey: idem || null,
      });
    }
    const u = await store.getUser(key);
    return {
      ok: true,
      transactionId: out.transactionId,
      rewardsPendingUsd: round8(u?.rewardsPendingUsd ?? 0),
      ...(out.idempotentReplay ? { idempotentReplay: true } : {}),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, code: e?.code || 'generate_failed' };
  }
}

/**
 * @param {import('../store/MemoryGenesisStore.js').MemoryGenesisStore | import('../store/MongoGenesisStore.js').MongoGenesisStore} store
 * @param {string} userId
 * @param {{ idempotencyKey?: string }} [opts]
 */
export async function claimRewardsToWallet(store, userId, opts = {}) {
  try {
    const key = String(userId).toLowerCase();
    if (!isEthAddress(key)) throw Object.assign(new Error('bad_address'), { code: 'bad_address' });
    const rawKey = opts.idempotencyKey;
    const idem = normalizeClientIdempotencyKey(rawKey);
    if (rawKey != null && String(rawKey).trim() !== '' && idem === false) {
      return { ok: false, error: 'invalid_idempotency_key', code: 'invalid_idempotency_key' };
    }

    if (idem && idempotencyStoresAvailable(store)) {
      const prev = await store.getRewardClaimIdempotency(key, idem);
      if (prev && prev.ok === true) {
        return { ...prev, idempotentReplay: true };
      }
    }

    const txBody = await store.runMongoTransaction(async (session) => {
      const r = await store.claimRewardsPendingUsd(key, session);
      if (!r.ok) return { __claim: r };
      const claimed = round8(r.amount);
      await store.appendLedger(key, {
        direction: 'CREDIT',
        category: 'reward_claim_usd_settled',
        amount: claimed,
        currency: 'USDT',
        referenceType: 'rewards',
        referenceId: `claim:usd:${Date.now()}`,
        metadata: { toWallet: true, rewardsFlow: 'pending_to_balance', idempotencyKey: idem || null },
      }, session);
      const u = await store.getUser(key, session);
      return {
        ok: true,
        amount: claimed,
        balances: u?.balances,
        rewardsPendingUsd: round8(u?.rewardsPendingUsd ?? 0),
        rewardsClaimedUsd: round8(u?.rewardsClaimedUsd ?? 0),
      };
    });

    if (txBody.__claim) return txBody.__claim;
    const body = txBody;

    if (idem && idempotencyStoresAvailable(store)) {
      const setR = await store.setRewardClaimIdempotency(key, idem, body);
      if (!setR.stored && setR.existingResponse && setR.existingResponse.ok === true) {
        return { ...setR.existingResponse, idempotentReplay: true };
      }
    }

    emitGenesisPlatformEvent('reward_claimed', {
      userId: key,
      amount: body.amount,
      idempotencyKey: idem || null,
      rewardsPendingUsd: body.rewardsPendingUsd,
      rewardsClaimedUsd: body.rewardsClaimedUsd,
    });

    return body;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, code: e?.code || 'claim_failed' };
  }
}

/**
 * @param {import('../store/MemoryGenesisStore.js').MemoryGenesisStore | import('../store/MongoGenesisStore.js').MongoGenesisStore} store
 * @param {string} userId
 */
export async function getRewardsApiView(store, userId) {
  const u = await store.ensureUser(String(userId).toLowerCase());
  return {
    rewardsPendingUsd: round8(u.rewardsPendingUsd ?? 0),
    rewardsClaimedUsd: round8(u.rewardsClaimedUsd ?? 0),
    breakdown: {
      direct: round8(u.rewardsPending?.direct ?? 0),
      binary: round8(u.rewardsPending?.binary ?? 0),
      mining: round8(u.rewardsPending?.mining ?? 0),
    },
    balanceUsd: round8(u.balances?.usd ?? 0),
    sourceOfTruth: 'genesis_rewards',
  };
}

/**
 * @param {import('../store/MemoryGenesisStore.js').MemoryGenesisStore | import('../store/MongoGenesisStore.js').MongoGenesisStore} store
 * @param {string} userId
 * @param {number} limit
 */
export async function listRewardsHistoryApi(store, userId, limit = 100) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 100));
  const rows = await store.listRewardsTransactions(String(userId).toLowerCase(), lim);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    amount: round8(r.amount),
    status: r.status,
    createdAt: r.createdAt,
    claimedAt: r.claimedAt ?? null,
    idempotencyKey: r.idempotencyKey ?? null,
  }));
}
