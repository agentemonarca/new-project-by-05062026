import { lastNDaysRangeUtc, querySignalMetricsDailyRange } from './signalMetricsDailyQuery.js';

const WINRATE_DROP_RATIO = 0.85;
const LATENCY_SPIKE_RATIO = 2;
const LOW_VOLUME_RATIO = 0.5;
const WINRATE_CRITICAL_PCT = 45;

function mean(nums) {
  const a = nums.filter((x) => x != null && !Number.isNaN(x));
  if (!a.length) return null;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

/**
 * Alertas derivadas de `signal_metrics_daily` (ventana multi-día).
 * Por defecto últimos 7 días UTC.
 * @param {number} [windowDays]
 * @param {'genesis'|'winx'|'gpulse'} [source]
 */
export async function computeAdminSignalDailyAlerts(windowDays = 7, source = 'genesis') {
  const { from, to, days: n } = lastNDaysRangeUtc(windowDays);
  const { mongoReady, days } = await querySignalMetricsDailyRange(from, to, source);

  if (!mongoReady) {
    return {
      ok: true,
      mongoReady: false,
      source,
      windowDays: n,
      fromDate: from,
      toDate: to,
      alerts: [],
    };
  }

  if (!days.length) {
    return {
      ok: true,
      mongoReady,
      source,
      windowDays: n,
      fromDate: from,
      toDate: to,
      alerts: [],
    };
  }

  /** @type {Array<{ type: string, severity: string, message: string, value: number | null, date: string }>} */
  const alerts = [];

  for (const d of days) {
    const date = d.date;

    const othersWinRates = days
      .filter((x) => x.date !== date)
      .map((x) => x.winRate)
      .filter((v) => v != null)
      .map(Number);
    const avgWinEx = mean(othersWinRates);

    const othersLat = days
      .filter((x) => x.date !== date)
      .map((x) => x.avgLatencyMs)
      .filter((v) => v != null && v > 0)
      .map(Number);
    const avgLatEx = mean(othersLat);

    const othersVol = days
      .filter((x) => x.date !== date)
      .map((x) => Number(x.totalSignals) || 0);
    const avgVolEx = mean(othersVol);

    if (d.winRate != null && d.wins + d.losses > 0) {
      const wr = Number(d.winRate);

      if (wr < WINRATE_CRITICAL_PCT) {
        alerts.push({
          type: 'WINRATE_CRITICAL',
          severity: 'critical',
          message: `Win rate diario por debajo del umbral crítico (< ${WINRATE_CRITICAL_PCT}%)`,
          value: Math.round(wr * 10) / 10,
          date,
        });
      }

      if (
        avgWinEx != null &&
        avgWinEx > 0 &&
        othersWinRates.length >= 1 &&
        wr < avgWinEx * WINRATE_DROP_RATIO
      ) {
        alerts.push({
          type: 'WINRATE_DROP',
          severity: 'high',
          message: 'Caída fuerte en win rate vs promedio de otros días de la ventana (> 15%)',
          value: Math.round(wr * 10) / 10,
          date,
        });
      }
    }

    if (d.avgLatencyMs != null && d.avgLatencyMs > 0 && avgLatEx != null && avgLatEx > 0) {
      const lat = Number(d.avgLatencyMs);
      if (othersLat.length >= 1 && lat >= avgLatEx * LATENCY_SPIKE_RATIO) {
        alerts.push({
          type: 'LATENCY_SPIKE',
          severity: 'high',
          message: 'Latencia media del día más del doble vs promedio de otros días (> 100%)',
          value: lat,
          date,
        });
      }
    }

    if (avgVolEx != null && avgVolEx > 0 && othersVol.length >= 1) {
      const vol = Number(d.totalSignals) || 0;
      if (vol < avgVolEx * LOW_VOLUME_RATIO) {
        alerts.push({
          type: 'LOW_VOLUME',
          severity: 'warning',
          message: 'Volumen de señales muy por debajo del promedio de otros días (> 50%)',
          value: vol,
          date,
        });
      }
    }
  }

  alerts.sort((a, b) => {
    const c = String(b.date).localeCompare(String(a.date));
    if (c !== 0) return c;
    const order = { critical: 0, high: 1, warning: 2, info: 3 };
    return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
  });

  return {
    ok: true,
    mongoReady: true,
    source,
    windowDays: n,
    fromDate: from,
    toDate: to,
    alerts,
  };
}
