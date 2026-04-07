import { tryGetDbConnection } from '../db/connectBridge.js';
import { getSignalModelsForConnection } from './db/signalMongoModels.js';

const MISS_RATE_PCT = 5;
const LATENCY_MS = 2000;
const WIN_RATE_PCT = 45;
const MIN_SETTLED_FOR_WIN_ALERT = 5;

function settledInLastHourMatch(since1h) {
  return {
    correlationMiss: { $ne: true },
    result: { $in: ['win', 'won', 'loss', 'lost'] },
    $or: [
      { serverSettledAt: { $gte: since1h } },
      {
        type: 'NEW_RESULT',
        createdAt: { $gte: since1h },
        $or: [{ serverSettledAt: null }, { serverSettledAt: { $exists: false } }],
      },
    ],
  };
}

/**
 * Alertas en tiempo casi real (ventana 1 h para rendimiento/correlación; flujo 1 min).
 * @param {'genesis'|'winx'|'gpulse'} [source]
 */
export async function computeAdminSignalAlerts(source = 'genesis') {
  const timestamp = new Date().toISOString();

  const conn = tryGetDbConnection(source);
  if (!conn) {
    return {
      ok: true,
      mongoReady: false,
      source,
      alerts: [],
    };
  }

  const { SignalEvent } = getSignalModelsForConnection(conn);
  const since1h = new Date(Date.now() - 3_600_000);
  const since1m = new Date(Date.now() - 60_000);

  const settled1hMatch = settledInLastHourMatch(since1h);

  const [hourAgg] = await SignalEvent.aggregate([
    { $match: settled1hMatch },
    {
      $group: {
        _id: null,
        wins: { $sum: { $cond: [{ $in: ['$result', ['win', 'won']] }, 1, 0] } },
        losses: { $sum: { $cond: [{ $in: ['$result', ['loss', 'lost']] }, 1, 0] } },
      },
    },
  ]);

  const wins1h = hourAgg?.wins ?? 0;
  const losses1h = hourAgg?.losses ?? 0;
  const settled1h = wins1h + losses1h;
  const winRate1h =
    settled1h > 0 ? Math.round((wins1h / settled1h) * 1000) / 10 : null;

  const misses1h = await SignalEvent.countDocuments({
    correlationMiss: true,
    createdAt: { $gte: since1h },
  });

  const denomMiss = settled1h + misses1h;
  const correlationMissRate =
    denomMiss > 0 ? Math.round((misses1h / denomMiss) * 1000) / 10 : null;

  const latMatch = {
    $and: [
      settled1hMatch,
      { $or: [{ latencyMs: { $gt: 0 } }, { latency: { $gt: 0 } }] },
    ],
  };

  const [latAgg] = await SignalEvent.aggregate([
    { $match: latMatch },
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
    { $group: { _id: null, avg: { $avg: '$L' } } },
  ]);

  const avgLatencyMs = latAgg?.avg != null ? Math.round(latAgg.avg) : null;

  const signalsPerMinute = await SignalEvent.countDocuments({
    createdAt: { $gte: since1m },
    $or: [{ ingressKind: 'signal' }, { ingressKind: { $exists: false } }],
  });

  /** @type {Array<{ type: string, severity: string, message: string, value: number | null, timestamp: string }>} */
  const alerts = [];

  if (correlationMissRate != null && correlationMissRate > MISS_RATE_PCT) {
    alerts.push({
      type: 'CORRELATION_ERROR',
      severity: 'high',
      message: 'Tasa de fallos de correlación > 5% (ventana 1 h)',
      value: correlationMissRate,
      timestamp,
    });
  }

  if (avgLatencyMs != null && avgLatencyMs > LATENCY_MS) {
    alerts.push({
      type: 'HIGH_LATENCY',
      severity: 'medium',
      message: 'Latencia media de resolución > 2000 ms (ventana 1 h)',
      value: avgLatencyMs,
      timestamp,
    });
  }

  if (winRate1h != null && settled1h >= MIN_SETTLED_FOR_WIN_ALERT && winRate1h < WIN_RATE_PCT) {
    alerts.push({
      type: 'LOW_PERFORMANCE',
      severity: 'high',
      message: 'Win rate bajo en última hora (< 45%)',
      value: winRate1h,
      timestamp,
    });
  }

  if (signalsPerMinute === 0) {
    alerts.push({
      type: 'NO_SIGNAL_FLOW',
      severity: 'medium',
      message: 'Sin ingreso de señales en el último minuto',
      value: 0,
      timestamp,
    });
  }

  return {
    ok: true,
    mongoReady: true,
    source,
    alerts,
  };
}
