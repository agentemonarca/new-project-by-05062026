import { tryGetDbConnection } from '../db/connectBridge.js';
import { getSignalModelsForConnection } from './db/signalMongoModels.js';

function normResult(r) {
  if (r === 'won') return 'win';
  if (r === 'lost') return 'loss';
  return r;
}

/**
 * @param {object} doc
 */
function serializeEventLean(doc) {
  const id = doc._id?.toString?.() ?? String(doc._id);
  const correlationMiss = Boolean(doc.correlationMiss);
  const rawResult = doc.result != null ? normResult(doc.result) : null;
  const pending =
    !correlationMiss && doc.type === 'NEW_SIGNAL' && (rawResult == null || rawResult === '');
  const displayResult = correlationMiss ? null : rawResult;
  const rawHasRaw = Boolean(doc.rawPayload || doc.rawResultPayload);
  return {
    id,
    type: doc.type,
    correlationKey: doc.correlationKey ?? '',
    mesa: doc.mesa ?? '',
    round: doc.round ?? '',
    recommendation: doc.recommendation ?? null,
    martingale: doc.martingale ?? 0,
    result: pending ? null : displayResult,
    correlationMiss,
    latencyMs: doc.latencyMs ?? doc.latency ?? null,
    providerTimestamp: doc.providerTimestamp ? doc.providerTimestamp.toISOString?.() : null,
    createdAt: doc.createdAt ? doc.createdAt.toISOString?.() : null,
    serverSettledAt: doc.serverSettledAt ? doc.serverSettledAt.toISOString?.() : null,
    pending,
    _hasRaw: rawHasRaw,
  };
}

/**
 * Analytics operativo sobre `signal_events` + compat lecturas legacy (`won`/`lost`).
 * @param {'genesis'|'winx'|'gpulse'} [source]
 */
export async function computeAdminSignalsAnalytics(source = 'genesis') {
  const conn = tryGetDbConnection(source);
  if (!conn) {
    return {
      ok: true,
      mongoReady: false,
      source,
      winRateGlobal: null,
      winRateByMesa: {},
      avgLatency: null,
      signalsPerMinute: 0,
      correlationMissRate: null,
      correlationMisses: 0,
      settledTotal: 0,
      lastSignals: [],
    };
  }

  const { SignalEvent } = getSignalModelsForConnection(conn);
  const since1m = new Date(Date.now() - 60_000);

  const settledMatch = {
    correlationMiss: { $ne: true },
    result: { $in: ['win', 'won', 'loss', 'lost'] },
  };

  const [globalAgg] = await SignalEvent.aggregate([
    { $match: settledMatch },
    {
      $group: {
        _id: null,
        wins: { $sum: { $cond: [{ $in: ['$result', ['win', 'won']] }, 1, 0] } },
        losses: { $sum: { $cond: [{ $in: ['$result', ['loss', 'lost']] }, 1, 0] } },
      },
    },
  ]);

  const wins = globalAgg?.wins ?? 0;
  const losses = globalAgg?.losses ?? 0;
  const settledTotal = wins + losses;
  const winRateGlobal =
    settledTotal > 0 ? Math.round((wins / settledTotal) * 1000) / 10 : null;

  const byMesa = await SignalEvent.aggregate([
    { $match: { ...settledMatch, mesa: { $gt: '' } } },
    {
      $group: {
        _id: '$mesa',
        w: { $sum: { $cond: [{ $in: ['$result', ['win', 'won']] }, 1, 0] } },
        l: { $sum: { $cond: [{ $in: ['$result', ['loss', 'lost']] }, 1, 0] } },
      },
    },
  ]);

  /** @type {Record<string, number | null>} */
  const winRateByMesa = {};
  for (const row of byMesa) {
    const mesaKey = String(row._id || '—');
    const t = (row.w ?? 0) + (row.l ?? 0);
    winRateByMesa[mesaKey] = t > 0 ? Math.round(((row.w ?? 0) / t) * 1000) / 10 : null;
  }

  const [latAgg] = await SignalEvent.aggregate([
    {
      $match: {
        $or: [{ latencyMs: { $gt: 0 } }, { latency: { $gt: 0 } }],
      },
    },
    {
      $project: {
        L: {
          $cond: [
            { $gt: [{ $ifNull: ['$latencyMs', 0] }, 0] },
            '$latencyMs',
            '$latency',
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        avg: { $avg: '$L' },
      },
    },
  ]);

  const avgLatency = latAgg?.avg != null ? Math.round(latAgg.avg) : null;

  const signalsPerMinute = await SignalEvent.countDocuments({
    createdAt: { $gte: since1m },
    $or: [{ ingressKind: 'signal' }, { ingressKind: { $exists: false } }],
  });

  const correlationMisses = await SignalEvent.countDocuments({ correlationMiss: true });
  const denomForMiss = settledTotal + correlationMisses;
  const correlationMissRate =
    denomForMiss > 0 ? Math.round((correlationMisses / denomForMiss) * 1000) / 10 : null;

  const lastDocs = await SignalEvent.find({})
    .sort({ createdAt: -1 })
    .limit(50)
    .select({
      type: 1,
      correlationKey: 1,
      mesa: 1,
      round: 1,
      recommendation: 1,
      martingale: 1,
      result: 1,
      correlationMiss: 1,
      latencyMs: 1,
      latency: 1,
      providerTimestamp: 1,
      createdAt: 1,
      serverSettledAt: 1,
      rawPayload: 1,
      rawResultPayload: 1,
    })
    .lean();

  return {
    ok: true,
    mongoReady: true,
    source,
    winRateGlobal,
    winRateByMesa,
    avgLatency,
    signalsPerMinute,
    correlationMissRate,
    correlationMisses,
    settledTotal,
    lastSignals: lastDocs.map(serializeEventLean),
  };
}
