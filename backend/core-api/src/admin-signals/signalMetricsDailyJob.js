import { getDbConnection, isGenesisMongoReady } from '../db/connectBridge.js';
import { getSignalModelsForConnection } from './db/signalMongoModels.js';

/**
 * Ventana UTC del día civil **ayer** (útil si el job corre justo tras medianoche).
 */
export function utcYesterdayBounds(from = new Date()) {
  const now = new Date(from);
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(todayStart);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = todayStart;
  const dayStr = start.toISOString().slice(0, 10);
  return { start, end, dayStr };
}

/**
 * @param {{ start: Date, end: Date, dayStr: string, logger?: object }} ctx
 */
export async function runSignalMetricsDailyForDay({ start, end, dayStr, logger }) {
  if (!isGenesisMongoReady()) {
    logger?.warn?.('signal_metrics_daily_skip', { reason: 'mongo_not_ready', dayStr });
    return;
  }

  const { SignalEvent, SignalMetricsDaily } = getSignalModelsForConnection(
    getDbConnection('genesis'),
  );

  try {
    const signalIngressMatch = {
      createdAt: { $gte: start, $lt: end },
      $or: [{ ingressKind: 'signal' }, { ingressKind: { $exists: false } }],
    };

    const [ingestAgg] = await SignalEvent.aggregate([
      { $match: signalIngressMatch },
      {
        $group: {
          _id: null,
          totalSignals: { $sum: 1 },
        },
      },
    ]);

    const correlationMisses = await SignalEvent.countDocuments({
      createdAt: { $gte: start, $lt: end },
      correlationMiss: true,
    });

    const [settledAgg] = await SignalEvent.aggregate([
      {
        $match: {
          $or: [
            { serverSettledAt: { $gte: start, $lt: end } },
            {
              type: 'NEW_RESULT',
              createdAt: { $gte: start, $lt: end },
              $or: [{ serverSettledAt: null }, { serverSettledAt: { $exists: false } }],
            },
          ],
          result: { $in: ['win', 'won', 'loss', 'lost'] },
        },
      },
      {
        $group: {
          _id: null,
          wins: { $sum: { $cond: [{ $in: ['$result', ['win', 'won']] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $in: ['$result', ['loss', 'lost']] }, 1, 0] } },
          latSum: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ['$latencyMs', { $ifNull: ['$latency', 0] }] }, 0] },
                { $ifNull: ['$latencyMs', { $ifNull: ['$latency', 0] }] },
                0,
              ],
            },
          },
          latN: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ['$latencyMs', { $ifNull: ['$latency', 0] }] }, 0] }, 1, 0],
            },
          },
        },
      },
    ]);

    const totalSignals = ingestAgg?.totalSignals ?? 0;
    const wins = settledAgg?.wins ?? 0;
    const losses = settledAgg?.losses ?? 0;
    const latN = settledAgg?.latN ?? 0;
    const latSum = settledAgg?.latSum ?? 0;
    const avgLatencyMs = latN > 0 ? Math.round(latSum / latN) : null;

    await SignalMetricsDaily.findOneAndUpdate(
      { date: dayStr },
      {
        $set: {
          totalSignals,
          wins,
          losses,
          avgLatencyMs,
          correlationMisses,
          computedAt: new Date(),
        },
      },
      { upsert: true },
    );
    logger?.info?.('signal_metrics_daily_aggregated', { date: dayStr });
  } catch (e) {
    logger?.warn?.('signal_metrics_daily_failed', { message: e?.message, dayStr });
  }
}

/**
 * Primera pasada tras arranque + planificación diaria ~00:05 UTC.
 *
 * @param {{ logger?: object }} ctx
 */
export function startSignalMetricsDailyAggregation({ logger }) {
  setTimeout(() => {
    const b = utcYesterdayBounds();
    runSignalMetricsDailyForDay({ ...b, logger });
  }, 15_000);

  function planNextMidnight() {
    const now = new Date();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0),
    );
    const ms = Math.max(10_000, next.getTime() - Date.now());
    setTimeout(async () => {
      const b = utcYesterdayBounds();
      await runSignalMetricsDailyForDay({ ...b, logger });
      planNextMidnight();
    }, ms);
  }

  planNextMidnight();
}
