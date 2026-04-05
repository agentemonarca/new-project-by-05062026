import { create } from 'zustand';
import type {
  ActivityItem,
  GenesisDashboardUserState,
  GenesisUser,
  NetworkData,
  SystemMode,
  WalletSnapshot,
} from '@ai-genesis/types';
import { STORAGE_KEYS } from '@ai-genesis/config';
import { emit } from './events.js';
import type {
  GpulseDecisionOutcome,
  GpulsePerformanceTrend,
  GpulseRuntimeStatus,
  GpulseStrategy,
} from './events.js';

export type { GpulseRuntimeStatus, GpulseStrategy };

export type ExecutionRelay =
  | { type: 'control'; action: 'start' | 'pause' }
  | { type: 'strategy'; value: GpulseStrategy }
  | { type: 'safety'; enabled: boolean };

export interface ApplyExecutionInput {
  success: boolean;
  action: string;
  latencyMs: number;
  timestamp: number;
  error?: string;
  status?: GpulseRuntimeStatus;
  strategy?: GpulseStrategy;
  safeMode?: boolean;
  autoMode?: boolean;
  modelConfidence?: number;
  /** Re-emit for iframe relay after server ack */
  relay?: ExecutionRelay;
}

/** Payload from WS `gpulse:ai:decision` (before mapping into gpulse slice). */
export interface GpulseAiDecision {
  action: string;
  confidence: number;
  reason: string;
  timestamp: number;
}

export interface GpulseState {
  connected: boolean;
  lastSync: number;
  status: GpulseRuntimeStatus;
  strategy: GpulseStrategy;
  safeMode: boolean;
  /** Autonomous decision loop may act when true (server source of truth). */
  autoMode: boolean;
  /** Backend model confidence 0–1 (mock drift). */
  modelConfidence: number;
  /** Last AI engine suggestion: start | pause | hold | … */
  lastDecision: string | null;
  decisionConfidence: number;
  decisionReason: string;
  decisionTimestamp: number;
  lastAction: string | null;
  lastExecutionTime: number;
  executionLatency: number | null;
  /** Derived from backend learning loop (EMA + simulated outcomes). */
  performanceTrend: GpulsePerformanceTrend;
  learningState: string;
  /** Recent modelConfidence samples for sparkline-style UI (newest last). */
  confidenceHistory: number[];
  /** Timestamp of last learning WS merge (UI pulse). */
  lastLearningAt: number;
}

/** WebSocket edge connectivity (ephemeral; not persisted). */
export interface RealtimeWsState {
  connected: boolean;
  reconnecting: boolean;
  /** Last time a live snapshot/update was applied (for UI pulse). */
  lastLiveAt: number;
}

export interface GpulseRealtimePayload {
  status: GpulseRuntimeStatus;
  strategy: GpulseStrategy;
  safeMode: boolean;
  timestamp: number;
  source: 'websocket' | 'snapshot';
  autoMode?: boolean;
  modelConfidence?: number;
  performanceTrend?: GpulsePerformanceTrend;
  learningState?: string;
}

export interface GenesisDashboardSlice {
  /** Dashboard user domain (Genesis native UI); nested `user` matches Phase 5 spec. */
  user: GenesisDashboardUserState;
  recentActivity: ActivityItem[];
  /** Wallet module: ledger rows (mirrors `recentActivity`; same persistence). */
  transactions: ActivityItem[];
}

export interface GenesisStoreState {
  user: GenesisUser | null;
  wallet: WalletSnapshot | null;
  token: string | null;
  isAuthenticated: boolean;
  systemMode: SystemMode;
  /** Genesis dashboard data (API + persisted snapshot). */
  dashboard: GenesisDashboardSlice;
  /** Last successful `syncGenesisModules` (ms); used to skip redundant fetches across routes. */
  genesisModulesSyncedAt: number;
  gpulse: GpulseState;
  realtimeWs: RealtimeWsState;
  setUser: (user: GenesisUser | null) => void;
  setWallet: (wallet: WalletSnapshot | null) => void;
  setUserData: (payload: Partial<Pick<GenesisDashboardUserState, 'id' | 'email' | 'wallet'>>) => void;
  setWalletData: (payload: Partial<Pick<GenesisDashboardUserState, 'wallet' | 'balance'>>) => void;
  setNetworkData: (payload: { networkStats: NetworkData }) => void;
  setRecentActivity: (items: ActivityItem[]) => void;
  setGenesisModulesSyncedAt: (t: number) => void;
  setToken: (token: string | null) => void;
  setAuthenticated: (v: boolean) => void;
  setSystemMode: (mode: SystemMode) => void;
  setGpulseConnected: (connected: boolean) => void;
  setGpulseStatus: (status: GpulseRuntimeStatus) => void;
  setGpulseSlice: (partial: Partial<GpulseState>) => void;
  /** Merge server-confirmed execution state + events (backend source of truth). */
  applyExecutionResult: (input: ApplyExecutionInput) => void;
  /** Merge execution slice from WebSocket snapshot/update (no iframe relay). */
  applyGpulseRealtimePayload: (input: GpulseRealtimePayload) => void;
  /** Apply streamed AI decision (observability; does not imply execution without server auto). */
  applyGpulseAiDecision: (input: GpulseAiDecision) => void;
  applyGpulseLearningUpdate: (input: {
    modelConfidence: number;
    performanceTrend: GpulsePerformanceTrend;
    strategy: GpulseStrategy;
    learningState: string;
    lastOutcome?: GpulseDecisionOutcome;
  }) => void;
  applyGpulseStrategyAuto: (input: {
    modelConfidence: number;
    performanceTrend: GpulsePerformanceTrend;
    strategy: GpulseStrategy;
    previousStrategy: GpulseStrategy;
    learningState: string;
  }) => void;
  /** Local flip for optimistic UI; pair with POST /api/gpulse/auto and revert on failure. */
  toggleAutoMode: () => void;
  setRealtimeWsSlice: (partial: Partial<RealtimeWsState>) => void;
  applyAuthSync: (payload: { token: string | null; user: GenesisUser | null }) => void;
  reset: () => void;
}

function isStrategy(x: unknown): x is GpulseStrategy {
  return x === 'speed' || x === 'balanced' || x === 'protection';
}

function isPerformanceTrend(x: unknown): x is GpulsePerformanceTrend {
  return x === 'improving' || x === 'declining' || x === 'stable';
}

/** Migrate older persisted `lastAiDecision` object to flat fields. */
function migrateLegacyLastAiDecision(j: Record<string, unknown>): Partial<GpulseState> {
  if (typeof j.lastDecision === 'string') return {};
  const legacy = j.lastAiDecision;
  if (!legacy || typeof legacy !== 'object') return {};
  const o = legacy as Record<string, unknown>;
  if (typeof o.action !== 'string') return {};
  return {
    lastDecision: o.action,
    decisionConfidence: Math.min(1, Math.max(0, Number(o.confidence) || 0)),
    decisionReason: String(o.reason ?? ''),
    decisionTimestamp: Number(o.timestamp) || 0,
  };
}

function readPersistedGpulse(): Partial<GpulseState> | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GPULSE_STATUS);
    if (!raw) return null;
    const j = JSON.parse(raw) as Record<string, unknown>;
    const st = String(j.status);
    const strat = isStrategy(j.strategy) ? j.strategy : undefined;
    return {
      connected: Boolean(j.connected),
      lastSync: Number(j.lastSync) || 0,
      status: (['idle', 'running', 'syncing', 'paused'].includes(st) ? st : 'idle') as GpulseRuntimeStatus,
      ...(strat ? { strategy: strat } : {}),
      ...(typeof j.safeMode === 'boolean' ? { safeMode: j.safeMode } : {}),
      ...(typeof j.autoMode === 'boolean' ? { autoMode: j.autoMode } : {}),
      ...(Number.isFinite(Number(j.modelConfidence))
        ? { modelConfidence: Math.min(1, Math.max(0, Number(j.modelConfidence))) }
        : {}),
      ...(typeof j.lastDecision === 'string'
        ? { lastDecision: j.lastDecision }
        : j.lastDecision === null
          ? { lastDecision: null }
          : {}),
      ...(Number.isFinite(Number(j.decisionConfidence))
        ? { decisionConfidence: Math.min(1, Math.max(0, Number(j.decisionConfidence))) }
        : {}),
      ...(typeof j.decisionReason === 'string' ? { decisionReason: j.decisionReason } : {}),
      ...(Number.isFinite(Number(j.decisionTimestamp)) ? { decisionTimestamp: Number(j.decisionTimestamp) } : {}),
      ...migrateLegacyLastAiDecision(j),
      ...(typeof j.lastAction === 'string' ? { lastAction: j.lastAction } : j.lastAction === null ? { lastAction: null } : {}),
      ...(Number.isFinite(Number(j.lastExecutionTime)) ? { lastExecutionTime: Number(j.lastExecutionTime) } : {}),
      ...(j.executionLatency == null || Number.isFinite(Number(j.executionLatency))
        ? { executionLatency: j.executionLatency == null ? null : Number(j.executionLatency) }
        : {}),
      ...(isPerformanceTrend(j.performanceTrend) ? { performanceTrend: j.performanceTrend } : {}),
      ...(typeof j.learningState === 'string' ? { learningState: j.learningState } : {}),
      ...(Array.isArray(j.confidenceHistory)
        ? {
            confidenceHistory: j.confidenceHistory
              .map((n) => Number(n))
              .filter((n) => Number.isFinite(n))
              .map((n) => Math.min(1, Math.max(0, n)))
              .slice(-32),
          }
        : {}),
      ...(Number.isFinite(Number(j.lastLearningAt)) ? { lastLearningAt: Number(j.lastLearningAt) } : {}),
    };
  } catch {
    return null;
  }
}

function persistGpulseSlice(g: GpulseState) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEYS.GPULSE_STATUS,
      JSON.stringify({
        connected: g.connected,
        lastSync: g.lastSync,
        status: g.status,
        strategy: g.strategy,
        safeMode: g.safeMode,
        autoMode: g.autoMode,
        modelConfidence: g.modelConfidence,
        lastDecision: g.lastDecision,
        decisionConfidence: g.decisionConfidence,
        decisionReason: g.decisionReason,
        decisionTimestamp: g.decisionTimestamp,
        lastAction: g.lastAction,
        lastExecutionTime: g.lastExecutionTime,
        executionLatency: g.executionLatency,
        performanceTrend: g.performanceTrend,
        learningState: g.learningState,
        confidenceHistory: g.confidenceHistory.slice(-24),
        lastLearningAt: g.lastLearningAt,
      }),
    );
  } catch {
    /* quota */
  }
}

const gpulseDefaults: GpulseState = {
  connected: false,
  lastSync: 0,
  status: 'idle',
  strategy: 'balanced',
  safeMode: false,
  autoMode: false,
  modelConfidence: 0.82,
  lastDecision: null,
  decisionConfidence: 0,
  decisionReason: '',
  decisionTimestamp: 0,
  lastAction: null,
  lastExecutionTime: 0,
  executionLatency: null,
  performanceTrend: 'stable',
  learningState: 'idle',
  confidenceHistory: [],
  lastLearningAt: 0,
};

const initialGpulse: GpulseState = (() => {
  const p = readPersistedGpulse();
  return {
    ...gpulseDefaults,
    ...p,
    connected: false,
    strategy: p?.strategy ?? gpulseDefaults.strategy,
    safeMode: p?.safeMode ?? gpulseDefaults.safeMode,
    autoMode: p?.autoMode ?? gpulseDefaults.autoMode,
    modelConfidence: p?.modelConfidence ?? gpulseDefaults.modelConfidence,
    lastDecision: p?.lastDecision ?? gpulseDefaults.lastDecision,
    decisionConfidence: p?.decisionConfidence ?? gpulseDefaults.decisionConfidence,
    decisionReason: p?.decisionReason ?? gpulseDefaults.decisionReason,
    decisionTimestamp: p?.decisionTimestamp ?? gpulseDefaults.decisionTimestamp,
    lastAction: p?.lastAction ?? gpulseDefaults.lastAction,
    lastExecutionTime: p?.lastExecutionTime ?? gpulseDefaults.lastExecutionTime,
    executionLatency: p?.executionLatency ?? gpulseDefaults.executionLatency,
    performanceTrend: p?.performanceTrend ?? gpulseDefaults.performanceTrend,
    learningState: p?.learningState ?? gpulseDefaults.learningState,
    confidenceHistory: p?.confidenceHistory ?? gpulseDefaults.confidenceHistory,
    lastLearningAt: p?.lastLearningAt ?? gpulseDefaults.lastLearningAt,
  };
})();

const realtimeWsDefaults: RealtimeWsState = {
  connected: false,
  reconnecting: true,
  lastLiveAt: 0,
};

const dashboardUserDefaults: GenesisDashboardUserState = {
  id: null,
  email: undefined,
  wallet: undefined,
  balance: undefined,
  networkStats: undefined,
};

const dashboardDefaults: GenesisDashboardSlice = {
  user: { ...dashboardUserDefaults },
  recentActivity: [],
  transactions: [],
};

function readPersistedDashboard(): Partial<GenesisDashboardSlice> | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GENESIS_DASHBOARD);
    if (!raw) return null;
    const j = JSON.parse(raw) as Record<string, unknown>;
    const u = j.user;
    const activity = j.recentActivity;
    const partial: Partial<GenesisDashboardSlice> = {};
    if (u && typeof u === 'object' && !Array.isArray(u)) {
      const o = u as Record<string, unknown>;
      partial.user = {
        id: typeof o.id === 'string' ? o.id : o.id === null ? null : dashboardUserDefaults.id,
        ...(typeof o.email === 'string' ? { email: o.email } : {}),
        ...(typeof o.wallet === 'string' ? { wallet: o.wallet } : {}),
        ...(Number.isFinite(Number(o.balance)) ? { balance: Number(o.balance) } : {}),
        ...(o.networkStats && typeof o.networkStats === 'object' && !Array.isArray(o.networkStats)
          ? {
              networkStats: normalizeNetworkStats(o.networkStats as Record<string, unknown>),
            }
          : {}),
      };
    }
    const tx = j.transactions;
    const rawList = Array.isArray(activity) ? activity : Array.isArray(tx) ? tx : null;
    if (rawList) {
      const act = rawList
        .filter((x) => x && typeof x === 'object')
        .map((x) => x as ActivityItem)
        .filter((x) => typeof x.id === 'string' && typeof x.type === 'string' && typeof x.title === 'string')
        .slice(0, 40);
      partial.recentActivity = act;
      partial.transactions = act;
    }
    return partial;
  } catch {
    return null;
  }
}

function normalizeNetworkStats(o: Record<string, unknown>): NetworkData {
  return {
    referrals: Number.isFinite(Number(o.referrals)) ? Number(o.referrals) : 0,
    volume: Number.isFinite(Number(o.volume)) ? Number(o.volume) : 0,
    rank: typeof o.rank === 'string' ? o.rank : '—',
  };
}

function persistDashboardSlice(d: GenesisDashboardSlice) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEYS.GENESIS_DASHBOARD,
      JSON.stringify({
        user: d.user,
        recentActivity: d.recentActivity.slice(0, 30),
        transactions: d.transactions.slice(0, 30),
      }),
    );
  } catch {
    /* quota */
  }
}

const initialDashboard: GenesisDashboardSlice = (() => {
  const p = readPersistedDashboard();
  const act = p?.recentActivity ?? p?.transactions ?? dashboardDefaults.recentActivity;
  return {
    user: {
      ...dashboardUserDefaults,
      ...p?.user,
      networkStats: p?.user?.networkStats ?? dashboardUserDefaults.networkStats,
    },
    recentActivity: act,
    transactions: act,
  };
})();

const initial = {
  user: null as GenesisUser | null,
  wallet: null as WalletSnapshot | null,
  token: null as string | null,
  isAuthenticated: false,
  systemMode: 'NORMAL' as SystemMode,
  dashboard: initialDashboard,
  genesisModulesSyncedAt: 0,
  gpulse: initialGpulse,
  realtimeWs: { ...realtimeWsDefaults },
};

function patchGpulse(
  set: (fn: (s: GenesisStoreState) => Partial<GenesisStoreState>) => void,
  partial: Partial<GpulseState>,
) {
  set((s) => {
    const next: GpulseState = { ...s.gpulse, ...partial };
    persistGpulseSlice(next);
    emit('gpulse:connection', {
      connected: next.connected,
      lastSync: next.lastSync,
      status: next.status,
    });
    return { gpulse: next };
  });
}

function relayEmit(r: ExecutionRelay) {
  if (r.type === 'control') emit('gpulse:control', { action: r.action });
  else if (r.type === 'strategy') emit('gpulse:strategy', { value: r.value });
  else emit('gpulse:safety', { enabled: r.enabled });
}

function patchGpulseRealtime(
  set: (fn: (s: GenesisStoreState) => Partial<GenesisStoreState>) => void,
  input: GpulseRealtimePayload,
) {
  set((s) => {
    const next: GpulseState = {
      ...s.gpulse,
      status: input.status,
      strategy: input.strategy,
      safeMode: input.safeMode,
      lastExecutionTime: input.timestamp,
    };
    if (input.autoMode !== undefined) next.autoMode = input.autoMode;
    if (input.modelConfidence !== undefined && Number.isFinite(input.modelConfidence)) {
      next.modelConfidence = Math.min(1, Math.max(0, input.modelConfidence));
    }
    if (input.performanceTrend !== undefined && isPerformanceTrend(input.performanceTrend)) {
      next.performanceTrend = input.performanceTrend;
    }
    if (input.learningState !== undefined && typeof input.learningState === 'string') {
      next.learningState = input.learningState;
    }
    persistGpulseSlice(next);
    emit('gpulse:realtime:update', {
      status: input.status,
      strategy: input.strategy,
      safeMode: input.safeMode,
      timestamp: input.timestamp,
      source: input.source,
    });
    return {
      gpulse: next,
      realtimeWs: { ...s.realtimeWs, lastLiveAt: Date.now() },
    };
  });
}

export const useGenesisStore = create<GenesisStoreState>((set) => ({
  ...initial,
  setRealtimeWsSlice: (partial) =>
    set((s) => ({
      realtimeWs: { ...s.realtimeWs, ...partial },
    })),
  setUser: (user) =>
    set((s) => {
      const next = {
        user,
        isAuthenticated: Boolean(user || s.token),
      };
      return next;
    }),
  setWallet: (wallet) => set({ wallet }),
  setUserData: (payload) =>
    set((s) => {
      const nextUser: GenesisDashboardUserState = {
        ...s.dashboard.user,
        ...payload,
        id: payload.id !== undefined ? payload.id : s.dashboard.user.id,
      };
      const next: GenesisDashboardSlice = { ...s.dashboard, user: nextUser };
      persistDashboardSlice(next);
      return { dashboard: next };
    }),
  setWalletData: (payload) =>
    set((s) => {
      const nextUser: GenesisDashboardUserState = { ...s.dashboard.user, ...payload };
      const next: GenesisDashboardSlice = { ...s.dashboard, user: nextUser };
      persistDashboardSlice(next);
      return { dashboard: next };
    }),
  setNetworkData: (payload) =>
    set((s) => {
      const nextUser: GenesisDashboardUserState = {
        ...s.dashboard.user,
        networkStats: payload.networkStats,
      };
      const next: GenesisDashboardSlice = { ...s.dashboard, user: nextUser };
      persistDashboardSlice(next);
      return { dashboard: next };
    }),
  setRecentActivity: (items) =>
    set((s) => {
      const sliced = items.slice(0, 40);
      const next: GenesisDashboardSlice = {
        ...s.dashboard,
        recentActivity: sliced,
        transactions: sliced,
      };
      persistDashboardSlice(next);
      return { dashboard: next };
    }),
  setGenesisModulesSyncedAt: (t) => set({ genesisModulesSyncedAt: t }),
  setToken: (token) =>
    set({
      token,
      isAuthenticated: Boolean(token),
    }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setSystemMode: (systemMode) => {
    set({ systemMode });
    emit('system:mode', { mode: String(systemMode) });
  },
  setGpulseConnected: (connected) => {
    patchGpulse(set, { connected });
  },
  setGpulseStatus: (status) => {
    patchGpulse(set, { status });
  },
  setGpulseSlice: (partial) => {
    patchGpulse(set, partial);
  },
  applyExecutionResult: (input) => {
    if (!input.success) {
      emit('gpulse:execution:confirmed', {
        success: false,
        action: input.action,
        latencyMs: input.latencyMs,
        timestamp: input.timestamp,
        error: input.error,
      });
      return;
    }

    set((s) => {
      let next: GpulseState = { ...s.gpulse };
      next.lastAction = input.action;
      next.lastExecutionTime = input.timestamp;
      next.executionLatency = input.latencyMs;

      if (input.status != null) next.status = input.status;
      if (input.strategy != null) next.strategy = input.strategy;
      if (input.safeMode != null) next.safeMode = input.safeMode;
      if (input.autoMode !== undefined) next.autoMode = input.autoMode;
      if (input.modelConfidence !== undefined && Number.isFinite(input.modelConfidence)) {
        next.modelConfidence = Math.min(1, Math.max(0, input.modelConfidence));
      }

      persistGpulseSlice(next);
      emit('gpulse:connection', {
        connected: next.connected,
        lastSync: next.lastSync,
        status: next.status,
      });
      emit('gpulse:execution:confirmed', {
        success: true,
        action: input.action,
        latencyMs: input.latencyMs,
        timestamp: input.timestamp,
      });
      if (input.relay) {
        relayEmit(input.relay);
      }
      return { gpulse: next };
    });
  },
  applyGpulseRealtimePayload: (input) => {
    const st = input.status;
    if (!['idle', 'running', 'paused', 'syncing'].includes(st)) return;
    if (!isStrategy(input.strategy)) return;
    if (typeof input.safeMode !== 'boolean') return;
    const timestamp = Number.isFinite(input.timestamp) ? input.timestamp : Date.now();
    const source = input.source === 'snapshot' ? 'snapshot' : 'websocket';
    patchGpulseRealtime(set, {
      status: st,
      strategy: input.strategy,
      safeMode: input.safeMode,
      timestamp,
      source,
      autoMode: input.autoMode,
      modelConfidence: input.modelConfidence,
    });
  },
  applyGpulseAiDecision: (input) => {
    set((s) => {
      const conf = Math.min(1, Math.max(0, input.confidence));
      const ts = Number.isFinite(input.timestamp) ? input.timestamp : Date.now();
      const next: GpulseState = {
        ...s.gpulse,
        lastDecision: input.action,
        decisionConfidence: conf,
        decisionReason: input.reason,
        decisionTimestamp: ts,
      };
      persistGpulseSlice(next);
      emit('gpulse:ai:decision', {
        action: input.action,
        confidence: conf,
        reason: input.reason,
        timestamp: ts,
      });
      emit('gpulse:ai:update', {
        lastDecision: next.lastDecision,
        decisionConfidence: conf,
        decisionReason: input.reason,
        decisionTimestamp: ts,
      });
      return {
        gpulse: next,
        realtimeWs: { ...s.realtimeWs, lastLiveAt: Date.now() },
      };
    });
  },
  applyGpulseLearningUpdate: (input) => {
    if (!isStrategy(input.strategy)) return;
    set((s) => {
      const trend = isPerformanceTrend(input.performanceTrend)
        ? input.performanceTrend
        : s.gpulse.performanceTrend;
      const conf = Math.min(1, Math.max(0, input.modelConfidence));
      const hist = [...s.gpulse.confidenceHistory, conf].slice(-32);
      const now = Date.now();
      const next: GpulseState = {
        ...s.gpulse,
        modelConfidence: conf,
        performanceTrend: trend,
        learningState: input.learningState,
        strategy: input.strategy,
        confidenceHistory: hist,
        lastLearningAt: now,
      };
      persistGpulseSlice(next);
      emit('gpulse:learning:update', {
        modelConfidence: conf,
        performanceTrend: trend,
        strategy: input.strategy,
        learningState: input.learningState,
        lastOutcome: input.lastOutcome,
      });
      return {
        gpulse: next,
        realtimeWs: { ...s.realtimeWs, lastLiveAt: now },
      };
    });
  },
  applyGpulseStrategyAuto: (input) => {
    if (!isStrategy(input.strategy)) return;
    if (!isStrategy(input.previousStrategy)) return;
    set((s) => {
      const trend = isPerformanceTrend(input.performanceTrend)
        ? input.performanceTrend
        : s.gpulse.performanceTrend;
      const conf = Math.min(1, Math.max(0, input.modelConfidence));
      const now = Date.now();
      const next: GpulseState = {
        ...s.gpulse,
        strategy: input.strategy,
        modelConfidence: conf,
        performanceTrend: trend,
        learningState: input.learningState,
        lastLearningAt: now,
      };
      persistGpulseSlice(next);
      emit('gpulse:strategy:auto', {
        modelConfidence: conf,
        performanceTrend: trend,
        strategy: input.strategy,
        previousStrategy: input.previousStrategy,
        learningState: input.learningState,
      });
      emit('gpulse:strategy', { value: input.strategy });
      return {
        gpulse: next,
        realtimeWs: { ...s.realtimeWs, lastLiveAt: now },
      };
    });
  },
  toggleAutoMode: () => {
    set((s) => {
      const nextAuto = !s.gpulse.autoMode;
      const next: GpulseState = { ...s.gpulse, autoMode: nextAuto };
      persistGpulseSlice(next);
      emit('gpulse:auto:toggle', { enabled: nextAuto });
      return { gpulse: next };
    });
  },
  applyAuthSync: ({ token, user }) => {
    set({
      token,
      user,
      isAuthenticated: Boolean(token),
    });
    emit('auth:updated', { token, user });
  },
  reset: () =>
    set({
      ...initial,
      dashboard: {
        user: { ...dashboardUserDefaults },
        recentActivity: [],
        transactions: [],
      },
      genesisModulesSyncedAt: 0,
      gpulse: { ...gpulseDefaults },
      realtimeWs: { ...realtimeWsDefaults },
    }),
}));
