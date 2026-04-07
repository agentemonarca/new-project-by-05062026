import { useEffect, useRef } from 'react';
import { adminSignalsFetch } from '../lib/adminSignalsApi.js';
import { useAdminSignalsPollingStore } from '../stores/adminSignalsPollingStore.js';
import { useAdminSignalsStore } from '../stores/adminSignalsStore.js';

const BASE_INTERVAL_MS = 12_000;
const MAX_BACKOFF_MS = 120_000;

const ALERTS_DAILY_URL = '/api/admin/signals/alerts-daily?days=7';

/**
 * @param {Response} res
 * @returns {number | null}
 */
function parseRetryAfterHeaderMs(res) {
  const raw = res.headers?.get?.('retry-after');
  if (raw == null || raw === '') return null;
  const sec = Number(raw);
  if (Number.isFinite(sec) && sec >= 0) return Math.min(MAX_BACKOFF_MS, sec * 1000);
  const when = Date.parse(raw);
  if (!Number.isNaN(when)) return Math.min(MAX_BACKOFF_MS, Math.max(0, when - Date.now()));
  return null;
}

/**
 * @param {unknown} json
 * @returns {number | null}
 */
function parseRetryAfterBodyMs(json) {
  if (!json || typeof json !== 'object') return null;
  const v = /** @type {{ retryAfter?: unknown, retry_after?: unknown }} */ (json).retryAfter ??
    /** @type {{ retry_after?: unknown }} */ (json).retry_after;
  if (v == null || v === '') return null;
  const sec = Number(v);
  if (!Number.isFinite(sec) || sec < 0) return null;
  return Math.min(MAX_BACKOFF_MS, sec * 1000);
}

/**
 * Métricas “signal_metrics” aproximadas desde /analytics (evita GET /metrics extra).
 * @param {object | null} analyticsJ
 */
function deriveMongoMetricsFromAnalytics(analyticsJ) {
  if (!analyticsJ?.ok) return null;
  const settled = Number(analyticsJ.settledTotal ?? 0);
  const wr = analyticsJ.winRateGlobal;
  const misses = Number(analyticsJ.correlationMisses ?? 0);
  const avgLatency = analyticsJ.avgLatency ?? null;

  if (!analyticsJ.mongoReady) {
    return {
      ok: true,
      wins: 0,
      losses: 0,
      correlationMiss: misses,
      avgLatency,
      totalSignals: 0,
      source: 'none',
    };
  }

  if (settled <= 0 || wr == null) {
    return {
      ok: true,
      wins: 0,
      losses: 0,
      correlationMiss: misses,
      avgLatency,
      totalSignals: 0,
      source: 'analytics',
    };
  }

  const wins = Math.round((settled * Number(wr)) / 100);
  const losses = Math.max(0, settled - wins);

  return {
    ok: true,
    wins,
    losses,
    correlationMiss: misses,
    avgLatency,
    totalSignals: settled,
    source: 'analytics',
  };
}

/**
 * Un solo temporizador: stats + analytics + alerts-daily en paralelo (~10–15 s).
 * Respeta Retry-After (cabecera) y `retryAfter` en JSON; backoff si falla todo.
 *
 * @param {{ baseIntervalMs?: number }} [opts]
 */
export function useAdminSignalsPolling(opts = {}) {
  const baseMs = Math.min(15_000, Math.max(10_000, opts.baseIntervalMs ?? BASE_INTERVAL_MS));
  const resumeToken = useAdminSignalsPollingStore((s) => s.resumeToken);
  const pollKick = useAdminSignalsPollingStore((s) => s.pollKick);
  const timerRef = useRef(0);
  const consecutiveErrorsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    consecutiveErrorsRef.current = 0;

    const clearTimer = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = 0;
      }
    };

    const scheduleNext = (delayMs) => {
      clearTimer();
      const d = Math.max(2000, Math.min(MAX_BACKOFF_MS, delayMs));
      useAdminSignalsPollingStore.getState().ingest({ scheduledAfterMs: d });
      timerRef.current = window.setTimeout(run, d);
    };

    async function run() {
      if (cancelled) return;

      if (useAdminSignalsPollingStore.getState().pollingStopped) {
        useAdminSignalsPollingStore.getState().ingest({ loading: false });
        return;
      }

      useAdminSignalsPollingStore.getState().ingest({
        loading: true,
        pollError: null,
      });

      const urls = ['/api/admin/signals/stats', '/api/admin/signals/analytics', ALERTS_DAILY_URL];

      /** @type {Response[]} */
      let responses;
      try {
        responses = await Promise.all(urls.map((path) => adminSignalsFetch(path)));
      } catch {
        consecutiveErrorsRef.current += 1;
        const backoff = Math.min(
          MAX_BACKOFF_MS,
          baseMs * 2 ** Math.min(6, consecutiveErrorsRef.current),
        );
        useAdminSignalsPollingStore.getState().ingest({
          loading: false,
          pollError: 'network',
          serverPairError: 'offline',
          analyticsError: 'network',
          alertsError: 'network',
          alertsDailyError: 'network',
        });
        scheduleNext(backoff);
        return;
      }

      const [rStats, rAn, rDaily] = responses;

      useAdminSignalsStore.getState().setServerAuthDenied(false);

      const r429 = responses.find((r) => r.status === 429);
      if (r429) {
        consecutiveErrorsRef.current += 1;
        const headerMs = parseRetryAfterHeaderMs(r429);
        let bodyMs = null;
        try {
          bodyMs = parseRetryAfterBodyMs(await r429.clone().json());
        } catch {
          bodyMs = null;
        }
        const retryMs = headerMs ?? bodyMs;
        const fallback = Math.min(
          MAX_BACKOFF_MS,
          baseMs * 2 ** Math.min(5, consecutiveErrorsRef.current),
        );
        useAdminSignalsPollingStore.getState().ingest({
          loading: false,
          pollError: 'rate_limited',
        });
        scheduleNext(retryMs ?? fallback);
        return;
      }

      let statsJ = null;
      let pairErr = null;
      try {
        if (rStats.ok) statsJ = await rStats.json();
        else pairErr = `stats ${rStats.status}`;
      } catch {
        pairErr = 'parse';
      }

      let analyticsJ = null;
      let analyticsErr = null;
      try {
        if (rAn.ok) {
          analyticsJ = await rAn.json();
          if (!analyticsJ?.ok) {
            analyticsErr = analyticsJ?.error ? String(analyticsJ.error) : 'bad_response';
            analyticsJ = null;
          }
        } else {
          analyticsErr = `HTTP ${rAn.status}`;
        }
      } catch {
        analyticsErr = 'parse';
      }

      let dailyJ = null;
      let dailyErr = null;
      try {
        if (rDaily.ok) {
          dailyJ = await rDaily.json();
          if (dailyJ && dailyJ.ok === false && dailyJ.error) {
            dailyErr = String(dailyJ.error);
            dailyJ = null;
          }
        } else {
          dailyErr = `HTTP ${rDaily.status}`;
        }
      } catch {
        dailyErr = 'parse';
      }

      const allDaily = Array.isArray(dailyJ?.alerts) ? dailyJ.alerts : [];
      const boundary = String(dailyJ?.toDate || '');
      const alertsRecent = boundary ? allDaily.filter((a) => a?.date === boundary) : allDaily;

      const derivedMetrics = deriveMongoMetricsFromAnalytics(analyticsJ);

      const anyOk = rStats.ok || rAn.ok || rDaily.ok;

      useAdminSignalsPollingStore.getState().ingest({
        loading: false,
        serverStats: statsJ,
        serverMetrics: derivedMetrics,
        serverPairError: pairErr,
        analytics: analyticsJ,
        analyticsError: analyticsErr,
        alerts: alertsRecent,
        alertsMongoReady: dailyJ ? dailyJ.mongoReady !== false : true,
        alertsError: dailyErr && !allDaily.length ? dailyErr : null,
        alertsDaily: allDaily,
        alertsDailyFromDate: String(dailyJ?.fromDate || ''),
        alertsDailyToDate: String(dailyJ?.toDate || ''),
        alertsDailyError: dailyErr,
        alertsDailyMongoReady: dailyJ ? dailyJ.mongoReady !== false : true,
        pollError: anyOk ? null : 'all_failed',
        scheduledAfterMs: baseMs,
      });

      if (!anyOk) {
        consecutiveErrorsRef.current += 1;
        const backoff = Math.min(
          MAX_BACKOFF_MS,
          baseMs * 2 ** Math.min(6, consecutiveErrorsRef.current),
        );
        scheduleNext(backoff);
      } else {
        consecutiveErrorsRef.current = 0;
        scheduleNext(baseMs);
      }
    }

    run();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [baseMs, resumeToken, pollKick]);
}
