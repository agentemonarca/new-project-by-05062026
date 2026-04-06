/**
 * Wallet unificado Genesis — única superficie de verdad: genesis_users.balances.{usd,aig}.
 * P2P settlement, reward/mining claims, transferencias y retiros deben consolidar aquí + ledger.
 *
 * Mining/rewards **accrual** (solo pending) no altera balances: va a rewardsPending.* + ledger acrual.
 */

import { emitBalanceUpdate, emitTxUpdate } from '../../socket/socketHub.js';

export const UNIFIED_WALLET = {
  sourceOfTruth: 'genesis_users.balances',
  currencies: ['usd', 'aig'],
};

function round8(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 1e8) / 1e8;
}

/**
 * Vista explícita para API: spendable + congelado + colas off-balance (hasta claim).
 * @param {object} u usuario API (ensureUser / userToApi)
 */
export function formatUnifiedWalletSnapshot(u) {
  if (!u) return null;
  return {
    sourceOfTruth: UNIFIED_WALLET.sourceOfTruth,
    balances: {
      usd: round8(u.balances?.usd ?? 0),
      aig: round8(u.balances?.aig ?? 0),
    },
    frozen: {
      usd: round8(u.frozen?.usd ?? 0),
      aig: round8(u.frozen?.aig ?? 0),
    },
    pending: {
      rewardsPendingUsd: round8(u.rewardsPendingUsd ?? 0),
      directUsd: round8(u.rewardsPending?.direct ?? 0),
      binaryUsd: round8(u.rewardsPending?.binary ?? 0),
      miningUsd: round8(u.rewardsPending?.mining ?? 0),
    },
    integration: {
      p2p: 'settlement muta balances usuarios (USD/AIG) + p2p_trade en ledger',
      rewards: 'bonus pending no toca balances; claim unificado/legacy acredita balances.usd',
      mining: 'accrual → rewardsPending.mining; claim_mining_settled → balances.usd',
    },
  };
}

/**
 * @typedef {{ session?: import('mongoose').ClientSession | null, emitRealtime?: boolean }} CommitWalletOptions
 */

/**
 * Persiste parche de usuario (balances y/u otros campos) y luego entradas de ledger en orden.
 * @param {import('../store/MemoryGenesisStore.js').MemoryGenesisStore | import('../store/MongoGenesisStore.js').MongoGenesisStore} store
 * @param {string} userId
 * @param {Record<string, unknown>} patch — típicamente { balances } o balances + rewardsPending
 * @param {object | object[] | null} [ledgerEntries]
 * @param {CommitWalletOptions | null} [options]
 */
export async function commitWalletMutation(store, userId, patch, ledgerEntries = null, options = null) {
  const key = String(userId).toLowerCase();
  const session = options?.session ?? null;
  const emitRealtime = options?.emitRealtime !== false;
  if (patch?.balances && typeof patch.balances === 'object') {
    patch = {
      ...patch,
      balances: {
        usd: round8(patch.balances.usd),
        aig: round8(patch.balances.aig),
      },
    };
  }
  await store.updateUser(key, patch, session);
  const list = Array.isArray(ledgerEntries) ? ledgerEntries : ledgerEntries ? [ledgerEntries] : [];
  for (const row of list) {
    if (row) await store.appendLedger(key, row, session);
  }

  if (emitRealtime && patch?.balances && typeof patch.balances === 'object') {
    try {
      emitBalanceUpdate({
        address: key,
        userId: key,
        balanceUsd: round8(patch.balances.usd),
        balanceAig: round8(patch.balances.aig),
        channel: 'genesis_wallet',
      });
      for (const row of list) {
        if (row && typeof row === 'object') {
          emitTxUpdate({
            address: key,
            userId: key,
            direction: row.direction,
            category: row.category,
            amount: row.amount,
            currency: row.currency,
            referenceId: row.referenceId,
          });
        }
      }
    } catch {
      /* socket opcional */
    }
  }
}

/**
 * Solo balances finales + ledger (P2P, transfer, withdraw, admin credit).
 * @param {import('../store/MemoryGenesisStore.js').MemoryGenesisStore | import('../store/MongoGenesisStore.js').MongoGenesisStore} store
 * @param {string} userId
 * @param {{ usd: number, aig: number }} balances
 * @param {object | object[] | null} ledgerEntries
 * @param {CommitWalletOptions | null} [options]
 */
export async function commitUnifiedBalances(store, userId, balances, ledgerEntries, options = null) {
  return commitWalletMutation(
    store,
    userId,
    { balances: { usd: balances.usd, aig: balances.aig } },
    ledgerEntries,
    options,
  );
}
