import { createInitialState, reduce } from './executionEngine.js';
import {
  isGpulseFlickerForensicEnabled,
  logEngineForensicEvent,
  logEngineForensicState,
  recordEngineProcess,
  resetEngineForensicProcessCounts,
} from './engineDeterministicForensic.js';
import { labApplyResult, labApplySignal } from '../middleware/useSignalMiddleware.js';
import { extractContadorMartingalaFromResultPayload } from '../utils/supplierIntelExtract.js';
import { clampArrayToMaxSteps, clampProviderMartingaleVectors } from '../utils/clampProviderMartingaleVectors.js';
import {
  buildNewResultBaseFingerprint,
  buildNewResultFingerprint,
  resolveResultTemporalId,
} from '../utils/newResultFingerprint.js';
import {
  getEngine,
  removeEngine,
  setEngine,
  useExecutionEngineStore,
} from '../store/useExecutionEngineStore.js';

function clearEngineMapAndIndex() {
  useExecutionEngineStore.setState({
    engineMap: {},
    engineIndex: {
      RUNNING: new Set(),
      SUCCESS: new Set(),
      FAILED: new Set(),
    },
  });
}
import { useExecutionReplayStore } from '../store/useExecutionReplayStore.js';

/** @param {unknown} input */
function forensicEventSnapshot(input) {
  if (input == null || typeof input !== 'object') return input;
  const o = /** @type {Record<string, unknown>} */ (input);
  if (o.type === 'NEW_SIGNAL') {
    const n = o.normalized;
    const norm = n != null && typeof n === 'object' ? /** @type {Record<string, unknown>} */ (n) : {};
    return {
      type: 'NEW_SIGNAL',
      correlationKey: norm.correlationKey,
      mesa: norm.mesa,
      round: norm.round,
    };
  }
  if (o.type === 'NEW_RESULT') {
    const n = o.normalized;
    const norm = n != null && typeof n === 'object' ? /** @type {Record<string, unknown>} */ (n) : {};
    return {
      type: 'NEW_RESULT',
      correlationKey: norm.correlationKey,
      ganador: norm.ganador,
    };
  }
  return { type: o.type };
}

/** Dedupe por huella base; conserva último temporal por correlación. */
/** @type {Map<string, { baseFingerprint: string; temporalId: string }>} */
const lastResultDedupeByCk = new Map();

/** SUCCESS: keep short audit window; FAILED: drop faster to limit memory. */
const TERMINAL_CLEANUP_MS = {
  SUCCESS: 30_000,
  FAILED: 10_000,
};

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const terminalCleanupTimers = new Map();

/** Opt-in: `VITE_GPULSE_PHASE1_TEST=1` — verbose NEW_SIGNAL / engine creation traces. */
function isPhase1EngineTestEnabled() {
  return import.meta.env.VITE_GPULSE_PHASE1_TEST === '1';
}

/** Opt-in: `VITE_GPULSE_PHASE2_TEST=1` — verbose NEW_RESULT / engine update traces. */
function isPhase2EngineTestEnabled() {
  return import.meta.env.VITE_GPULSE_PHASE2_TEST === '1';
}

/** Opt-in: `VITE_GPULSE_PHASE3_TEST=1` — NEW_RESULT dedupe check traces. */
function isPhase3EngineTestEnabled() {
  return import.meta.env.VITE_GPULSE_PHASE3_TEST === '1';
}

/** @param {string} ck */
function cancelTerminalCleanup(ck) {
  const t = terminalCleanupTimers.get(ck);
  if (t != null) clearTimeout(t);
  terminalCleanupTimers.delete(ck);
}

/** @param {string} ck */
function logEngineCleanupTrace(ck) {
  if (!isGpulseFlickerForensicEnabled()) return;
  const engine = getEngine(ck);
  const h = engine?.history;
  const last = Array.isArray(h) && h.length > 0 ? h[h.length - 1] : undefined;
  console.log('ENGINE CLEANUP', {
    correlationKey: ck,
    status: engine?.status,
    step: engine?.currentStep,
    historyLength: engine?.history?.length,
    lastResult: last?.result,
    lastPrediction: last?.prediction,
    outcome: last?.status,
  });
}

/**
 * Remove terminal engine from the map after a status-specific TTL (UI already rendered).
 * @param {string} ck
 * @param {'SUCCESS' | 'FAILED'} status
 */
function scheduleTerminalCleanup(ck, status) {
  cancelTerminalCleanup(ck);
  const delayMs =
    status === 'FAILED' ? TERMINAL_CLEANUP_MS.FAILED : TERMINAL_CLEANUP_MS.SUCCESS;
  const t = setTimeout(() => {
    logEngineCleanupTrace(ck);
    removeEngine(ck);
    terminalCleanupTimers.delete(ck);
    lastResultDedupeByCk.delete(ck);
  }, delayMs);
  terminalCleanupTimers.set(ck, t);
}

/**
 * Única entrada: motor de ejecución (reduce + store) + lab (`labApply*` una vez).
 *
 * @param {{ type: 'NEW_SIGNAL', normalized: Record<string, unknown>, rawPayload?: unknown, vectorForecast?: unknown[] } | { type: 'NEW_RESULT', normalized: Record<string, unknown> }} input
 */
export function dispatchToEngine(input) {
  if (input == null || typeof input !== 'object') return;

  logEngineForensicEvent(forensicEventSnapshot(input));

  if (input.type === 'NEW_SIGNAL') {
    const { normalized, rawPayload, vectorForecast } = input;
    if (normalized == null || typeof normalized !== 'object') return;
    const ck = normalized.correlationKey;
    if (ck == null || String(ck).trim() === '') return;

    const ckStr = String(ck).trim();

    let vf = Array.isArray(vectorForecast) && vectorForecast.length > 0
      ? vectorForecast
      : Array.isArray(normalized.vector_forecast) && normalized.vector_forecast.length > 0
        ? normalized.vector_forecast
        : normalized.recommendation
          ? [normalized.recommendation]
          : [];
    vf = clampArrayToMaxSteps(vf);

    const prev = getEngine(ckStr) ?? createInitialState();
    const signalPayload = {
      correlationKey: ckStr,
      mesa: normalized.mesa,
      round: normalized.round,
      vector_forecast: vf,
      martingale: normalized.martingale,
      contador_martingala: normalized.contador_martingala,
    };

    const next = reduce(prev, {
      type: 'NEW_SIGNAL',
      payload: signalPayload,
    });
    if (next === prev) return;

    if (isPhase1EngineTestEnabled()) {
      console.log('TEST PHASE 1 - SIGNAL RECEIVED', signalPayload);
    }

    cancelTerminalCleanup(ckStr);
    lastResultDedupeByCk.delete(ckStr);
    resetEngineForensicProcessCounts();

    setEngine(ckStr, next);
    if (isPhase1EngineTestEnabled()) {
      const v = next.vector;
      console.log('ENGINE CREATED', {
        correlationKey: ckStr,
        status: next.status,
        step: next.currentStep,
        prediction: next.prediction,
        vectorLength: Array.isArray(v) ? v.length : 0,
      });
    }
    logEngineForensicState(next);
    recordEngineProcess(`NEW_SIGNAL:${ckStr}`, ckStr);

    useExecutionReplayStore.getState().startCycle(ckStr, {
      type: 'NEW_SIGNAL',
      payload: {
        correlationKey: ckStr,
        mesa: normalized.mesa,
        round: normalized.round,
        vector_forecast: vf,
        martingale: normalized.martingale,
        contador_martingala: normalized.contador_martingala,
      },
    });

    labApplySignal(normalized, rawPayload);
    return;
  }

  if (input.type === 'NEW_RESULT') {
    const { normalized } = input;
    if (normalized == null || typeof normalized !== 'object') return;
    const ck = normalized.correlationKey;
    if (ck == null || String(ck).trim() === '') return;

    const cv = clampProviderMartingaleVectors({
      vector_forecast: normalized.vector_forecast,
      vector_resultado: normalized.vector_resultado,
      vector_win: normalized.vector_win,
    });
    const merged = {
      ...normalized,
      ...(cv.vector_resultado !== undefined ? { vector_resultado: cv.vector_resultado } : {}),
      ...(cv.vector_win !== undefined ? { vector_win: cv.vector_win } : {}),
      ...(cv.vector_forecast.length > 0 ? { vector_forecast: cv.vector_forecast } : {}),
    };

    const ckStr = String(ck).trim();
    const prev = getEngine(ckStr);
    if (prev == null) return;

    const ganador = merged.ganador;
    const mergedRec = /** @type {Record<string, unknown>} */ (merged);
    const baseFp = buildNewResultBaseFingerprint(mergedRec, { fallbackContador: prev.currentStep });
    const temporalId = resolveResultTemporalId(mergedRec);
    const fullFingerprint = buildNewResultFingerprint(mergedRec, { fallbackContador: prev.currentStep });

    if (isPhase3EngineTestEnabled()) {
      const prevDedupe = lastResultDedupeByCk.get(ckStr);
      console.log('DEDUP CHECK', {
        baseFingerprint: baseFp,
        temporalId,
        prevBase: prevDedupe?.baseFingerprint,
        prevTemporal: prevDedupe?.temporalId,
        skipDuplicate: baseFp !== '' && prevDedupe?.baseFingerprint === baseFp,
      });
    }

    const prevDedupe = lastResultDedupeByCk.get(ckStr);
    if (baseFp !== '' && prevDedupe?.baseFingerprint === baseFp) {
      lastResultDedupeByCk.set(ckStr, { baseFingerprint: baseFp, temporalId });
      return;
    }

    if (prev.status === 'SUCCESS' || prev.status === 'FAILED') {
      labApplyResult(merged);
      logEngineForensicState(useExecutionEngineStore.getState().engineMap[ckStr] ?? prev);
      recordEngineProcess(`NEW_RESULT:terminal:${ckStr}`, ckStr);
      lastResultDedupeByCk.set(ckStr, { baseFingerprint: baseFp, temporalId });
      return;
    }

    const contadorFromPayload =
      extractContadorMartingalaFromResultPayload(merged, {
        fallbackVectorResultado: Array.isArray(merged.vector_resultado) ? merged.vector_resultado : undefined,
      }) ?? merged.contador_martingala;

    const resultPayload = {
      correlationKey: ckStr,
      ganador,
      ...(contadorFromPayload !== undefined && contadorFromPayload !== null
        ? { contador_martingala: contadorFromPayload }
        : {}),
      vector_win: Array.isArray(merged.vector_win) ? merged.vector_win : undefined,
    };

    const next = reduce(prev, {
      type: 'NEW_RESULT',
      payload: resultPayload,
    });
    if (next === prev) return;

    if (isPhase2EngineTestEnabled()) {
      console.log('TEST PHASE 2 - RESULT RECEIVED', resultPayload);
    }

    setEngine(ckStr, next);
    if (isPhase2EngineTestEnabled()) {
      const engine = getEngine(ckStr);
      const h = engine?.history;
      const last = Array.isArray(h) && h.length > 0 ? h[h.length - 1] : undefined;
      console.log('ENGINE AFTER RESULT', {
        correlationKey: ckStr,
        status: engine?.status,
        step: engine?.currentStep,
        prediction: engine?.prediction,
        lastDecision: {
          prediction: last?.prediction,
          result: last?.result,
          outcome: last?.status,
        },
      });
    }
    logEngineForensicState(next);
    lastResultDedupeByCk.set(ckStr, { baseFingerprint: baseFp, temporalId });

    labApplyResult(merged);
    recordEngineProcess(fullFingerprint, ckStr);

    if (next.status === 'SUCCESS' || next.status === 'FAILED') {
      scheduleTerminalCleanup(ckStr, next.status);
    }

    useExecutionReplayStore.getState().appendEvent(ckStr, {
      type: 'NEW_RESULT',
      payload: {
        correlationKey: ckStr,
        ganador,
        ...(contadorFromPayload !== undefined && contadorFromPayload !== null
          ? { contador_martingala: contadorFromPayload }
          : {}),
      },
    });
  }
}

/**
 * Compat: mismo efecto que antes — delega en `dispatchToEngine` (un solo flujo).
 * @param {Record<string, unknown>} payload
 * @param {unknown} [rawPayload]
 */
export function handleSignal(payload, rawPayload) {
  dispatchToEngine({ type: 'NEW_SIGNAL', normalized: payload, rawPayload });
}

/**
 * @param {Record<string, unknown>} payload
 */
export function handleResult(payload) {
  dispatchToEngine({ type: 'NEW_RESULT', normalized: payload });
}

/**
 * @param {{ type: 'NEW_SIGNAL' | 'NEW_RESULT', payload: Record<string, unknown>, rawPayload?: unknown }} event
 */
export function useSignalMiddleware(event) {
  if (event?.type === 'NEW_SIGNAL') {
    dispatchToEngine({ type: 'NEW_SIGNAL', normalized: event.payload, rawPayload: event.rawPayload });
  } else if (event?.type === 'NEW_RESULT') {
    dispatchToEngine({ type: 'NEW_RESULT', normalized: event.payload });
  }
}

export function resetExecutionEngineDispatchDedupe() {
  lastResultDedupeByCk.clear();
  for (const t of terminalCleanupTimers.values()) clearTimeout(t);
  terminalCleanupTimers.clear();
  resetEngineForensicProcessCounts();
}

export function resetExecutionEngineToIdle() {
  resetExecutionEngineDispatchDedupe();
  clearEngineMapAndIndex();
}
