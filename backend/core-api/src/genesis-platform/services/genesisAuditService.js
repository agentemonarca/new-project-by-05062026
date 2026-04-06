/**
 * Auditoría / reconciliación masiva wallet vs ledger (enterprise).
 */

import { reconcileUnifiedWalletVsLedger } from './genesisLedger.js';
import { recordLedgerDriftDetected } from './genesisObservability.js';

const EPS = 1e-6;

/**
 * @param {object} args
 * @param {import('../store/MemoryGenesisStore.js').MemoryGenesisStore | import('../store/MongoGenesisStore.js').MongoGenesisStore} args.store
 * @param {object} [args.logger]
 * @param {string} [args.userId] — si se omite, escanea listAllUserIds() hasta maxUsers
 * @param {number} [args.maxUsers]
 */
export async function runGenesisLedgerAudit({ store, logger, userId, maxUsers = 500 }) {
  if (typeof store.listAllUserIds !== 'function') {
    throw Object.assign(new Error('store does not support listAllUserIds'), { code: 'audit_unsupported' });
  }
  const cap = Math.max(1, Math.min(10_000, Number(maxUsers) || 500));
  const allIds = userId ? [String(userId).toLowerCase()] : await store.listAllUserIds();
  const slice = allIds.slice(0, cap);
  const drifts = [];

  for (const id of slice) {
    const rec = await reconcileUnifiedWalletVsLedger(store, id);
    const usdD = Math.abs(rec.usd.drift);
    const aigD = Math.abs(rec.aig.drift);
    if (!rec.ok || usdD > EPS || aigD > EPS) {
      drifts.push({ userId: id, reconciliation: rec });
      recordLedgerDriftDetected({
        userId: id,
        usdDrift: rec.usd.drift,
        aigDrift: rec.aig.drift,
        usdOk: rec.usd.ok,
        aigOk: rec.aig.ok,
      });
    }
  }

  return {
    scanned: slice.length,
    totalUserIds: allIds.length,
    capped: allIds.length > cap,
    driftCount: drifts.length,
    drifts,
    ok: drifts.length === 0,
  };
}
