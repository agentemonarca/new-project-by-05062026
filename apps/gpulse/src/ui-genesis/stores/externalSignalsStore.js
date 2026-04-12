import { create } from 'zustand';
import {
  extractProviderSignalAlgorithmName,
  normalizeNewResultPayload,
  normalizeNewSignalPayload,
} from '../lib/externalSignalsTypes.js';
import { isGpulseFullFlowEnabled, postFullFlowRow } from '../../utils/gpulseFullFlowClient.js';

/** @typedef {'pending' | 'won' | 'lost'} SignalSettlement */

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
 */

const HISTORY_CAP = 120;
const RECENT_EVENTS_CAP = 64;
const ADMIN_RAW_FEED_CAP = 150;
const SETTLEMENT_LATENCY_CAP = 120;

function genId() {
  return `sig-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
    const id = `adm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  },

  ingestNewResult(payload) {
    const r = normalizeNewResultPayload(payload);
    const pending = get().activeSignals.filter((s) => s.status === 'pending');
    const target = findPendingForResult(pending, {
      correlationKey: r.correlationKey,
      providerSignalId: r.providerSignalId,
      mesa: r.mesa,
      round: r.round,
    });

    if (!target) {
      get().pushEvent('NEW_RESULT', `Sin señal pendiente · win=${r.winStatus}`);
      get().recordCorrelationMiss();
      return;
    }

    const status = r.winStatus ? 'won' : 'lost';
    const settledAt = Date.now();
    const latencyMs = settledAt - target.receivedAt;

    set((s) => {
      const activeSignals = s.activeSignals.filter((x) => x.id !== target.id);
      const settled = /** @type {ExternalBaccaratSignalRow} */ ({
        ...target,
        status,
        settledAt,
        winStatus: r.winStatus,
        rawResult: r.raw,
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
    if (isGpulseFullFlowEnabled()) {
      const s = get();
      console.log('🧠 STORE UPDATE', { signals: s.activeSignals, history: s.history });
      void postFullFlowRow({ pipeline: 'store', after: 'ingestNewResult', signals: s.activeSignals, history: s.history });
    }

    get().pushEvent('NEW_RESULT', `${status.toUpperCase()} · ${target.recommendation} · mesa ${target.mesa}`);
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
