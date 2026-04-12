import { Router } from 'express';
import { resolveMongoSource, tryGetDbConnection } from '../db/connectBridge.js';
import { getSignalModelsForConnection, SIGNAL_METRICS_KEY } from './db/signalMongoModels.js';
import { patchAdminSignalsRuntime, getPublicConfigFromRuntime } from './runtimeConfig.js';
import { computeAdminSignalsAnalytics } from './signalAnalyticsService.js';
import { computeAdminSignalAlerts } from './signalAlertsService.js';
import {
  defaultDateRange,
  parseDateParam,
  querySignalMetricsDailyRange,
} from './signalMetricsDailyQuery.js';
import { computeAdminSignalDailyAlerts } from './signalDailyAlertsService.js';
import {
  applyAutoResponseConfigPatch,
  getAutoResponsePublicState,
  runSignalAutoResponse,
} from './signalAutoResponseService.js';
import { getSignalStreamInterpreter } from './signalStreamInterpreter.js';
import { getSignalSessionTracker } from './signalSessionTracker.js';
import { buildGpulseLabCurrentStateResponse } from './gpulseLabCurrentState.js';
import { getAdminSignalsRelayContext } from './adminSignalsRelayContext.js';
import { relayNormalizedAdminSignals } from './normalizeSignal.js';
import { getAdminSignalsRelayDiagnostics } from './adminSignalsRelayDiagnostics.js';
import { isAdminSignalsFullFlowEnabled, recordFullFlowRow } from './providerFullFlowCapture.js';

/** POST /api/admin/signals/dev/* — activo en no-producción o si ADMIN_SIGNALS_SIMULATE_HTTP=1 */
function isSimulateHttpEnabled() {
  const forced = String(process.env.ADMIN_SIGNALS_SIMULATE_HTTP ?? '').trim() === '1';
  return forced || process.env.NODE_ENV !== 'production';
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {'genesis'|'winx'|'gpulse'|null}
 */
function parseSourceQuery(req, res) {
  try {
    return resolveMongoSource(req.query.source);
  } catch {
    res.status(400).json({
      ok: false,
      error: 'invalid_source',
      hint: 'Use ?source=genesis|winx|gpulse (default: genesis)',
    });
    return null;
  }
}

/**
 * @param {{
 *   processor: ReturnType<import('./processorState.js').createSignalsProcessor>,
 *   logger?: object,
 *   configRateLimit?: import('express').RequestHandler,
 *   persistence?: ReturnType<import('./signalPersistenceService.js').createSignalPersistence>,
 *   signalsRateLimit?: import('express').RequestHandler,
 * }} ctx
 */
export function adminSignalsApi({ processor, logger, configRateLimit, persistence, signalsRateLimit }) {
  const r = Router();
  const signalBucket = signalsRateLimit ?? ((_req, _res, next) => next());
  r.use(signalBucket);

  const limit = configRateLimit ?? ((_req, _res, next) => next());

  r.get('/admin/signals/config', async (_req, res) => {
    try {
      if (persistence?.isReady?.()) await persistence.reloadConfigToRuntime();
      res.json({
        ok: true,
        config: getPublicConfigFromRuntime(),
        relayDiagnostics: getAdminSignalsRelayDiagnostics(),
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  r.post('/admin/signals/config', limit, async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const config = patchAdminSignalsRuntime({
        enabled: body.enabled,
        visibilityEnabled: body.visibilityEnabled,
        showSignalsToUsers: body.showSignalsToUsers,
        delayMs: body.delayMs,
        artificialDelayMs: body.artificialDelayMs,
        martingaleDelta: body.martingaleDelta,
        martingaleDisplayDelta: body.martingaleDisplayDelta,
        filters: body.filters,
      });
      if (persistence?.isReady?.()) {
        await persistence.persistRuntimeConfigToDb();
      }
      logger?.info?.('admin_signals_config_updated', {
        upstreamEnabled: config.upstreamEnabled,
        showSignalsToUsers: config.showSignalsToUsers,
        artificialDelayMs: config.artificialDelayMs,
        martingaleDelta: config.martingaleDelta,
        mesa: config.filters?.mesa,
      });
      res.json({ ok: true, config });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e?.message || e) });
    }
  });

  /** Snapshot en memoria del procesador (sesión API). */
  r.get('/admin/signals/stats', (_req, res) => {
    res.json({ ok: true, ...processor.getSnapshot() });
  });

  /**
   * Estado vivo para hidratar GPulse Lab al conectar (señal pendiente en processor + últimos payloads emitidos).
   * GET /api/admin/signals/current-state
   */
  r.get('/admin/signals/current-state', (_req, res) => {
    try {
      res.json(buildGpulseLabCurrentStateResponse(processor));
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  /** Analytics sobre `signal_events` (histórico). `?source=genesis|winx|gpulse` */
  r.get('/admin/signals/analytics', async (req, res) => {
    const src = parseSourceQuery(req, res);
    if (!src) return;
    try {
      const a = await computeAdminSignalsAnalytics(src);
      res.json({ ok: true, ...a });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  /** Alertas operativas (umbrales sobre ventanas recientes). */
  r.get('/admin/signals/alerts', async (req, res) => {
    const src = parseSourceQuery(req, res);
    if (!src) return;
    try {
      const out = await computeAdminSignalAlerts(src);
      res.json(out);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e), alerts: [] });
    }
  });

  /** Config auto-respuesta (alertas diarias → runtime). */
  r.get('/admin/signals/auto-response-config', (_req, res) => {
    res.json(getAutoResponsePublicState());
  });

  r.post('/admin/signals/auto-response-config', limit, async (req, res) => {
    try {
      const out = applyAutoResponseConfigPatch(req.body && typeof req.body === 'object' ? req.body : {});
      if (persistence?.persistAutoResponseToDb) await persistence.persistAutoResponseToDb();
      res.json(out);
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e?.message || e) });
    }
  });

  r.post('/admin/signals/auto-response/run', limit, async (_req, res) => {
    try {
      const out = await runSignalAutoResponse({ persistence, logger });
      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  /** Alertas multi-día (`signal_metrics_daily`, por defecto últimos 7 días). */
  r.get('/admin/signals/alerts-daily', async (req, res) => {
    const src = parseSourceQuery(req, res);
    if (!src) return;
    try {
      const raw = Number(req.query.days);
      const windowDays = Number.isFinite(raw) ? Math.min(30, Math.max(3, Math.floor(raw))) : 7;
      const out = await computeAdminSignalDailyAlerts(windowDays, src);
      res.json(out);
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: String(e?.message || e),
        alerts: [],
      });
    }
  });

  /** Series diaria Mongo (`signal_metrics_daily`) para gráficos multi-día. */
  r.get('/admin/signals/metrics-daily', async (req, res) => {
    const src = parseSourceQuery(req, res);
    if (!src) return;
    try {
      const fallback = defaultDateRange();
      const fromQ = parseDateParam(req.query.fromDate);
      const toQ = parseDateParam(req.query.toDate);
      const fromDate = fromQ ?? fallback.from;
      const toDate = toQ ?? fallback.to;
      if (fromDate > toDate) {
        return res.status(400).json({ ok: false, error: 'fromDate must be <= toDate (YYYY-MM-DD)' });
      }
      const { mongoReady, days } = await querySignalMetricsDailyRange(fromDate, toDate, src);
      res.json({
        ok: true,
        mongoReady,
        source: src,
        fromDate,
        toDate,
        days,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  /** Métricas persistidas Mongo (`signal_metrics`). */
  r.get('/admin/signals/metrics', async (req, res) => {
    const src = parseSourceQuery(req, res);
    if (!src) return;
    try {
      const conn = tryGetDbConnection(src);
      if (!conn) {
        return res.json({
          ok: true,
          mongoReady: false,
          source: src,
          wins: 0,
          losses: 0,
          correlationMiss: 0,
          avgLatency: null,
          totalSignals: 0,
        });
      }
      const { SignalMetrics } = getSignalModelsForConnection(conn);
      const m = await SignalMetrics.findOne({ key: SIGNAL_METRICS_KEY }).lean();
      if (!m) {
        return res.json({
          ok: true,
          mongoReady: true,
          source: src,
          wins: 0,
          losses: 0,
          correlationMiss: 0,
          avgLatency: null,
          totalSignals: 0,
        });
      }
      const avgLatency =
        m.latencyCount > 0 ? Math.round(m.latencySumMs / m.latencyCount) : null;
      res.json({
        ok: true,
        mongoReady: true,
        source: src,
        wins: m.wins,
        losses: m.losses,
        correlationMiss: m.correlationMiss,
        avgLatency,
        totalSignals: m.totalSignals,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  r.post('/admin/signals/reset-metrics', limit, async (_req, res) => {
    processor.reset();
    if (persistence?.isReady?.()) {
      await persistence.resetMetricsInDb();
    }
    res.json({ ok: true });
  });

  /**
   * Simula un ciclo proveedor (NEW_SIGNAL + NEW_RESULT retardado), mismo pipeline que relay real.
   * Requiere header `X-Admin-Api-Key` (o sesión admin). Body opcional: `{ mesa?, round? }`.
   */
  r.get('/admin/signals/dev/simulate-status', (_req, res) => {
    const ctx = getAdminSignalsRelayContext();
    res.json({
      ok: true,
      simulateHttpEnabled: isSimulateHttpEnabled(),
      relayReady: Boolean(ctx?.io),
    });
  });

  r.post('/admin/signals/dev/simulate-cycle', limit, async (req, res) => {
    if (!isSimulateHttpEnabled()) {
      return res.status(403).json({
        ok: false,
        error: 'simulate_http_disabled',
        hint: 'Set ADMIN_SIGNALS_SIMULATE_HTTP=1 (required when NODE_ENV=production)',
      });
    }
    const ctx = getAdminSignalsRelayContext();
    if (!ctx?.io) {
      return res.status(503).json({ ok: false, error: 'relay_context_unavailable' });
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const mesa = String(body.mesa || 'Baccarat Sim').trim() || 'Baccarat Sim';
    const roundRaw = body.round;
    const round = Number.isFinite(Number(roundRaw)) ? Math.trunc(Number(roundRaw)) : Math.abs(Date.now() % 1_000_000_000);
    const pairId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const testResultDelayMs = Math.max(0, Number(process.env.ADMIN_SIGNALS_TEST_RESULT_DELAY_MS || 650));

    const signalPayload = {
      id: pairId,
      data: {
        signal: {
          nombre_mesa: mesa,
          ronda_actual: round,
          vector_forecast: ['B', 'P', 'B', 'B', 'P', 'B'],
          nombre_algoritmo: 'SIMULATE_HTTP',
        },
      },
    };

    const outSignal = relayNormalizedAdminSignals(ctx, 'NEW_SIGNAL', signalPayload, { source: 'relay' });

    const winner = Math.random() > 0.5 ? 'PLAYER' : 'BANKER';
    const scoreDetail =
      winner === 'PLAYER'
        ? { ganador: 'PLAYER', puntaje_player: '8', puntaje_banker: '6', cartas_player: ['K', '8'], cartas_banker: ['Q', '6'] }
        : { ganador: 'BANKER', puntaje_player: '5', puntaje_banker: '7', cartas_player: ['9', '6'], cartas_banker: ['K', '7'] };

    setTimeout(() => {
      try {
        relayNormalizedAdminSignals(
          ctx,
          'NEW_RESULT',
          {
            mesa,
            round,
            signalId: pairId,
            winStatus: winner === 'PLAYER',
            scoreDetail,
            correlationKey: `${mesa}|${round}`,
          },
          { source: 'relay' },
        );
      } catch (e) {
        logger?.warn?.('simulate_cycle_result_error', { message: e?.message || String(e) });
      }
    }, testResultDelayMs);

    res.json({
      ok: true,
      mesa,
      round,
      pairId,
      winnerScheduled: winner,
      newSignal: outSignal,
      resultScheduledMs: testResultDelayMs,
    });
  });

  /** Últimos frames interpretados (memoria) + contadores; alineado con Socket `signal_stream_frame`. */
  r.get('/admin/signals/stream-debug', (req, res) => {
    const interp = getSignalStreamInterpreter();
    const limitRaw = Number(req.query.limit);
    const lim = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 80;
    res.json({
      ok: true,
      counters: interp.getCounters(),
      recent: interp.getRecent(lim),
    });
  });

  r.get('/admin/signals/signal-sessions', (req, res) => {
    const tr = getSignalSessionTracker();
    const limitRaw = Number(req.query.limit);
    const lim = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 50;
    const latest = String(req.query.latest || '').trim() === '1';
    if (latest) {
      const completed = tr.getCompleted(1);
      const signalSession = completed[0] ?? null;
      return res.json({
        ok: true,
        signalSession,
        active: tr.getActive(),
      });
    }
    res.json({
      ok: true,
      completed: tr.getCompleted(lim),
      active: tr.getActive(),
    });
  });

  /** Última sesión cerrada en modelo canónico SignalSession (Signal Lab). */
  r.get('/admin/signals/signal-lab/latest', (_req, res) => {
    const tr = getSignalSessionTracker();
    const completed = tr.getCompleted(1);
    res.json({
      ok: true,
      session: completed[0] ?? null,
      hasActive: tr.getActive().length > 0,
    });
  });

  /** Modelo canónico forense (misma sesión que `getCompleted(1)`). */
  r.get('/admin/signals/canonical/latest', (_req, res) => {
    const tr = getSignalSessionTracker();
    const completed = tr.getCompleted(1);
    res.json({
      ok: true,
      session: completed[0] ?? null,
    });
  });

  /**
   * Merge GPulse client rows into `debug/provider-full-flow.json` when ADMIN_SIGNALS_FULL_FLOW=1.
   * Body: any JSON object (e.g. `{ pipeline: 'front_socket', type: 'NEW_SIGNAL', data }`).
   */
  r.post('/admin/signals/full-flow', limit, (req, res) => {
    try {
      if (!isAdminSignalsFullFlowEnabled()) {
        return res.status(404).json({ ok: false, error: 'full_flow_disabled' });
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      recordFullFlowRow({ ...body });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e?.message || e) });
    }
  });

  return r;
}
