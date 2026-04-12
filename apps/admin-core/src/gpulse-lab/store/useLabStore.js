import { create } from 'zustand';
import {
  extractContadorMartingalaFromResultPayload,
  extractMesaKeyFromRaw,
  extractNestedMesaInfo,
  extractNestedSignal,
  mergeMesaInfoProgressive,
} from '../utils/supplierIntelExtract.js';
import { deriveMirrorLifecycleFromMesaRow } from '../utils/vistaLabsMirror.js';
import { getMartingaleLabel } from '../utils/martingaleUi.js';
import { winStatusFromVectorWinLastArray } from '../../utils/forecastMartingaleStep.js';
import { buildNewResultBaseFingerprint, resolveResultTemporalId } from '../utils/newResultFingerprint.js';

export const LAB_LIFECYCLE_STATES = {
  IDLE: 'IDLE',
  WARMUP: 'WARMUP',
  WAITING_SIGNAL: 'WAITING_SIGNAL',
  SIGNAL_DETECTED: 'SIGNAL_DETECTED',
  BETTING_PHASE: 'BETTING_PHASE',
  BETTING_CLOSED: 'BETTING_CLOSED',
  WAITING_RESULT: 'WAITING_RESULT',
  /** NEW_RESULT no llegó en el umbral stream; el lab sigue monitoreando (sin reset forzado). */
  STREAM_INTERRUPTED: 'STREAM_INTERRUPTED',
  RESULT_RECEIVED: 'RESULT_RECEIVED',
  CYCLE_COMPLETE: 'CYCLE_COMPLETE',
};

export const LAB_LIFECYCLE_LABELS = {
  [LAB_LIFECYCLE_STATES.IDLE]: 'ANALYZING...',
  [LAB_LIFECYCLE_STATES.WARMUP]: 'ANALYZING...',
  [LAB_LIFECYCLE_STATES.WAITING_SIGNAL]: 'WAITING SIGNAL',
  [LAB_LIFECYCLE_STATES.SIGNAL_DETECTED]: 'SIGNAL DETECTED',
  [LAB_LIFECYCLE_STATES.BETTING_PHASE]: 'BETTING OPEN',
  [LAB_LIFECYCLE_STATES.BETTING_CLOSED]: 'BETTING CLOSED',
  [LAB_LIFECYCLE_STATES.WAITING_RESULT]: 'WAITING RESULT',
  [LAB_LIFECYCLE_STATES.STREAM_INTERRUPTED]: 'STREAM PAUSED',
  [LAB_LIFECYCLE_STATES.RESULT_RECEIVED]: 'RESULT RECEIVED',
  [LAB_LIFECYCLE_STATES.CYCLE_COMPLETE]: 'CYCLE COMPLETE',
};

export function createEmptyMesaState() {
  return {
    round: null,
    recommendation: null,
    martingala: 0,
    /** Contador derivado de NEW_SIGNAL (fallback si NEW_RESULT no trae `contador_martingala`). */
    martingalaSignal: 0,
    /** Nivel de martingala de la última señal (no sobrescrito por resultado). */
    signalMartingaleLevel: null,
    /** Etiqueta VistaLabs (`señal.tipo`) o derivada (`getMartingaleLabel`). */
    martingaleType: null,
    ganador: null,
    estado: 'WAITING',
    historial: [],
    wins: [],
    startTime: null,
    /** Copia del vector del ciclo para recalcular `recommendation` tras NEW_RESULT (paso martingala). */
    vector_forecast: null,
    /** Snapshot proveedor: `NEW_RESULT` → `mesa_info.martingala.vector_resultado` (completo). */
    vector_resultado: null,
    /** Snapshot proveedor: `NEW_RESULT` → `mesa_info.martingala.vector_win` (completo). */
    vector_win: null,
    /** Step-by-step timeline for the active / last completed cycle (GPulse Lab UI). */
    currentCycleHistory: [],
    /** Proveedor: `data.data.signal` (o equivalente). */
    supplierSignalFull: null,
    /** Proveedor: `data.data.results.mesa_info` (o equivalente). */
    supplierMesaInfoFull: null,
    supplierLastRawSignal: null,
    supplierLastRawResult: null,
    intelSignalTs: null,
    intelResultTs: null,
    /** { label: string, at: number, deltaMs: number | null }[] */
    intelStepDurations: [],
    /** Dedupe NEW_RESULT: huella base `correlationKey-contador-vector_win_last` (sin tiempo). */
    lastBaseFingerprint: null,
    /** Última identidad temporal vía {@link resolveResultTemporalId} (trazabilidad). */
    lastTemporalId: null,
    /** Live table analytics (señal→resultado por mesa). */
    mesaAnalytics: {
      lastDelays: /** @type {number[]} */ ([]),
      avgDelayMs: null,
      lastDelayMs: null,
      maxDelayMs: null,
      /** FAST &lt; 20s · NORMAL 20–35s · SLOW &gt; 35s (by avg) */
      speedStatus: null,
      totalCycles: 0,
    },
  };
}

function updateMesaAnalyticsFromDelay(prev, delayMs) {
  if (typeof delayMs !== 'number' || !Number.isFinite(delayMs) || delayMs < 0 || delayMs > 10 * 60 * 1000) return prev?.mesaAnalytics ?? createEmptyMesaState().mesaAnalytics;
  const lastDelays = [...(prev?.mesaAnalytics?.lastDelays ?? []), delayMs].slice(-20);
  const avg = Math.round(lastDelays.reduce((a, b) => a + b, 0) / lastDelays.length);
  const maxD = Math.max(...lastDelays);
  let speedStatus = 'NORMAL';
  if (avg < 20000) speedStatus = 'FAST';
  else if (avg > 35000) speedStatus = 'SLOW';
  return {
    lastDelays,
    avgDelayMs: avg,
    lastDelayMs: delayMs,
    maxDelayMs: maxD,
    speedStatus,
    totalCycles: (prev?.mesaAnalytics?.totalCycles ?? 0) + 1,
  };
}

export function getEffectiveMesaId(mesas, selectedMesaId) {
  const keys = Object.keys(mesas).sort();
  if (keys.length === 0) return null;
  if (selectedMesaId != null && Object.prototype.hasOwnProperty.call(mesas, selectedMesaId)) return selectedMesaId;
  return keys[0];
}

function normalizeAppend(base, incoming) {
  if (incoming == null) return base;
  if (Array.isArray(incoming)) return [...base, ...incoming];
  return [...base, incoming];
}

function mesaKeyFromPayload(payload) {
  if (payload == null || typeof payload !== 'object') return '';
  const m = /** @type {Record<string, unknown>} */ (payload).mesa;
  return m == null || m === '' ? '' : String(m);
}

/** @param {unknown} payload */
function vectorForecastFromPayload(payload) {
  if (payload == null || typeof payload !== 'object') return null;
  const p = /** @type {Record<string, unknown>} */ (payload);
  if (Array.isArray(p.vector_forecast)) return p.vector_forecast;
  const d = p.data;
  if (d != null && typeof d === 'object' && !Array.isArray(d)) {
    const inner = /** @type {Record<string, unknown>} */ (d).data;
    if (inner != null && typeof inner === 'object' && !Array.isArray(inner)) {
      const s2 = inner.signal;
      if (s2 != null && typeof s2 === 'object' && !Array.isArray(s2) && Array.isArray(s2.vector_forecast)) {
        return s2.vector_forecast;
      }
    }
    const s1 = /** @type {Record<string, unknown>} */ (d).signal;
    if (s1 != null && typeof s1 === 'object' && !Array.isArray(s1) && Array.isArray(s1.vector_forecast)) {
      return s1.vector_forecast;
    }
  }
  const root = p.signal;
  if (root != null && typeof root === 'object' && !Array.isArray(root) && Array.isArray(root.vector_forecast)) {
    return root.vector_forecast;
  }
  return null;
}

/** Lifecycle espejo VistaLabs: solo desde datos de mesa efectiva (sin timers). */
function mirrorSliceFromState(mesas, selectedMesaId) {
  const effId = getEffectiveMesaId(mesas, selectedMesaId);
  if (!effId) {
    return {
      lifecycleState: LAB_LIFECYCLE_STATES.WAITING_SIGNAL,
      bettingEndsAt: null,
      signalTs: null,
      cycleStartedAt: null,
    };
  }
  const row = mesas[effId] ?? createEmptyMesaState();
  const lifecycleState = deriveMirrorLifecycleFromMesaRow(row);
  const signalTs = row.intelSignalTs ?? row.startTime ?? null;
  return {
    lifecycleState,
    bettingEndsAt: null,
    signalTs,
    cycleStartedAt: row.startTime ?? null,
  };
}

/**
 * NEW_SIGNAL: `contador_martingala` si viene; si no, `martingale` (0-based) + 1 (misma regla que el motor).
 * @param {Record<string, unknown>} payload
 */
function contadorFromSignalPayload(payload) {
  if (payload?.contador_martingala != null && String(payload.contador_martingala).trim() !== '') {
    return Number(payload.contador_martingala);
  }
  const mg = payload?.martingale;
  if (mg != null && Number.isFinite(Number(mg))) {
    return Number(mg) + 1;
  }
  return 1;
}

export const useLabStore = create((set) => ({
  mesas: {},
  /** Mesa mostrada en paneles centrales */
  selectedMesaId: null,

  /** Lifecycle: controla cuándo aceptar señales/resultados y cómo renderizar el ciclo. */
  lifecycleState: LAB_LIFECYCLE_STATES.IDLE,
  /** Epoch ms: fin de ventana betting (si aplica). */
  bettingEndsAt: null,
  /** Epoch ms: inicio de la señal aceptada (para timeline/UI). */
  cycleStartedAt: null,
  /** Epoch ms: NEW_SIGNAL aceptado (misma referencia que el ciclo activo). */
  signalTs: null,
  /** Provider-sourced timer (seconds) if available. */
  providerRemainingTime: null,
  /** Provider-sourced close timestamp (ms) if available. */
  providerCloseTs: null,

  setSelectedMesaId: (mesaId) =>
    set((state) => {
      const selectedMesaId = mesaId != null ? String(mesaId) : null;
      return { selectedMesaId, ...mirrorSliceFromState(state.mesas, selectedMesaId) };
    }),

  /**
   * Align selected mesa + round so `normalizeCorrelationKey` matches an execution engine (debug / multi-mesa focus).
   * @param {{ mesaId: string, round?: string | null }} p
   */
  focusMesaForEngineView: ({ mesaId, round }) =>
    set((state) => {
      const id = mesaId != null && String(mesaId).trim() !== '' ? String(mesaId).trim() : '';
      if (!id) return state;
      const prev = state.mesas[id] ?? createEmptyMesaState();
      const r =
        round != null && String(round).trim() !== '' ? String(round).trim() : prev.round ?? null;
      const nextRow = {
        ...prev,
        round: r,
        mesa: id,
      };
      const nextMesas = { ...state.mesas, [id]: nextRow };
      return {
        selectedMesaId: id,
        mesas: nextMesas,
        ...mirrorSliceFromState(nextMesas, id),
      };
    }),

  setLifecycleState: (next) =>
    set({
      lifecycleState:
        Object.values(LAB_LIFECYCLE_STATES).includes(next) ? next : LAB_LIFECYCLE_STATES.IDLE,
    }),

  beginWarmup: (ms = 3000) =>
    set(() => {
      const ts = Date.now();
      return {
        lifecycleState: LAB_LIFECYCLE_STATES.WARMUP,
        bettingEndsAt: null,
        cycleStartedAt: ts,
        signalTs: ts,
        warmupEndsAt: ts + Math.max(0, Number(ms) || 0),
        providerRemainingTime: null,
        providerCloseTs: null,
      };
    }),

  /**
   * Limpia estado visual de una mesa para inicio limpio del próximo ciclo.
   * (No tocar middleware/validación; solo UI/store local.)
   */
  resetMesaVisualState: (mesaId) =>
    set((state) => {
      const id = mesaId != null && String(mesaId).trim() !== '' ? String(mesaId).trim() : '';
      if (!id) return state;
      const prev = state.mesas[id] ?? createEmptyMesaState();
      return {
        mesas: {
          ...state.mesas,
          [id]: {
            ...prev,
            round: null,
            recommendation: null,
            martingala: 0,
            martingalaSignal: 0,
            signalMartingaleLevel: null,
            martingaleType: null,
            ganador: null,
            estado: 'WAITING',
            historial: [],
            wins: [],
            startTime: null,
            currentCycleHistory: [],
            supplierSignalFull: null,
            supplierMesaInfoFull: null,
            supplierLastRawSignal: null,
            supplierLastRawResult: null,
            intelSignalTs: null,
            intelResultTs: null,
            intelStepDurations: [],
            vector_forecast: null,
            vector_resultado: null,
            vector_win: null,
          },
        },
      };
    }),

  /**
   * Entra a WAITING_SIGNAL y resetea el estado visual para evitar residuos del ciclo previo.
   * @param {string | null | undefined} [mesaId] — si no se especifica, limpia todas las mesas.
   */
  enterWaitingSignal: (mesaId) =>
    set((state) => {
      const ids =
        mesaId != null && String(mesaId).trim() !== ''
          ? [String(mesaId).trim()]
          : Object.keys(state.mesas);
      const nextMesas = { ...state.mesas };
      ids.forEach((id) => {
        const prev = nextMesas[id] ?? createEmptyMesaState();
        nextMesas[id] = {
          ...prev,
          round: null,
          recommendation: null,
          martingala: 0,
          martingalaSignal: 0,
          signalMartingaleLevel: null,
          martingaleType: null,
          ganador: null,
          estado: 'WAITING',
          historial: [],
          wins: [],
          startTime: null,
          currentCycleHistory: [],
          supplierSignalFull: null,
          supplierMesaInfoFull: null,
          supplierLastRawSignal: null,
          supplierLastRawResult: null,
          intelSignalTs: null,
          intelResultTs: null,
          intelStepDurations: [],
          vector_forecast: null,
          vector_resultado: null,
          vector_win: null,
        };
      });
      return {
        lifecycleState: LAB_LIFECYCLE_STATES.WAITING_SIGNAL,
        bettingEndsAt: null,
        providerRemainingTime: null,
        providerCloseTs: null,
        mesas: nextMesas,
      };
    }),

  /** Agrega un evento a la historia del ciclo de una mesa (sin tocar lógica de señales/resultados). */
  appendCycleEvent: (mesaId, event) =>
    set((state) => {
      const id = mesaId != null && mesaId !== '' ? String(mesaId) : '';
      if (!id) return state;
      const prev = state.mesas[id] ?? createEmptyMesaState();
      const nextHistory = [...(prev.currentCycleHistory ?? [])];
      nextHistory.push(event);
      return {
        mesas: {
          ...state.mesas,
          [id]: {
            ...prev,
            currentCycleHistory: nextHistory,
          },
        },
      };
    }),

  /** Resetea el ciclo anterior solo cuando entra una nueva señal válida. */
  resetMesaForNextSignal: (mesaId) =>
    set((state) => {
      const id = mesaId != null && mesaId !== '' ? String(mesaId) : '';
      if (!id) return state;
      const next = { ...state.mesas };
      delete next[id];
      const sel = state.selectedMesaId === id ? id : state.selectedMesaId;
      return {
        mesas: next,
        selectedMesaId: sel,
      };
    }),

  setSignal: (payload) => {
    const id = mesaKeyFromPayload(payload);
    if (!id) return;
    set((state) => {
      const prev = state.mesas[id] ?? createEmptyMesaState();
      const prevEstado = prev.estado;
      const cycleClosed = prevEstado === 'RESULT' || prevEstado === 'WAITING';
      const nextHistory = cycleClosed ? [] : [...(prev.currentCycleHistory ?? [])];
      const ts = Date.now();
      nextHistory.push({
        type: 'SIGNAL',
        value: payload?.recommendation ?? null,
        timestamp: ts,
      });
      const mg = Number(payload?.martingale ?? 0);
      const mgStep = Number.isFinite(mg) ? mg : 0;
      const mgType =
        typeof payload?.martingaleType === 'string' && payload.martingaleType.trim() !== ''
          ? payload.martingaleType.trim()
          : getMartingaleLabel(mgStep);
      if (mgStep > 0) {
        nextHistory.push({
          type: 'MARTINGALE',
          step: mgStep,
          timestamp: Date.now(),
        });
      }
      const nextVf = vectorForecastFromPayload(payload) ?? prev.vector_forecast;
      const contadorSignal = contadorFromSignalPayload(
        payload != null && typeof payload === 'object'
          ? /** @type {Record<string, unknown>} */ (payload)
          : {},
      );
      const nextMesas = {
        ...state.mesas,
        [id]: {
          ...prev,
          round: payload?.round ?? null,
          recommendation: payload?.recommendation ?? null,
          vector_forecast: nextVf,
          martingala: contadorSignal,
          martingalaSignal: contadorSignal,
          signalMartingaleLevel: mgStep,
          martingaleType: mgType,
          ganador: null,
          vector_resultado: cycleClosed ? null : prev.vector_resultado,
          vector_win: cycleClosed ? null : prev.vector_win,
          estado: 'SIGNAL',
          lastBaseFingerprint: null,
          lastTemporalId: null,
          startTime: ts,
          currentCycleHistory: nextHistory,
        },
      };
      const selectedMesaId = state.selectedMesaId ?? id;
      return {
        mesas: nextMesas,
        selectedMesaId,
        ...mirrorSliceFromState(nextMesas, selectedMesaId),
      };
    });
  },

  setResult: (payload) => {
    const id = mesaKeyFromPayload(payload);
    if (!id) return;
    set((state) => {
      const prev = state.mesas[id] ?? createEmptyMesaState();
      /** Prioridad: `payload.mesa_info.martingala.contador_martingala` (y raíz) vía extractor; si no hay, señal. */
      const nextContador = extractContadorMartingalaFromResultPayload(payload);
      const martingala =
        nextContador !== undefined
          ? nextContador
          : prev.martingalaSignal ?? prev.martingala;

      const pRec =
        payload != null && typeof payload === 'object' ? /** @type {Record<string, unknown>} */ (payload) : {};
      const baseFingerprint = buildNewResultBaseFingerprint(pRec, {
        fallbackContador: prev.martingalaSignal ?? prev.martingala,
      });
      const temporalId = resolveResultTemporalId(pRec);
      if (baseFingerprint !== '' && baseFingerprint === prev.lastBaseFingerprint) {
        if (temporalId !== '' && temporalId !== prev.lastTemporalId) {
          const nextRow = { ...prev, lastTemporalId: temporalId };
          const nextMesas = { ...state.mesas, [id]: nextRow };
          return {
            mesas: nextMesas,
            ...mirrorSliceFromState(nextMesas, state.selectedMesaId),
          };
        }
        return state;
      }

      if (import.meta.env.DEV && nextContador !== undefined && Number(nextContador) !== Number(prev.martingala)) {
        console.log('CONTADOR CHANGE', prev.martingala, '→', nextContador);
      }

      const ganador = payload?.ganador ?? null;
      const historial = normalizeAppend(prev.historial, payload?.vector_resultado);
      const wins = normalizeAppend(prev.wins, payload?.vector_win);

      const vector_resultado = Array.isArray(payload?.vector_resultado)
        ? [...payload.vector_resultado]
        : Array.isArray(prev.vector_resultado)
          ? [...prev.vector_resultado]
          : prev.vector_resultado;
      const vector_win = Array.isArray(payload?.vector_win)
        ? [...payload.vector_win]
        : Array.isArray(prev.vector_win)
          ? [...prev.vector_win]
          : prev.vector_win;

      const vector_forecast = Array.isArray(prev.vector_forecast) ? [...prev.vector_forecast] : prev.vector_forecast;

      const win = winStatusFromVectorWinLastArray(payload?.vector_win);
      const nextHistory = [...(prev.currentCycleHistory ?? [])];
      const resultTs = Date.now();
      nextHistory.push({
        type: 'RESULT',
        value: ganador,
        timestamp: resultTs,
        win: win === null ? undefined : win,
      });

      const nextMesaRow = {
        ...prev,
        ganador,
        historial,
        wins,
        martingala,
        vector_forecast,
        vector_resultado,
        vector_win,
        recommendation: prev.recommendation,
        estado: 'RESULT',
        lastBaseFingerprint: baseFingerprint,
        lastTemporalId: temporalId,
        intelResultTs: resultTs,
        currentCycleHistory: nextHistory,
      };

      const nextMesas = {
        ...state.mesas,
        [id]: nextMesaRow,
      };
      return {
        mesas: nextMesas,
        ...mirrorSliceFromState(nextMesas, state.selectedMesaId),
      };
    });
  },

  /** A nivel de lifecycle: llamado cuando se acepta una señal nueva (inicia ciclo). */
  acceptSignalLifecycle: ({ mesaId, signalTs: signalTsArg, bettingEndsAt }) =>
    set((state) => {
      const ts = signalTsArg ?? Date.now();
      return {
        selectedMesaId: state.selectedMesaId ?? (mesaId != null ? String(mesaId) : null),
        lifecycleState: LAB_LIFECYCLE_STATES.SIGNAL_DETECTED,
        cycleStartedAt: ts,
        signalTs: ts,
        bettingEndsAt: bettingEndsAt ?? null,
      };
    }),

  enterBettingPhase: (endsAt) =>
    set({
      lifecycleState: LAB_LIFECYCLE_STATES.BETTING_PHASE,
      bettingEndsAt: endsAt ?? null,
    }),

  setProviderTimer: ({ remainingSeconds, closeTs }) =>
    set({
      providerRemainingTime:
        typeof remainingSeconds === 'number' && Number.isFinite(remainingSeconds) ? remainingSeconds : null,
      providerCloseTs: typeof closeTs === 'number' && Number.isFinite(closeTs) ? closeTs : null,
    }),

  enterBettingClosed: () =>
    set({
      lifecycleState: LAB_LIFECYCLE_STATES.BETTING_CLOSED,
      bettingEndsAt: null,
    }),

  enterWaitingResult: () =>
    set({
      lifecycleState: LAB_LIFECYCLE_STATES.WAITING_RESULT,
    }),

  /**
   * Umbral stream superado sin NEW_RESULT: UX resiliente para la mesa activa en UI.
   * Recuperación: siguiente NEW_SIGNAL (acceptSignalLifecycle) o NEW_RESULT (enterResultReceived).
   */
  enterStreamInterrupted: ({ mesaId }) =>
    set((state) => {
      const mid = mesaId != null && String(mesaId).trim() !== '' ? String(mesaId).trim() : '';
      if (!mid) return state;
      const eff = getEffectiveMesaId(state.mesas, state.selectedMesaId);
      if (eff !== mid) return state;
      return { lifecycleState: LAB_LIFECYCLE_STATES.STREAM_INTERRUPTED };
    }),

  enterResultReceived: () =>
    set({
      lifecycleState: LAB_LIFECYCLE_STATES.RESULT_RECEIVED,
    }),

  enterCycleComplete: () =>
    set({
      lifecycleState: LAB_LIFECYCLE_STATES.CYCLE_COMPLETE,
      bettingEndsAt: null,
    }),

  /**
   * @param {string | null | undefined} mesaId — si se omite, limpia todas las mesas
   */
  resetCycle: (mesaId) =>
    set((state) => {
      if (mesaId == null || mesaId === '') {
        return { mesas: {}, selectedMesaId: null, ...mirrorSliceFromState({}, null) };
      }
      const id = String(mesaId);
      const next = { ...state.mesas };
      delete next[id];
      let sel = state.selectedMesaId;
      if (sel === id) sel = getEffectiveMesaId(next, null);
      return { mesas: next, selectedMesaId: sel, ...mirrorSliceFromState(next, sel) };
    }),

  /**
   * Enriquecimiento UI desde payload crudo del socket (sin tocar middleware).
   * @param {unknown} raw
   * @param {{ mesaId: string, cycleClosed: boolean }} ctx
   */
  mergeSupplierIntelSignal: (raw, ctx) => {
    if (raw == null || typeof raw !== 'object') return;
    const id = ctx.mesaId;
    if (!id) return;
    const sig = extractNestedSignal(raw);
    const miFromSignal = extractNestedMesaInfo(raw);

    set((state) => {
      const prev = state.mesas[id] ?? createEmptyMesaState();
      const flush = ctx.cycleClosed;
      const ts = Date.now();

      /** @type {Record<string, unknown> | null} */
      let supplierMesaInfoFull =
        prev.supplierMesaInfoFull != null && typeof prev.supplierMesaInfoFull === 'object'
          ? /** @type {Record<string, unknown>} */ (prev.supplierMesaInfoFull)
          : null;

      if (flush) {
        // Nueva mano: solo limpiar mesa si el proveedor no envía mesa_info en esta señal.
        if (miFromSignal != null) {
          supplierMesaInfoFull = { ...miFromSignal };
        } else {
          supplierMesaInfoFull = null;
        }
      } else if (miFromSignal != null) {
        supplierMesaInfoFull = mergeMesaInfoProgressive(supplierMesaInfoFull, miFromSignal);
      }

      const base = flush
        ? {
            supplierMesaInfoFull,
            supplierLastRawResult: null,
            intelResultTs: null,
            intelStepDurations: [],
            supplierSignalFull: sig,
            supplierLastRawSignal: /** @type {Record<string, unknown>} */ (raw),
            intelSignalTs: ts,
          }
        : {
            supplierSignalFull: sig ?? prev.supplierSignalFull,
            supplierLastRawSignal: /** @type {Record<string, unknown>} */ (raw),
            intelSignalTs: prev.intelSignalTs ?? ts,
            supplierMesaInfoFull,
          };

      const nextMesas = {
        ...state.mesas,
        [id]: {
          ...prev,
          ...base,
        },
      };
      return {
        mesas: nextMesas,
        ...mirrorSliceFromState(nextMesas, state.selectedMesaId),
      };
    });
  },

  /**
   * @param {unknown} raw
   * @param {{ mesaId: string }} ctx
   */
  mergeSupplierIntelResult: (raw, ctx) => {
    if (raw == null || typeof raw !== 'object') return;
    const id = ctx.mesaId;
    if (!id) return;
    const mi = extractNestedMesaInfo(raw);
    set((state) => {
      const prev = state.mesas[id] ?? createEmptyMesaState();
      const ts = Date.now();
      const sigTs = prev.intelSignalTs;
      const delta = sigTs != null ? ts - sigTs : null;
      const steps = [...(prev.intelStepDurations ?? [])];
      if (delta != null) {
        steps.push({ label: 'Señal → resultado', at: ts, deltaMs: delta });
      }
      const mesaAnalytics = delta != null ? updateMesaAnalyticsFromDelay(prev, delta) : prev.mesaAnalytics;
      const nextMesas = {
        ...state.mesas,
        [id]: {
          ...prev,
          supplierMesaInfoFull: mi ?? prev.supplierMesaInfoFull,
          supplierLastRawResult: /** @type {Record<string, unknown>} */ (raw),
          intelResultTs: ts,
          intelStepDurations: steps,
          mesaAnalytics,
        },
      };
      return {
        mesas: nextMesas,
        ...mirrorSliceFromState(nextMesas, state.selectedMesaId),
      };
    });
  },
}));

/** @param {unknown} raw */
export function resolveMesaIdForIntel(raw) {
  const fromFlat = mesaKeyFromPayload(raw);
  if (fromFlat) return fromFlat;
  return extractMesaKeyFromRaw(raw);
}
