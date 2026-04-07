import { tryGetDbConnection } from '../db/connectBridge.js';
import { getSignalModelsForConnection } from './db/signalMongoModels.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {unknown} s
 * @returns {string | null}
 */
export function parseDateParam(s) {
  if (s == null || typeof s !== 'string') return null;
  const t = s.trim();
  if (!YMD.test(t)) return null;
  return t;
}

/** Últimos `n` días UTC inclusive (hoy cuenta como uno). */
export function lastNDaysRangeUtc(n) {
  const days = Math.max(1, Math.min(90, Number(n) || 7));
  const to = new Date();
  const toStr = to.toISOString().slice(0, 10);
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  from.setUTCDate(from.getUTCDate() - (days - 1));
  const fromStr = from.toISOString().slice(0, 10);
  return { from: fromStr, to: toStr, days };
}

/** Últimos 14 días UTC inclusive. */
export function defaultDateRange() {
  const to = new Date();
  const toStr = to.toISOString().slice(0, 10);
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  from.setUTCDate(from.getUTCDate() - 13);
  const fromStr = from.toISOString().slice(0, 10);
  return { from: fromStr, to: toStr };
}

/**
 * @param {string} fromStr YYYY-MM-DD
 * @param {string} toStr YYYY-MM-DD
 * @param {'genesis'|'winx'|'gpulse'} [source]
 */
export async function querySignalMetricsDailyRange(fromStr, toStr, source = 'genesis') {
  const conn = tryGetDbConnection(source);
  if (!conn) {
    return { mongoReady: false, source, days: [] };
  }

  const { SignalMetricsDaily } = getSignalModelsForConnection(conn);
  const docs = await SignalMetricsDaily.find({
    date: { $gte: fromStr, $lte: toStr },
  })
    .sort({ date: 1 })
    .lean();

  const days = docs.map((d) => {
    const w = d.wins ?? 0;
    const l = d.losses ?? 0;
    const settled = w + l;
    const winRate = settled > 0 ? Math.round((w / settled) * 1000) / 10 : null;
    return {
      date: d.date,
      totalSignals: d.totalSignals ?? 0,
      wins: w,
      losses: l,
      winRate,
      avgLatencyMs: d.avgLatencyMs != null && !Number.isNaN(d.avgLatencyMs) ? d.avgLatencyMs : null,
    };
  });

  return { mongoReady: true, source, days };
}
