import { buildCorrelationKey, extractSupplierResult } from '../core/provider-contract.js';
import { normalizeNewResultPayload, normalizeNewSignalPayload } from './signalNormalize.js';
import { adminSignalsFlowTrace } from './signalFlowDebug.js';
import { validateRelayResultPredictionOrThrow } from './resultRealAnalysis.js';
import { isResultFullTraceOn, logResultLostAt, traceVerbose } from './resultFullTrace.js';

const HISTORY_CAP = 150;
const LOG_CAP = 220;

function genId() {
  return `sig-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function findPendingForResult(pending, pick) {
  const byKey = pending.find((s) => s.correlationKey === pick.correlationKey);
  if (byKey) return byKey;
  if (pick.providerSignalId) {
    const byProv = pending.find((s) => s.providerSignalId === pick.providerSignalId);
    if (byProv) return byProv;
  }
  const mesa = String(pick.mesa || '');
  const round = String(pick.round || '');
  if (mesa || round) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const s = pending[i];
      if ((mesa && s.mesa === mesa && round && s.round === round) || (mesa && s.mesa === mesa && !round)) {
        return s;
      }
    }
  }
  return pending.length ? pending[pending.length - 1] : null;
}

/**
 * Estado servidor para métricas administrativas (paralelo al Zustand del cliente).
 *
 * @param {{ logger?: object, hooks?: {
 *   onSignalIngested?: (row: object, n: object) => unknown,
 *   onResultSettled?: (settled: object, latencyMs: number, r: object) => unknown,
 *   onCorrelationMiss?: (r: object) => unknown,
 * }}} [opts]
 */
export function createSignalsProcessor({ logger, hooks } = {}) {
  function fire(fn) {
    if (!fn) return;
    try {
      const out = fn();
      if (out && typeof out.then === 'function') out.catch((e) => logger?.warn?.('signal_hook_async', { message: e?.message }));
    } catch (e) {
      logger?.warn?.('signal_hook_sync', { message: e?.message });
    }
  }
  let activeSignals = [];
  let history = [];
  let stats = { wins: 0, losses: 0, pending: 0, totalSignals: 0, totalResults: 0 };
  let correlationErrors = 0;
  /** @type {number[]} */
  const settlementLatenciesMs = [];
  const seenKeys = new Set();
  /** @type {Array<{ ts: number, type: string, mesa: string, note?: string }>} */
  const logTail = [];

  function trimSeen() {
    if (seenKeys.size > 800) {
      const it = seenKeys.values();
      for (let i = 0; i < 400; i++) {
        const v = it.next();
        if (v.done) break;
        seenKeys.delete(v.value);
      }
    }
  }

  function pushLog(entry) {
    logTail.unshift(entry);
    if (logTail.length > LOG_CAP) logTail.pop();
  }

  function ingestNewSignal(payload) {
    const n = normalizeNewSignalPayload(payload);
    const dedupe = `${n.correlationKey}|S|${n.providerSignalId || ''}|${n.round}|${n.mesa}`;
    if (seenKeys.has(dedupe)) {
      adminSignalsFlowTrace(logger, 'processor_new_signal_deduped', { dedupe, correlationKey: n.correlationKey });
      return false;
    }
    seenKeys.add(dedupe);
    trimSeen();

    const row = {
      id: genId(),
      correlationKey: n.correlationKey,
      providerSignalId: n.providerSignalId,
      prediction: n.prediction,
      martingale: n.martingale,
      mesa: n.mesa,
      round: n.round,
      receivedAt: Date.now(),
      status: 'pending',
      settledAt: null,
      winStatus: null,
    };
    activeSignals = [...activeSignals, row];
    stats = {
      ...stats,
      pending: activeSignals.filter((x) => x.status === 'pending').length,
      totalSignals: stats.totalSignals + 1,
    };
    pushLog({ ts: row.receivedAt, type: 'NEW_SIGNAL', mesa: row.mesa || '—' });
    logger?.metric?.('admin_signals_signal', { mesa: row.mesa });
    adminSignalsFlowTrace(logger, 'processor_new_signal_ingested', {
      correlationKey: row.correlationKey,
      mesa: row.mesa,
      prediction: row.prediction,
      id: row.id,
    });
    fire(() => hooks?.onSignalIngested?.(row, n));
    return true;
  }

  function ingestNewResult(payload) {
    try {
      validateRelayResultPredictionOrThrow(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'CRITICAL_MISMATCH') {
        let correlationKey = '(unknown)';
        try {
          const res = extractSupplierResult(payload);
          if (res && typeof res === 'object' && !Array.isArray(res)) {
            correlationKey = buildCorrelationKey(/** @type {Record<string, unknown>} */ (res));
          }
        } catch {
          /* keep unknown */
        }
        console.error('❌ PROCESSOR REJECTED RESULT', correlationKey);
        logger?.error?.('ingestNewResult_blocked', { reason: 'CRITICAL_MISMATCH' });
        adminSignalsFlowTrace(logger, 'processor_new_result_blocked_mismatch', {});
        return false;
      }
      throw e;
    }
    const r = normalizeNewResultPayload(payload);
    console.log('🧠 PROCESSOR RESULT', r.correlationKey);
    if (isResultFullTraceOn()) traceVerbose('🧠 PROCESSOR RESULT', r.correlationKey);
    const dedupe = `${r.correlationKey}|R|${r.winStatus}|${extractRound(payload)}`;
    if (seenKeys.has(dedupe)) {
      console.error('❌ PROCESSOR REJECTED RESULT', r.correlationKey);
      logResultLostAt('PROCESSOR');
      adminSignalsFlowTrace(logger, 'processor_new_result_deduped', { dedupe, correlationKey: r.correlationKey });
      return false;
    }
    seenKeys.add(dedupe);
    trimSeen();

    stats = { ...stats, totalResults: stats.totalResults + 1 };
    const pending = activeSignals.filter((s) => s.status === 'pending');
    const target = findPendingForResult(pending, {
      correlationKey: r.correlationKey,
      providerSignalId: r.providerSignalId,
      mesa: r.mesa,
      round: r.round,
    });

    if (!target) {
      correlationErrors += 1;
      pushLog({ ts: Date.now(), type: 'NEW_RESULT', mesa: r.mesa || '—', note: 'orphan' });
      logger?.warn?.('admin_signals_orphan_result', { correlationKey: r.correlationKey });
      adminSignalsFlowTrace(logger, 'processor_result_orphan', { correlationKey: r.correlationKey });
      fire(() => hooks?.onCorrelationMiss?.(r));
      return true;
    }

    const status = r.winStatus ? 'won' : 'lost';
    const settledAt = Date.now();
    const latencyMs = settledAt - target.receivedAt;
    settlementLatenciesMs.push(latencyMs);
    if (settlementLatenciesMs.length > 96) settlementLatenciesMs.splice(0, settlementLatenciesMs.length - 96);

    activeSignals = activeSignals.filter((x) => x.id !== target.id);
    const settled = {
      ...target,
      status,
      settledAt,
      winStatus: r.winStatus,
    };
    history = [settled, ...history].slice(0, HISTORY_CAP);
    const wins = stats.wins + (r.winStatus ? 1 : 0);
    const losses = stats.losses + (r.winStatus ? 0 : 1);
    stats = {
      ...stats,
      wins,
      losses,
      pending: activeSignals.filter((x) => x.status === 'pending').length,
    };
    pushLog({ ts: settledAt, type: 'NEW_RESULT', mesa: settled.mesa || '—', note: status });
    logger?.metric?.('admin_signals_result', { mesa: settled.mesa, win: r.winStatus });
    adminSignalsFlowTrace(logger, 'processor_result_settled', {
      correlationKey: settled.correlationKey,
      mesa: settled.mesa,
      winStatus: r.winStatus,
      latencyMs,
    });
    fire(() => hooks?.onResultSettled?.(settled, latencyMs, r));
    return true;
  }

  return {
    ingestNewSignal,
    ingestNewResult,
    /** Señales aún sin resultado (para hidratar GPulse Lab al conectar). */
    getPendingSignals() {
      return activeSignals.filter((x) => x.status === 'pending').map((s) => ({ ...s }));
    },
    getSnapshot() {
      const t = stats.wins + stats.losses;
      const winRate = t > 0 ? Math.round((stats.wins / t) * 1000) / 10 : null;
      const avgLatency =
        settlementLatenciesMs.length > 0
          ? Math.round(settlementLatenciesMs.reduce((a, b) => a + b, 0) / settlementLatenciesMs.length)
          : null;
      return {
        stats: { ...stats, winRate, avgLatencyMs: avgLatency },
        correlationErrors,
        activePending: stats.pending,
        historySize: history.length,
        recentLogs: logTail.slice(0, 24),
      };
    },
    reset() {
      activeSignals = [];
      history = [];
      stats = { wins: 0, losses: 0, pending: 0, totalSignals: 0, totalResults: 0 };
      correlationErrors = 0;
      settlementLatenciesMs.length = 0;
      seenKeys.clear();
      logTail.length = 0;
    },
  };
}

function extractRound(payload) {
  const r = payload && typeof payload === 'object' ? payload : {};
  return r.round != null ? String(r.round) : '';
}
