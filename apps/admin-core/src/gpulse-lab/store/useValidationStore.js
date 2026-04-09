import { create } from 'zustand';
import { getActiveLabSignalPayloadForMesa } from '../middleware/useSignalMiddleware.js';
import { recordGpulseLabCycleMetrics } from '../telemetry/recordGpulseLabCycleMetrics.js';
import { gpulseLabLog } from '../utils/gpulseLabLog.js';
import { wasGpulseLabAutoResyncedRecently } from '../utils/gpulseLabResync.js';
import { resyncQualityPresentation } from '../utils/resyncQuality.js';
import { ALERT_TYPES, pushAlert } from './useAlertStore.js';
import { useMetricsStore } from './useMetricsStore.js';
import { recordControlCenterCycleEnd } from '../utils/controlCenterTelemetry.js';
import { buildLabCorrelationKey, normalizeCorrelationKey } from '../utils/labCorrelationKey.js';

const MAX_CYCLES = 50;
const MAX_LOGS = 200;
/** Retardo señal→resultado en wire (stream) fuera de rango (ms). */
const STREAM_DELAY_WARN_MAX_MS = 10 * 60 * 1000;

/** Máx. tiempo señal stream → resultado stream sin NEW_RESULT (ms). */
export const MAX_CYCLE_DURATION_MS = 60000;

const STREAM_DELAY_HISTORY_MAX = 20;
/** @type {Map<string, number[]>} */
const lastDelaysByMesa = new Map();

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const streamResultWaitTimers = new Map();

/** @type {Map<string, { mesa: unknown, round: string, recommendation: unknown, signalAt: number, resultAt?: number, ganador?: unknown, correlationKey: string, syncSource?: 'bootstrap' | null }>} */
const streamByKey = new Map();

function correlationKeyFrom(mesa, round) {
  return normalizeCorrelationKey(null, mesa, round) ?? buildLabCorrelationKey(mesa ?? '', round ?? '');
}

function mesaKeyStr(mesa) {
  return mesa == null ? '' : String(mesa).trim();
}

function recordStreamDelayForMesa(mesa, delayMs) {
  const k = mesaKeyStr(mesa);
  if (!k) return;
  if (typeof delayMs !== 'number' || !Number.isFinite(delayMs) || delayMs < 0 || delayMs > 10 * 60 * 1000) return;
  const prev = lastDelaysByMesa.get(k) ?? [];
  const next = [...prev, delayMs].slice(-STREAM_DELAY_HISTORY_MAX);
  lastDelaysByMesa.set(k, next);
}

function statsForMesa(mesa) {
  const k = mesaKeyStr(mesa);
  const arr = k ? lastDelaysByMesa.get(k) ?? [] : [];
  if (!Array.isArray(arr) || arr.length === 0) return { avgDelay: null, maxObserved: null, count: 0 };
  const sum = arr.reduce((a, b) => a + b, 0);
  const maxObserved = arr.reduce((m, v) => (v > m ? v : m), arr[0]);
  return { avgDelay: Math.round(sum / arr.length), maxObserved: Math.round(maxObserved), count: arr.length };
}

/** Real STREAM_TIMEOUT only after max observed delay + buffer (not 10s betting). */
function streamDeadlineMsForMesa(mesa) {
  const { maxObserved, count } = statsForMesa(mesa);
  if (count === 0) return 60000;
  return Math.max((maxObserved ?? 0) + 10000, 45000);
}

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const streamDelayExpectedTimers = new Map();

function clearStreamDelayExpectedTimer(k) {
  const t = streamDelayExpectedTimers.get(k);
  if (t != null) {
    clearTimeout(t);
    streamDelayExpectedTimers.delete(k);
  }
}

/**
 * Exposed for UI (prediction, badges).
 * @param {unknown} mesa
 */
export function getStreamDelayStatsForMesa(mesa) {
  return statsForMesa(mesa);
}

/**
 * Umbral adaptativo stream (ms), mismo criterio que el timeout de stream en validación.
 * @param {unknown} mesa
 */
export function getAdaptiveStreamDeadlineMs(mesa) {
  const { maxObserved, count } = statsForMesa(mesa);
  if (count === 0) return 60000;
  return Math.max((maxObserved ?? 0) + 10000, 45000);
}

function pruneStreamMap() {
  if (streamByKey.size <= 120) return;
  const keys = [...streamByKey.keys()];
  keys.slice(0, keys.length - 100).forEach((k) => {
    clearStreamResultTimer(k);
    streamByKey.delete(k);
    useValidationStore.getState().removeActiveStreamWait(k);
  });
}

function clearStreamResultTimer(k) {
  clearStreamDelayExpectedTimer(k);
  const t = streamResultWaitTimers.get(k);
  if (t != null) {
    clearTimeout(t);
    streamResultWaitTimers.delete(k);
  }
}

function scheduleDelayExpectedHint(k) {
  clearStreamDelayExpectedTimer(k);
  const latest = streamByKey.get(k);
  if (!latest || latest.syncSource === 'bootstrap') return;
  const st = statsForMesa(latest.mesa);
  if (st.avgDelay == null || st.count < 1) return;
  const fireIn = Math.max(0, st.avgDelay);
  const t = setTimeout(() => {
    streamDelayExpectedTimers.delete(k);
    const row = streamByKey.get(k);
    if (!row || row.resultAt != null) return;
    const now = Date.now();
    const elapsed = now - row.signalAt;
    const deadlineMs = streamDeadlineMsForMesa(row.mesa);
    if (elapsed >= deadlineMs) return;
    pushAlert({
      type: ALERT_TYPES.STREAM_DELAY_EXPECTED,
      mesa: row.mesa,
      round: row.round,
      message: 'El proveedor está dentro de su comportamiento normal',
      severity: 'info',
      rawPayload: {
        correlationKey: k,
        elapsed,
        avgDelay: st.avgDelay,
        maxObserved: st.maxObserved,
        deadlineMs,
        kind: 'STREAM_DELAY_EXPECTED_HINT',
      },
      context: { correlationKey: k, signalExists: true, resultExists: false },
    });
  }, fireIn);
  streamDelayExpectedTimers.set(k, t);
}

/**
 * Stream: señal sin resultado dentro de MAX_CYCLE_DURATION_MS → ciclo ERROR + alerta.
 * @param {string} k
 */
function handleStreamCycleTimeout(k) {
  if (!validationEnabled) return;
  const latest = streamByKey.get(k);
  if (!latest || latest.resultAt != null) return;
  if (latest.syncSource === 'bootstrap') {
    // Bootstrap hydration can include an open signal without a result; do not treat as anomalous.
    useValidationStore.getState().removeActiveStreamWait(k);
    useValidationStore.getState().pushLog('info', 'stream timeout ignored (bootstrap)', { correlationKey: k });
    return;
  }

  const mesa = latest.mesa;
  const round = latest.round;
  const now = Date.now();

  const deadlineMs = streamDeadlineMsForMesa(mesa);
  const elapsed = now - latest.signalAt;

  // No STREAM_TIMEOUT hasta cumplir el umbral adaptativo (evita falsos positivos si el timer disparó antes).
  if (elapsed < deadlineMs) {
    const remaining = Math.max(50, deadlineMs - elapsed);
    scheduleStreamResultTimer(k, remaining);
    useValidationStore.getState().pushLog('info', 'stream timeout diferido (elapsed < adaptiveTimeout)', {
      correlationKey: k,
      mesa,
      round,
      elapsed,
      deadlineMs,
      remaining,
    });
    return;
  }

  useValidationStore.getState().removeActiveStreamWait(k);

  const st2 = statsForMesa(mesa);
  const cycle = {
    id: `timeout-${k}-${now}`,
    label: `Mesa ${mesa} | Round ${round}`,
    correlationKey: k,
    mesaKey: String(mesa ?? ''),
    mesa,
    round,
    recommendation: latest.recommendation,
    resultadoLab: null,
    resultadoGpulse: null,
    uiStatus: 'STREAM_INTERRUPTED',
    issues: [
      `STREAM: sin NEW_RESULT en el umbral (${(deadlineMs / 1000).toFixed(0)}s) · elapsed ${(elapsed / 1000).toFixed(1)}s — monitoreo activo`,
    ],
    signalAcceptedAt: latest.signalAt,
    resultReceivedAt: null,
    labEmittedAt: now,
    delayMsLab: null,
    delayTotalLabMs: null,
    actualDelayMs: null,
    delayMsStream: null,
    middlewareCorrectedRound: false,
    timeoutKind: 'STREAM',
    expectedDelay: deadlineMs,
    realElapsed: elapsed,
    avgDelay: st2.avgDelay,
    maxObserved: st2.maxObserved,
  };

  useValidationStore.getState().prependCycle(cycle);
  useValidationStore.getState().pushLog('warn', 'stream cycle interrupted (sin NEW_RESULT en umbral)', {
    correlationKey: k,
    mesa,
    round,
  });

  pushAlert({
    type: ALERT_TYPES.STREAM_INTERRUPTED,
    mesa,
    round,
    message:
      'La mesa no ha emitido resultado en el tiempo esperado…\nDetectando posible pausa del proveedor…\nContinuamos monitoreando…',
    severity: 'info',
    rawPayload: {
      correlationKey: k,
      mesa,
      round,
      kind: 'STREAM_INTERRUPTED',
      expectedDelay: deadlineMs,
      realElapsed: elapsed,
      avgDelay: st2.avgDelay,
      maxObserved: st2.maxObserved,
      samples: st2.count,
    },
    context: { correlationKey: k, signalExists: true, resultExists: false },
  });
}

function scheduleStreamResultTimer(k, timeoutMs) {
  clearStreamResultTimer(k);
  const latest = streamByKey.get(k);
  const ms = typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : streamDeadlineMsForMesa(latest?.mesa);
  const t = setTimeout(() => {
    streamResultWaitTimers.delete(k);
    handleStreamCycleTimeout(k);
  }, ms);
  streamResultWaitTimers.set(k, t);
}

function strWin(v) {
  if (v == null) return '';
  return String(v).trim().toUpperCase();
}

/** Fila stream abierta (sin resultado) para la misma mesa; desempata por señal más reciente. */
function findOpenStreamRowForMesa(mesa) {
  if (mesa == null) return null;
  const m = String(mesa);
  let best = null;
  for (const [key, row] of streamByKey.entries()) {
    if (String(row.mesa) !== m || row.resultAt != null) continue;
    if (!best || row.signalAt > best.row.signalAt) best = { key, row };
  }
  return best;
}

export let validationEnabled = true;

export function setValidationEnabled(value) {
  validationEnabled = Boolean(value);
}

/**
 * Estado stream (misma correlationKey) para alertas / UI.
 * @param {string | null | undefined} correlationKey
 */
export function streamPairStatusForKey(correlationKey) {
  if (correlationKey == null || String(correlationKey).trim() === '') {
    return { signalExists: false, resultExists: false };
  }
  const row = streamByKey.get(String(correlationKey).trim());
  if (!row) return { signalExists: false, resultExists: false };
  return {
    signalExists: true,
    resultExists: row.resultAt != null,
  };
}

/**
 * Stream observado (mismo socket NEW_SIGNAL / NEW_RESULT, sin pasar por middleware).
 * @param {Record<string, unknown> | null} normalized
 */
export function recordStreamSignal(normalized, meta) {
  if (!validationEnabled || normalized == null) return;
  pruneStreamMap();
  const mesa = normalized.mesa;
  const round = normalized.round != null ? String(normalized.round) : '';
  const k =
    normalizeCorrelationKey(
      normalized.correlationKey != null && String(normalized.correlationKey).trim() !== ''
        ? String(normalized.correlationKey).trim()
        : null,
      mesa,
      round !== '' ? round : null,
    ) ?? correlationKeyFrom(mesa, round);
  const row = {
    mesa,
    round,
    recommendation: normalized.recommendation,
    signalAt: Date.now(),
    correlationKey: k,
    syncSource: null,
  };
  if (meta?.syncSource === 'bootstrap') row.syncSource = 'bootstrap';
  streamByKey.set(k, row);
  if (row.syncSource !== 'bootstrap') {
    scheduleStreamResultTimer(k, streamDeadlineMsForMesa(mesa));
    scheduleDelayExpectedHint(k);
    useValidationStore.getState().syncActiveStreamWait(k, row.signalAt);
  }
  useValidationStore.getState().pushLog('info', 'stream · NEW_SIGNAL', { correlationKey: k, mesa, round });
}

/**
 * @param {Record<string, unknown> | null} normalized
 */
/**
 * @param {Record<string, unknown> | null} normalized
 * @param {unknown} [rawEnvelope] — payload crudo del socket (forense alertas)
 */
export function recordStreamResult(normalized, rawEnvelope, meta) {
  if (!validationEnabled || normalized == null) return;
  pruneStreamMap();
  const mesa = normalized.mesa;
  const round = normalized.round != null ? String(normalized.round) : '';
  const k =
    normalizeCorrelationKey(
      normalized.correlationKey != null && String(normalized.correlationKey).trim() !== ''
        ? String(normalized.correlationKey).trim()
        : null,
      mesa,
      round !== '' ? round : null,
    ) ?? correlationKeyFrom(mesa ?? '', round);
  const ganador = normalized.ganador ?? null;
  const now = Date.now();
  const syncSource =
    meta?.syncSource === 'bootstrap' || (rawEnvelope && typeof rawEnvelope === 'object' && rawEnvelope._syncSource === 'bootstrap')
      ? 'bootstrap'
      : null;
  const isResynced = wasGpulseLabAutoResyncedRecently(mesa, round);

  function settleStreamRow(settleKey, row) {
    clearStreamResultTimer(settleKey);
    useValidationStore.getState().removeActiveStreamWait(settleKey);
    row.ganador = ganador;
    row.resultAt = now;
    const delayMs = row.resultAt - row.signalAt;
    recordStreamDelayForMesa(row.mesa, delayMs);
    useValidationStore.getState().pushLog('info', 'stream · NEW_RESULT', {
      correlationKey: settleKey,
      ganador,
      delayMsStream: delayMs,
    });
  }

  let row = streamByKey.get(k);
  let settleKey = k;

  if (!row) {
    const byMesa = findOpenStreamRowForMesa(mesa);
    if (byMesa) {
      row = byMesa.row;
      settleKey = byMesa.key;
      console.warn('[validation] result matched using active signal fallback');
      settleStreamRow(settleKey, row);
      return;
    }

    const activeSig = mesa != null && String(mesa).trim() !== '' ? getActiveLabSignalPayloadForMesa(String(mesa)) : null;
    if (activeSig != null) {
      const kAlt =
        normalizeCorrelationKey(
          activeSig.correlationKey != null && String(activeSig.correlationKey).trim() !== ''
            ? String(activeSig.correlationKey).trim()
            : null,
          activeSig.mesa ?? mesa ?? '',
          activeSig.round != null && String(activeSig.round).trim() !== ''
            ? String(activeSig.round)
            : null,
        ) ??
        correlationKeyFrom(
          activeSig.mesa ?? mesa ?? '',
          activeSig.round != null ? String(activeSig.round) : '',
        );
      const rowAlt = streamByKey.get(kAlt);
      if (rowAlt) {
        row = rowAlt;
        settleKey = kAlt;
        console.warn('[validation] result matched using active signal fallback');
        settleStreamRow(settleKey, row);
        return;
      }
      console.warn('[validation] result matched using active signal fallback');
      useValidationStore.getState().pushLog('info', 'stream · NEW_RESULT (sin fila stream; señal activa en lab)', {
        mesa,
        kTried: k,
        kAlt,
        ganador,
      });
      return;
    }
  }

  if (row) {
    if (syncSource === 'bootstrap' && (row.syncSource == null || row.syncSource === 'bootstrap')) {
      row.syncSource = 'bootstrap';
    }
    settleStreamRow(settleKey, row);
    return;
  }

  if (syncSource === 'bootstrap') {
    useValidationStore.getState().pushLog('info', 'stream · NEW_RESULT (bootstrap, sin fila)', { correlationKey: k, mesa, round, ganador });
    return;
  }

  pushAlert({
    type: ALERT_TYPES.RESULTADO_SIN_SEÑAL,
    mesa,
    round,
    message: 'Stream: resultado sin señal previa (misma correlationKey)',
    severity: isResynced ? 'info' : 'warning',
    rawPayload: rawEnvelope ?? normalized,
    context: {
      correlationKey: k,
      signalExists: false,
      resultExists: true,
    },
  });
  useValidationStore.getState().pushLog(isResynced ? 'info' : 'warn', 'stream · resultado sin señal previa', {
    correlationKey: k,
    ganador,
    resynced: isResynced,
  });
}

/**
 * @param {{
 *   correlationKey: string,
 *   mesa: unknown,
 *   round: string,
 *   recommendation: unknown,
 *   resultadoLab: unknown,
 *   signalAcceptedAt: number,
 *   resultReceivedAt: number,
 *   labEmittedAt: number,
 *   middlewareCorrectedRound: boolean,
 *   streamRoundBeforeCorrection: string | null,
 *   mesaKey?: string,
 *   syncSource?: 'bootstrap',
 *   resyncApplied?: boolean,
 *   resyncDebug?: {
 *     originalSignalKey: string | null,
 *     resultKeyFromPayload: string,
 *     syntheticSignalKey: string,
 *     resolvedKeyAfterMiddleware: string,
 *   },
 *   resyncQuality?: 'HIGH' | 'MEDIUM' | 'LOW',
 * }} meta
 */
export function recordLabCycleEnd(meta) {
  if (!validationEnabled) return;

  const stream = streamByKey.get(meta.correlationKey);
  const resultadoGpulse = stream?.ganador ?? null;
  const resultadoLab = meta.resultadoLab ?? null;

  const syncSource = stream?.syncSource ?? null;
  const isBootstrap = syncSource === 'bootstrap' || meta?.syncSource === 'bootstrap';
  /** Prefer flag from middleware (TTL-safe); fallback a ventana corta por si el delay del lab supera el TTL. */
  const isResynced =
    Boolean(meta.resyncApplied) || wasGpulseLabAutoResyncedRecently(meta.mesa, meta.round, 12_000);

  const issues = [];
  let uiStatus = 'COMPLETE';
  /** @type {'STREAM_MISSING_RESULT' | 'DATA_INCONSISTENCY' | null} */
  let failureType = null;

  if (!stream) {
    if (!isResynced) {
      issues.push('sin par en stream (misma correlationKey)');
      uiStatus = 'INCOMPLETE';
    } else {
      uiStatus = 'COMPLETE_RESYNC';
    }
  } else if (stream.resultAt == null) {
    issues.push('señal en stream sin resultado aún');
    uiStatus = 'INCOMPLETE_NO_RESULT';
    failureType = 'STREAM_MISSING_RESULT';
  }

  if (stream?.signalAt != null && stream?.resultAt != null) {
    const dStream = stream.resultAt - stream.signalAt;
    if (dStream < 0) issues.push('delay stream negativo');
    if (dStream > STREAM_DELAY_WARN_MAX_MS) issues.push('delay stream muy alto');
  }

  const skipLabTimeoutForHiddenDoc = typeof document !== 'undefined' && Boolean(document.hidden);

  const realDelayMs = meta.resultReceivedAt - meta.signalAcceptedAt;
  const adaptiveThresholdMs = streamDeadlineMsForMesa(meta.mesa);

  let realDelayExceedsAdaptive = false;
  if (!isBootstrap) {
    realDelayExceedsAdaptive =
      !skipLabTimeoutForHiddenDoc &&
      Number.isFinite(realDelayMs) &&
      Number.isFinite(adaptiveThresholdMs) &&
      realDelayMs > adaptiveThresholdMs;

    if (realDelayExceedsAdaptive) {
      issues.push(
        `tiempo real señal→resultado (${Math.round(realDelayMs)}ms) supera umbral adaptativo (${Math.round(adaptiveThresholdMs)}ms)`,
      );
      if (uiStatus === 'COMPLETE') uiStatus = 'INCOMPLETE';
    }
  }

  if (meta.middlewareCorrectedRound) {
    issues.push(`round corregido por middleware (stream: ${meta.streamRoundBeforeCorrection ?? '—'} → lab: ${meta.round})`);
    useValidationStore.getState().pushLog('info', 'middleware corrigió round', {
      correlationKey: meta.correlationKey,
      from: meta.streamRoundBeforeCorrection,
      to: meta.round,
    });
  }

  if (stream && stream.resultAt != null && resultadoGpulse != null && resultadoLab != null) {
    if (strWin(resultadoGpulse) !== strWin(resultadoLab)) {
      issues.push('ganador Lab ≠ stream');
      uiStatus = 'ERROR';
      failureType = 'DATA_INCONSISTENCY';
    }
  }

  if (stream && meta.round != null && stream.round != null && String(stream.round) !== String(meta.round)) {
    issues.push('desfase round stream vs lab');
    if (uiStatus === 'COMPLETE') uiStatus = 'ERROR';
    if (uiStatus === 'ERROR') failureType = 'DATA_INCONSISTENCY';
  }

  const delayMsLab = meta.resultReceivedAt - meta.signalAcceptedAt;
  const delayTotalLabMs = meta.labEmittedAt - meta.signalAcceptedAt;

  const labTimeout = Boolean(realDelayExceedsAdaptive);

  if (isBootstrap) {
    // Hydration snapshot: ignore anomalies.
    uiStatus = 'COMPLETE';
  }
  if (isResynced) {
    // Auto-resync recovered the cycle; treat as valid.
    uiStatus = 'COMPLETE_RESYNC';
    // If resync resolved the cycle, don't keep stream-pair issues that would mislead operators.
    const idx = issues.indexOf('sin par en stream (misma correlationKey)');
    if (idx >= 0) issues.splice(idx, 1);
  }

  const cycleMetaResync = isResynced
    ? {
        resolvedBy: 'middleware',
        source: meta.resyncApplied ? 'autoResync' : 'recentFlag',
        ...(meta.resyncDebug != null && typeof meta.resyncDebug === 'object' ? meta.resyncDebug : {}),
        ...(meta.resyncApplied && meta.resyncQuality != null ? { resyncQuality: meta.resyncQuality } : {}),
      }
    : null;

  const cycle = {
    id: `${meta.correlationKey}-${meta.labEmittedAt}`,
    label: `Mesa ${meta.mesa} | Round ${meta.round}`,
    correlationKey: meta.correlationKey,
    mesaKey: meta.mesaKey != null ? String(meta.mesaKey) : String(meta.mesa ?? ''),
    mesa: meta.mesa,
    round: meta.round,
    recommendation: meta.recommendation,
    resultadoLab,
    resultadoGpulse,
    uiStatus,
    failureType,
    issues,
    syncSource,
    cycleMeta: cycleMetaResync,
    signalAcceptedAt: meta.signalAcceptedAt,
    resultReceivedAt: meta.resultReceivedAt,
    labEmittedAt: meta.labEmittedAt,
    delayMsLab,
    delayTotalLabMs,
    actualDelayMs: Number.isFinite(realDelayMs) ? realDelayMs : null,
    adaptiveThresholdMs: Number.isFinite(adaptiveThresholdMs) ? adaptiveThresholdMs : null,
    delayMsStream: stream?.resultAt != null && stream?.signalAt != null ? stream.resultAt - stream.signalAt : null,
    middlewareCorrectedRound: meta.middlewareCorrectedRound,
    labTimeout,
  };

  useValidationStore.getState().prependCycle(cycle);
  if (!isBootstrap) {
    try {
      recordControlCenterCycleEnd(meta, cycle);
    } catch (e) {
      console.warn('[gpulse-lab] control center telemetry', e);
    }
  }
  useValidationStore.getState().pushLog(uiStatus === 'ERROR' ? 'error' : 'info', 'ciclo lab cerrado', {
    correlationKey: meta.correlationKey,
    mesaKey: meta.mesaKey ?? meta.mesa,
    uiStatus,
    tiempoSignalAResultadoMs: delayMsLab,
    middlewareCorrigió: meta.middlewareCorrectedRound,
    resynced: isResynced,
    syncSource,
    ...(meta.resyncApplied && meta.resyncQuality != null ? { resyncQuality: meta.resyncQuality } : {}),
  });

  if (meta.middlewareCorrectedRound) {
    pushAlert({
      type: ALERT_TYPES.ROUND_CORREGIDO,
      mesa: meta.mesa,
      round: meta.round,
      message: `Round alineado al activo: ${meta.streamRoundBeforeCorrection ?? '—'} → ${meta.round}`,
      severity: 'info',
      rawPayload: meta,
      context: { correlationKey: meta.correlationKey },
    });
  }
  if (!isBootstrap && meta.resyncApplied) {
    const q = meta.resyncQuality ?? 'MEDIUM';
    const pres = resyncQualityPresentation(q);
    pushAlert({
      type: ALERT_TYPES.CICLO_RECUPERADO,
      mesa: meta.mesa,
      round: meta.round,
      message: `El ciclo fue reconstruido automáticamente a partir del resultado\n🧠 [CALIDAD DE RECUPERACION]\n${pres.emoji} ${q} · ${pres.line}`,
      severity: 'info',
      rawPayload: {
        meta,
        resyncDebug: meta.resyncDebug ?? null,
        resyncQuality: q,
        correlationKey: meta.correlationKey,
      },
      context: { correlationKey: meta.correlationKey },
    });
  }
  if (!isBootstrap && failureType === 'STREAM_MISSING_RESULT') {
    useMetricsStore.getState().bumpMissingResult();
    pushAlert({
      type: ALERT_TYPES.STREAM_MISSING_RESULT,
      mesa: meta.mesa,
      round: meta.round,
      message: 'Proveedor no emitió resultado para la señal recibida',
      severity: 'warning',
      rawPayload: { meta, issues, uiStatus, failureType },
      context: { correlationKey: meta.correlationKey, signalExists: true, resultExists: false },
    });
  }
  if (!isBootstrap && labTimeout) {
    const sec = (ms) => (typeof ms === 'number' ? `${(ms / 1000).toFixed(1)}s` : '—');
    pushAlert({
      type: ALERT_TYPES.DELAY_FUERA_DE_RANGO,
      mesa: meta.mesa,
      round: meta.round,
      message: `Tiempo real señal→resultado excedido: ${sec(realDelayMs)} (umbral ${sec(adaptiveThresholdMs)})`,
      severity: realDelayMs > adaptiveThresholdMs * 1.5 ? 'error' : 'warning',
      rawPayload: {
        signalAcceptedAt: meta.signalAcceptedAt,
        resultReceivedAt: meta.resultReceivedAt,
        actualDelayMs: realDelayMs,
        adaptiveThresholdMs,
      },
      context: { correlationKey: meta.correlationKey },
    });
  }
  if (!isBootstrap && uiStatus === 'INCOMPLETE' && issues.length > 0 && !isResynced) {
    const delayOnly =
      issues.length === 1 &&
      typeof issues[0] === 'string' &&
      issues[0].includes('tiempo real señal→resultado');
    if (!delayOnly) {
      pushAlert({
        type: ALERT_TYPES.CICLO_INCOMPLETO,
        mesa: meta.mesa,
        round: meta.round,
        message: issues.join(' · '),
        severity: 'warning',
        rawPayload: { meta, issues, uiStatus },
        context: { correlationKey: meta.correlationKey },
      });
    }
  }
  if (!isBootstrap && uiStatus === 'ERROR') {
    if (failureType === 'DATA_INCONSISTENCY') {
      pushAlert({
        type: ALERT_TYPES.DATA_INCONSISTENCY,
        mesa: meta.mesa,
        round: meta.round,
        message: 'Datos inconsistentes entre Lab y stream (mismo cycle)',
        severity: 'error',
        rawPayload: { meta, issues, uiStatus, failureType, resultadoLab, resultadoGpulse },
        context: { correlationKey: meta.correlationKey, signalExists: true, resultExists: true },
      });
    } else {
      pushAlert({
        type: ALERT_TYPES.CICLO_INCOMPLETO,
        mesa: meta.mesa,
        round: meta.round,
        message: issues.length > 0 ? issues.join(' · ') : 'Ciclo con error de validación',
        severity: 'error',
        rawPayload: { meta, issues, uiStatus },
        context: { correlationKey: meta.correlationKey },
      });
    }
  }

  recordGpulseLabCycleMetrics(
    uiStatus === 'COMPLETE_RESYNC' ? 'COMPLETE' : uiStatus === 'INCOMPLETE_NO_RESULT' ? 'INCOMPLETE' : uiStatus,
    delayMsLab,
  );
}

export function logValidationBlocked(kind, detail) {
  pushAlert({
    type: kind === 'signal' ? ALERT_TYPES.SEÑAL_BLOQUEADA : ALERT_TYPES.CICLO_INCOMPLETO,
    mesa: detail?.mesa,
    round: detail?.round,
    message:
      kind === 'signal'
        ? 'Señal bloqueada: la mesa ya tiene un ciclo abierto'
        : 'Resultado bloqueado: hay una emisión pendiente para esta mesa',
    severity: 'warning',
    rawPayload: detail,
    context: {
      correlationKey: detail?.correlationKey != null ? String(detail.correlationKey) : null,
    },
  });
  if (!validationEnabled) return;
  useValidationStore.getState().pushLog('warn', kind === 'signal' ? 'señal bloqueada' : 'resultado bloqueado', detail);
}

export function logValidationAnomaly(message, detail) {
  pushAlert({
    type: ALERT_TYPES.RESULTADO_SIN_SEÑAL,
    mesa: detail?.mesa,
    round: detail?.round,
    message: typeof message === 'string' ? message : 'Anomalía de validación',
    severity: 'error',
    rawPayload: detail,
    context: {
      correlationKey: detail?.correlationKey != null ? String(detail.correlationKey) : null,
    },
  });
  if (!validationEnabled) return;
  useValidationStore.getState().pushLog('warn', message, detail);
}

export const useValidationStore = create((set) => ({
  cycles: [],
  logs: [],
  /** correlationKey → signalAt (stream esperando NEW_RESULT). Solo UI / countdown. */
  activeStreamWaits: /** @type {Record<string, { signalAt: number }>} */ ({}),

  syncActiveStreamWait(k, signalAt) {
    set((s) => ({
      activeStreamWaits: { ...s.activeStreamWaits, [k]: { signalAt } },
    }));
  },

  removeActiveStreamWait(k) {
    set((s) => {
      if (!(k in s.activeStreamWaits)) return s;
      const next = { ...s.activeStreamWaits };
      delete next[k];
      return { activeStreamWaits: next };
    });
  },

  prependCycle(cycle) {
    set((s) => ({
      cycles: [cycle, ...s.cycles].slice(0, MAX_CYCLES),
    }));
  },

  pushLog(level, message, meta) {
    const entry = { ts: Date.now(), level, message, meta };
    set((s) => ({
      logs: [...s.logs, entry].slice(-MAX_LOGS),
    }));
    const tag =
      level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
    gpulseLabLog.debug(`[Validation Engine] ${tag}`, message, meta ?? '');
  },

  clear() {
    for (const k of streamResultWaitTimers.keys()) {
      clearStreamResultTimer(k);
    }
    streamByKey.clear();
    set({ cycles: [], logs: [], activeStreamWaits: {} });
  },
}));
