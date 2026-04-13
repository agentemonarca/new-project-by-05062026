import { create } from 'zustand';
import {
  extractProviderSignalAlgorithmName,
  normalizeNewResultPayload,
  normalizeNewSignalPayload,
} from '../lib/externalSignalsTypes.js';
import { isGpulseFullFlowEnabled, postFullFlowRow } from '../../utils/gpulseFullFlowClient.js';
import {
  extractVectorForecastArrayFromSignalRaw,
  extractVectorResultadoAndWinFromResultRaw,
  mergeCoalescedPayloadWithEnvelopeExtract,
  mergeResultEnvelopeForExtract,
  pickContadorMartingalaFromResultRaw,
  predictionSideFromVectorAndContador,
  PROVIDER_MARTINGALE_STEPS,
  isInterimMartingaleStep,
  winStatusFromVectorWinLast,
} from '../../utils/providerMartingaleRead.js';
import { logCycleEvent, summarizeCycle } from '../../utils/cycleDebugLogger.js';
import { extractMesaInfoFlexible, mergeSettledResultPayloadPreferringCards } from '../../utils/iaRealEngineUi.js';
import { assertExternalSignalRowShape, logPipeCheck } from '../../utils/iaRealPipelineDiagnostics.js';
import { nextOpaqueId } from '../../utils/gpulseRngPolicy.js';

/** @typedef {'pending' | 'won' | 'lost' | 'intermediate'} SignalSettlement — `intermediate` = NEW_RESULT de paso (stream) sin cierre de ciclo */

/**
 * @typedef {object} ExternalBaccaratSignalRow
 * @property {string} id — id interno UUID
 * @property {string} correlationKey
 * @property {string | null} providerSignalId
 * @property {import('../lib/externalSignalsTypes.js').BaccaratSide} recommendation
 * @property {number} martingale
 * @property {string} mesa
 * @property {string} round
 * @property {number} receivedAt
 * @property {SignalSettlement} status
 * @property {number | null} settledAt
 * @property {boolean | null} winStatus
 * @property {Record<string, unknown>} rawSignal
 * @property {string | null} algorithmDisplayName — snapshot al ingest (nombre modelo desde payload relay).
 * @property {Record<string, unknown> | null} rawResult
 * @property {'socket_NEW_RESULT' | 'signal_stream_frame'} [resultIngestSource] — cierre de mano vía evento socket `NEW_RESULT` o vía `signal_stream_frame` (mismo `ingestNewResult`).
 */

const HISTORY_CAP = 120;
const RECENT_EVENTS_CAP = 64;
const ADMIN_RAW_FEED_CAP = 150;
const SETTLEMENT_LATENCY_CAP = 120;

const CYCLE_DEBUG = String(import.meta.env.VITE_CYCLE_DEBUG ?? '').trim() === '1';

function genId() {
  return nextOpaqueId('sig');
}

/**
 * Encuentra señal pendiente: por clave, id proveedor, o última misma mesa+ronda.
 * @param {ExternalBaccaratSignalRow[]} pending
 * @param {{ correlationKey: string, providerSignalId: string | null, mesa: string, round: string }} pick
 */
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
 * Vista presentada al usuario (filtro por mesa + delta visual de martingala).
 * @param {{ activeSignals: ExternalBaccaratSignalRow[], history: ExternalBaccaratSignalRow[], signalIntelControls: object }} slice
 */
export function buildPresentedSignalView({ activeSignals, history, signalIntelControls }) {
  const f = String(signalIntelControls?.mesaFilter ?? '').trim();
  const d = Number(signalIntelControls?.martingaleDisplayDelta ?? 0) || 0;
  const match = (r) => !f || String(r.mesa ?? '') === f;
  const mapMg = (r) => ({
    ...r,
    martingale: Math.max(0, (Number(r.martingale) || 0) + d),
  });
  const act = activeSignals.filter(match).map(mapMg);
  const hist = history.filter(match).map(mapMg);
  const wins = hist.filter((h) => h.status === 'won').length;
  const losses = hist.filter((h) => h.status === 'lost').length;
  const pending = act.filter((x) => x.status === 'pending').length;
  return {
    activeSignals: act,
    history: hist,
    stats: { wins, losses, pending },
  };
}

export const useExternalSignalsStore = create((set, get) => ({
  /** @type {'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'disabled'} */
  connectionStatus: 'idle',
  lastError: null,
  lastConnectedAt: null,
  reconnectAttempt: 0,
  /** Incrementa en cada NEW_SIGNAL / NEW_RESULT (animaciones UI). */
  streamTick: 0,

  /** @type {ExternalBaccaratSignalRow[]} */
  activeSignals: [],
  /** @type {ExternalBaccaratSignalRow[]} más reciente primero */
  history: [],
  stats: {
    wins: 0,
    losses: 0,
    pending: 0,
  },

  /** @type {Array<{ ts: number, type: string, summary: string }>} */
  recentEvents: [],

  /** Feed crudo admin (socket) — operaciones / depuración. */
  /** @type {Array<{ id: string, ts: number, type: string, mesa: string, raw: Record<string, unknown> }>} */
  adminRawFeed: [],

  /** Controles operador — impactan ingest retardado, vista usuario y presentación. */
  signalIntelControls: {
    showSignalsToUsers: true,
    artificialDelayMs: 0,
    martingaleDisplayDelta: 0,
    mesaFilter: '',
  },

  /** Métricas agregadas para Signal Intelligence Panel. */
  signalIntelMetrics: {
    correlationErrors: 0,
    /** @type {number[]} */
    settlementLatenciesMs: [],
  },

  pushEvent(type, summary) {
    const ev = { ts: Date.now(), type, summary };
    set((s) => ({
      recentEvents: [ev, ...s.recentEvents].slice(0, RECENT_EVENTS_CAP),
    }));
  },

  setConnectionMeta(patchOrFn) {
    set((s) => (typeof patchOrFn === 'function' ? patchOrFn(s) : { ...s, ...patchOrFn }));
  },

  patchSignalIntelControls(patch) {
    set((s) => ({
      signalIntelControls: { ...s.signalIntelControls, ...patch },
    }));
  },

  logAdminRawSocketEvent(type, raw) {
    const id = nextOpaqueId('adm');
    const r =
      raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : { _primitive: raw };
    const mesa = String(r.mesa ?? r.table ?? r.desk ?? '') || '—';
    set((s) => ({
      adminRawFeed: [{ id, ts: Date.now(), type, mesa, raw: r }, ...s.adminRawFeed].slice(0, ADMIN_RAW_FEED_CAP),
    }));
  },

  clearAdminRawFeed() {
    set({ adminRawFeed: [] });
  },

  resetSignalIntelMetrics() {
    set((s) => ({
      signalIntelMetrics: { correlationErrors: 0, settlementLatenciesMs: [] },
    }));
  },

  recordSettlementLatency(ms) {
    const n = Math.max(0, Number(ms) || 0);
    set((s) => ({
      signalIntelMetrics: {
        ...s.signalIntelMetrics,
        settlementLatenciesMs: [...s.signalIntelMetrics.settlementLatenciesMs, n].slice(
          -SETTLEMENT_LATENCY_CAP,
        ),
      },
    }));
  },

  recordCorrelationMiss() {
    set((s) => ({
      signalIntelMetrics: {
        ...s.signalIntelMetrics,
        correlationErrors: s.signalIntelMetrics.correlationErrors + 1,
      },
    }));
  },

  ingestNewSignal(payload) {
    const n = normalizeNewSignalPayload(payload);
    if (CYCLE_DEBUG) {
      logCycleEvent('NEW_SIGNAL', { correlationKey: n.correlationKey, mesa: n.mesa, round: n.round });
    }
    const algorithmDisplayName = extractProviderSignalAlgorithmName(payload) || null;
    const row = /** @type {ExternalBaccaratSignalRow} */ ({
      id: genId(),
      correlationKey: n.correlationKey,
      providerSignalId: n.providerSignalId,
      recommendation: n.recommendation,
      martingale: n.martingale,
      mesa: n.mesa,
      round: n.round,
      receivedAt: Date.now(),
      status: 'pending',
      settledAt: null,
      winStatus: null,
      rawSignal: n.raw,
      algorithmDisplayName,
      rawResult: null,
    });

    assertExternalSignalRowShape(row, 'ingestNewSignal');

    set((s) => {
      const activeSignals = [...s.activeSignals, row];
      return {
        streamTick: s.streamTick + 1,
        activeSignals,
        stats: {
          ...s.stats,
          pending: activeSignals.filter((x) => x.status === 'pending').length,
        },
      };
    });
    if (isGpulseFullFlowEnabled()) {
      const s = get();
      console.log('🧠 STORE UPDATE', { signals: s.activeSignals, history: s.history });
      void postFullFlowRow({ pipeline: 'store', after: 'ingestNewSignal', signals: s.activeSignals, history: s.history });
    }
    get().pushEvent(
      'NEW_SIGNAL',
      `${n.recommendation} · mesa ${n.mesa || '—'} · ronda ${n.round || '—'}`,
    );

    const stAfter = get();
    const last = stAfter.activeSignals[stAfter.activeSignals.length - 1] ?? row;
    logPipeCheck({
      layer: 'store',
      event: 'NEW_SIGNAL',
      socket: payload,
      normalized: n,
      storeRow: last,
      activeRow: last,
    });
  },

  /**
   * @param {unknown} payload
   * @param {{ ingestSource?: 'socket_NEW_RESULT' | 'signal_stream_frame' }} [opts]
   */
  ingestNewResult(payload, opts = {}) {
    const ingestSource = opts.ingestSource ?? 'socket_NEW_RESULT';
    const r = normalizeNewResultPayload(payload);
    if (CYCLE_DEBUG) {
      console.log('🧪 NORMALIZED RESULT', r);
    }
    const flat = mergeResultEnvelopeForExtract(payload);
    if (String(import.meta.env.VITE_DEBUG_MG ?? '').trim() === '1') {
      const { vector_resultado, vector_win } = extractVectorResultadoAndWinFromResultRaw(flat);
      console.log('DEBUG RESULT INPUT', {
        contador: pickContadorMartingalaFromResultRaw(flat),
        vector_resultado,
        vector_win,
      });
    }

    const pending = get().activeSignals.filter((s) => s.status === 'pending');
    const target = findPendingForResult(pending, {
      correlationKey: r.correlationKey,
      providerSignalId: r.providerSignalId,
      mesa: r.mesa,
      round: r.round,
    });

    if (!target) {
      if (CYCLE_DEBUG) {
        logCycleEvent('NEW_RESULT', {
          correlationKey: r.correlationKey,
          mesa: r.mesa,
          round: r.round,
          matched: false,
        });
        console.log('📥 STORE NEW_RESULT', {
          correlationKey: r.correlationKey,
          matchedRow: null,
          martingale: undefined,
          status: undefined,
          rawResult: payload,
        });
      }
      get().pushEvent('NEW_RESULT', `Sin señal pendiente · win=${r.winStatus}`);
      get().recordCorrelationMiss();
      return;
    }

    const isInterimStep = isInterimMartingaleStep(payload, target, r.winStatus);

    /** Paso intermedio (martingala): actualizar fila pendiente y además historizar cada NEW_RESULT (FASE 4 full stream). */
    if (isInterimStep) {
      const prevMg = Number(target.martingale) || 1;
      const extracted = pickContadorMartingalaFromResultRaw(flat);
      const { vector_resultado: vrNew } = extractVectorResultadoAndWinFromResultRaw(flat);
      const prevRaw =
        target.rawResult != null && typeof target.rawResult === 'object' && !Array.isArray(target.rawResult)
          ? target.rawResult
          : {};
      const { vector_resultado: vrOld } = extractVectorResultadoAndWinFromResultRaw(prevRaw);

      let newMg =
        extracted != null && Number.isFinite(Number(extracted)) && Number(extracted) > prevMg
          ? Number(extracted)
          : vrNew.length > vrOld.length
            ? Math.min(PROVIDER_MARTINGALE_STEPS, vrNew.length + 1)
            : Math.min(PROVIDER_MARTINGALE_STEPS, prevMg + 1);
      newMg = Math.max(1, Math.min(PROVIDER_MARTINGALE_STEPS, newMg));

      const rs =
        target.rawSignal != null && typeof target.rawSignal === 'object' && !Array.isArray(target.rawSignal)
          ? target.rawSignal
          : {};
      const vf = extractVectorForecastArrayFromSignalRaw(rs);
      const pred = predictionSideFromVectorAndContador(vf, newMg);
      const recommendation =
        pred === 'PLAYER' || pred === 'BANKER' || pred === 'TIE' ? pred : 'UNKNOWN';

      if (String(import.meta.env.VITE_DEBUG_MG ?? '').trim() === '1') {
        console.log('DEBUG STORE UPDATE (merge loss)', {
          prevStep: prevMg,
          nextStep: newMg,
          prediction: recommendation,
        });
      }

      if (CYCLE_DEBUG) {
        console.log('📥 STORE NEW_RESULT', {
          correlationKey: r.correlationKey,
          matchedRow: target.id,
          martingale: newMg,
          status: 'pending',
          rawResult: payload,
          mode: 'stream_intermediate',
        });
      }

      const mergedSnapInterim = mergeCoalescedPayloadWithEnvelopeExtract(payload);
      const prevFlatInterim =
        target.rawResult != null && typeof target.rawResult === 'object' && !Array.isArray(target.rawResult)
          ? mergeResultEnvelopeForExtract(target.rawResult)
          : null;
      let rawResultInterim = mergedSnapInterim;
      if (prevFlatInterim != null && typeof prevFlatInterim === 'object') {
        const fMeta = extractMesaInfoFlexible(mergedSnapInterim);
        const pMeta = extractMesaInfoFlexible(prevFlatInterim);
        const freshOk =
          (fMeta.cartas_player?.length ?? 0) > 0 || (fMeta.cartas_banker?.length ?? 0) > 0;
        const prevOk = (pMeta.cartas_player?.length ?? 0) > 0 || (pMeta.cartas_banker?.length ?? 0) > 0;
        if (prevOk && !freshOk) {
          rawResultInterim = mergeSettledResultPayloadPreferringCards(prevFlatInterim, mergedSnapInterim);
        }
      }

      const stepHistoryId = genId();
      set((s) => {
        const nextRow = /** @type {ExternalBaccaratSignalRow} */ ({
          ...target,
          martingale: newMg,
          recommendation,
          rawResult: rawResultInterim,
          status: 'pending',
          settledAt: null,
          winStatus: null,
        });
        const activeSignals = s.activeSignals.map((x) => (x.id === target.id ? nextRow : x));
        const streamStep = /** @type {ExternalBaccaratSignalRow} */ ({
          ...target,
          id: stepHistoryId,
          martingale: newMg,
          recommendation,
          rawResult: rawResultInterim,
          status: 'intermediate',
          settledAt: Date.now(),
          winStatus: null,
          resultIngestSource: ingestSource,
        });
        return {
          streamTick: s.streamTick + 1,
          activeSignals,
          history: [streamStep, ...s.history].slice(0, HISTORY_CAP),
          stats: {
            ...s.stats,
            pending: activeSignals.filter((x) => x.status === 'pending').length,
          },
        };
      });
      const mergedRow = get().activeSignals.find((x) => x.id === target.id);
      const streamHead = get().history[0];
      assertExternalSignalRowShape(mergedRow, 'ingestNewResult interim_active');
      assertExternalSignalRowShape(streamHead, 'ingestNewResult interim_history');
      logPipeCheck({
        layer: 'store',
        event: 'NEW_RESULT_INTERMEDIATE',
        socket: payload,
        normalized: r,
        storeRow: mergedRow,
        activeRow: mergedRow,
      });
      get().pushEvent(
        'NEW_RESULT',
        `STREAM_STEP · MG ${prevMg}→${newMg} · ${recommendation} · mesa ${target.mesa} · id:${stepHistoryId}`,
      );
      return;
    }

    /** Cierre final: `status` string para UI (panel, tablas). Alineado con `winStatus` booleano del normalizado. */
    const status = r.winStatus === true ? 'won' : 'lost';
    const settledAt = Date.now();
    const latencyMs = settledAt - target.receivedAt;

    if (CYCLE_DEBUG) {
      logCycleEvent('NEW_RESULT', {
        correlationKey: r.correlationKey,
        mesa: r.mesa,
        round: r.round,
        phase: 'final',
        settlement: status,
      });
      console.log('📥 STORE NEW_RESULT', {
        correlationKey: r.correlationKey,
        matchedRow: target.id,
        martingale: target.martingale,
        status,
        rawResult: payload,
        mode: 'settled',
      });
      summarizeCycle(r.correlationKey);
    }

    /** Cierre final a veces manda payload mínimo (sin cartas); la fila pendiente ya llevaba `rawResult` mergeado en pasos LOSS. */
    const mergedSnap = mergeCoalescedPayloadWithEnvelopeExtract(payload);
    const prevMerged =
      target.rawResult != null && typeof target.rawResult === 'object' && !Array.isArray(target.rawResult)
        ? mergeResultEnvelopeForExtract(target.rawResult)
        : null;
    let rawResultForHistory = mergedSnap;
    if (prevMerged != null && typeof prevMerged === 'object') {
      const fMeta = extractMesaInfoFlexible(mergedSnap);
      const pMeta = extractMesaInfoFlexible(prevMerged);
      const freshOk =
        (fMeta.cartas_player?.length ?? 0) > 0 || (fMeta.cartas_banker?.length ?? 0) > 0;
      const prevOk = (pMeta.cartas_player?.length ?? 0) > 0 || (pMeta.cartas_banker?.length ?? 0) > 0;
      if (prevOk && !freshOk) {
        rawResultForHistory = mergeSettledResultPayloadPreferringCards(prevMerged, mergedSnap);
      }
    }

    set((s) => {
      const activeSignals = s.activeSignals.filter((x) => x.id !== target.id);
      const settled = /** @type {ExternalBaccaratSignalRow} */ ({
        ...target,
        status,
        settledAt,
        winStatus: r.winStatus,
        rawResult: rawResultForHistory,
        resultIngestSource: ingestSource,
      });
      const history = [settled, ...s.history].slice(0, HISTORY_CAP);
      const wins = s.stats.wins + (r.winStatus ? 1 : 0);
      const losses = s.stats.losses + (r.winStatus ? 0 : 1);
      return {
        streamTick: s.streamTick + 1,
        activeSignals,
        history,
        stats: {
          wins,
          losses,
          pending: activeSignals.filter((x) => x.status === 'pending').length,
        },
      };
    });
    const settledHead = get().history[0];
    assertExternalSignalRowShape(settledHead, 'ingestNewResult settled');
    logPipeCheck({
      layer: 'store',
      event: 'NEW_RESULT',
      socket: payload,
      normalized: r,
      storeRow: settledHead,
      activeRow: settledHead,
    });
    if (isGpulseFullFlowEnabled()) {
      const s = get();
      console.log('🧠 STORE UPDATE', { signals: s.activeSignals, history: s.history });
      void postFullFlowRow({ pipeline: 'store', after: 'ingestNewResult', signals: s.activeSignals, history: s.history });
    }

    get().pushEvent(
      'NEW_RESULT',
      `${status.toUpperCase()} · ${target.recommendation} · mesa ${target.mesa} · src:${ingestSource}`,
    );
    get().recordSettlementLatency(latencyMs);
  },

  /** Dev / tests */
  resetAll() {
    set({
      streamTick: 0,
      activeSignals: [],
      history: [],
      stats: { wins: 0, losses: 0, pending: 0 },
      recentEvents: [],
      lastError: null,
      reconnectAttempt: 0,
      adminRawFeed: [],
      signalIntelControls: {
        showSignalsToUsers: true,
        artificialDelayMs: 0,
        martingaleDisplayDelta: 0,
        mesaFilter: '',
      },
      signalIntelMetrics: { correlationErrors: 0, settlementLatenciesMs: [] },
    });
  },
}));
