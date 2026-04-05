/**
 * Lightweight pub/sub for cross-cutting concerns (auth, G-Pulse link, system mode).
 * Keeps modules decoupled from React tree depth.
 */

/** Connection/execution: `syncing` = handshake; `paused` = operator or engine hold (reserved for future wiring). */
export type GpulseRuntimeStatus = 'idle' | 'running' | 'syncing' | 'paused';

export type GpulseStrategy = 'speed' | 'balanced' | 'protection';

export type GpulsePerformanceTrend = 'improving' | 'declining' | 'stable';

export type GpulseDecisionOutcome = 'win' | 'loss' | 'neutral';

export type GenesisEventMap = {
  'auth:updated': { token: string | null; user: unknown };
  'gpulse:connection': { connected: boolean; lastSync: number; status: GpulseRuntimeStatus };
  'gpulse:handshake': { ok: boolean; latencyMs?: number };
  'gpulse:control': { action: 'start' | 'pause' };
  'gpulse:strategy': { value: GpulseStrategy };
  'gpulse:safety': { enabled: boolean };
  'gpulse:execution:confirmed': {
    success: boolean;
    action: string;
    latencyMs: number;
    timestamp: number;
    error?: string;
  };
  'gpulse:realtime:update': {
    status: GpulseRuntimeStatus;
    strategy: GpulseStrategy;
    safeMode: boolean;
    timestamp: number;
    source: 'websocket' | 'snapshot';
  };
  'gpulse:ai:decision': {
    action: string;
    confidence: number;
    reason: string;
    timestamp: number;
  };
  /** Frontend-normalized AI slice after WS `gpulse:ai:decision`. */
  'gpulse:ai:update': {
    lastDecision: string | null;
    decisionConfidence: number;
    decisionReason: string;
    decisionTimestamp: number;
  };
  'gpulse:auto:toggle': { enabled: boolean };
  'gpulse:learning:update': {
    modelConfidence: number;
    performanceTrend: GpulsePerformanceTrend;
    strategy: GpulseStrategy;
    learningState: string;
    lastOutcome?: GpulseDecisionOutcome;
  };
  'gpulse:strategy:auto': {
    modelConfidence: number;
    performanceTrend: GpulsePerformanceTrend;
    strategy: GpulseStrategy;
    previousStrategy: GpulseStrategy;
    learningState: string;
  };
  'system:mode': { mode: string };
};

type Handler<T> = (payload: T) => void;

const listeners = new Map<string, Set<Handler<unknown>>>();

function keyOf<K extends keyof GenesisEventMap>(event: K): string {
  return event;
}

export function emit<K extends keyof GenesisEventMap>(event: K, payload: GenesisEventMap[K]): void {
  const set = listeners.get(keyOf(event));
  if (!set) return;
  for (const fn of set) {
    try {
      (fn as Handler<GenesisEventMap[K]>)(payload);
    } catch {
      /* isolate subscriber failures */
    }
  }
}

export function subscribe<K extends keyof GenesisEventMap>(
  event: K,
  callback: Handler<GenesisEventMap[K]>,
): () => void {
  const k = keyOf(event);
  let set = listeners.get(k);
  if (!set) {
    set = new Set();
    listeners.set(k, set);
  }
  set.add(callback as Handler<unknown>);
  return () => {
    set?.delete(callback as Handler<unknown>);
    if (set?.size === 0) listeners.delete(k);
  };
}
