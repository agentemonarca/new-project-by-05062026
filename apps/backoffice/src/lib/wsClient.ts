import { useGenesisStore } from '@ai-genesis/state';
import { getEnv } from '@/config/env';

export function resolveGpulseWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL?.trim();
  if (explicit) {
    if (explicit.startsWith('ws://') || explicit.startsWith('wss://')) return explicit;
    const host = explicit.replace(/^\/\//, '');
    return host.includes('/') ? `ws://${host}` : `ws://${host}/ws`;
  }
  if (import.meta.env.DEV) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }
  const api = getEnv().apiGatewayUrl.replace(/\/$/, '');
  if (!api) return 'ws://127.0.0.1:4000/ws';
  return `${api.replace(/^http/, 'ws')}/ws`;
}

type WsMessage = {
  type?: string;
  payload?: {
    status?: string;
    strategy?: string;
    safeMode?: unknown;
    autoMode?: unknown;
    modelConfidence?: unknown;
    performanceTrend?: string;
    learningState?: unknown;
    timestamp?: number;
    action?: string;
    confidence?: unknown;
    reason?: string;
    previousStrategy?: string;
    lastOutcome?: string;
  };
};

function parsePerformanceTrend(
  v: unknown,
): 'improving' | 'declining' | 'stable' | undefined {
  if (v === 'improving' || v === 'declining' || v === 'stable') return v;
  return undefined;
}

/**
 * Maintains a WebSocket to api-gateway /ws; merges snapshots and gpulse:update into Zustand.
 * REST remains the primary command path; WS streams authoritative execution state.
 */
export function connectGpulseRealtimeWs(): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  function applyMessage(raw: string) {
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw) as WsMessage;
    } catch {
      return;
    }
    if (msg.type === 'gpulse:ai:decision') {
      const p = msg.payload;
      if (!p || typeof p !== 'object') return;
      if (typeof p.action !== 'string') return;
      const conf = Number(p.confidence);
      if (!Number.isFinite(conf)) return;
      const reason = typeof p.reason === 'string' ? p.reason : '';
      const ts = typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : Date.now();
      useGenesisStore.getState().applyGpulseAiDecision({
        action: p.action,
        confidence: conf,
        reason,
        timestamp: ts,
      });
      return;
    }
    if (msg.type === 'gpulse:learning:update') {
      const p = msg.payload;
      if (!p || typeof p !== 'object') return;
      const mc = Number(p.modelConfidence);
      if (!Number.isFinite(mc)) return;
      const trend = parsePerformanceTrend(p.performanceTrend);
      if (!trend) return;
      if (typeof p.strategy !== 'string' || !['speed', 'balanced', 'protection'].includes(p.strategy)) return;
      if (typeof p.learningState !== 'string') return;
      const lastOutcome = p.lastOutcome;
      useGenesisStore.getState().applyGpulseLearningUpdate({
        modelConfidence: mc,
        performanceTrend: trend,
        strategy: p.strategy as import('@ai-genesis/state').GpulseStrategy,
        learningState: p.learningState,
        ...(lastOutcome === 'win' || lastOutcome === 'loss' || lastOutcome === 'neutral'
          ? { lastOutcome }
          : {}),
      });
      return;
    }
    if (msg.type === 'gpulse:strategy:auto') {
      const p = msg.payload;
      if (!p || typeof p !== 'object') return;
      const mc = Number(p.modelConfidence);
      if (!Number.isFinite(mc)) return;
      const trend = parsePerformanceTrend(p.performanceTrend);
      if (!trend) return;
      if (typeof p.strategy !== 'string' || !['speed', 'balanced', 'protection'].includes(p.strategy)) return;
      if (typeof p.previousStrategy !== 'string' || !['speed', 'balanced', 'protection'].includes(p.previousStrategy))
        return;
      if (typeof p.learningState !== 'string') return;
      useGenesisStore.getState().applyGpulseStrategyAuto({
        modelConfidence: mc,
        performanceTrend: trend,
        strategy: p.strategy as import('@ai-genesis/state').GpulseStrategy,
        previousStrategy: p.previousStrategy as import('@ai-genesis/state').GpulseStrategy,
        learningState: p.learningState,
      });
      return;
    }
    if (msg.type !== 'gpulse:update' && msg.type !== 'gpulse:snapshot') return;
    const p = msg.payload;
    if (!p || typeof p !== 'object') return;
    const status = p.status;
    const strategy = p.strategy;
    if (typeof status !== 'string' || typeof strategy !== 'string') return;
    if (!['idle', 'running', 'paused', 'syncing'].includes(status)) return;
    if (!['speed', 'balanced', 'protection'].includes(strategy)) return;
    if (typeof p.safeMode !== 'boolean') return;
    const ts = typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : Date.now();
    const autoMode = p.autoMode;
    const modelConfidence = p.modelConfidence;
    const performanceTrend = parsePerformanceTrend(p.performanceTrend);
    const learningState = typeof p.learningState === 'string' ? p.learningState : undefined;
    useGenesisStore.getState().applyGpulseRealtimePayload({
      status: status as import('@ai-genesis/state').GpulseRuntimeStatus,
      strategy: strategy as import('@ai-genesis/state').GpulseStrategy,
      safeMode: p.safeMode,
      timestamp: ts,
      source: msg.type === 'gpulse:snapshot' ? 'snapshot' : 'websocket',
      ...(typeof autoMode === 'boolean' ? { autoMode } : {}),
      ...(typeof modelConfidence === 'number' && Number.isFinite(modelConfidence)
        ? { modelConfidence }
        : {}),
      ...(performanceTrend ? { performanceTrend } : {}),
      ...(learningState ? { learningState } : {}),
    });
  }

  function connect() {
    if (stopped) return;
    const url = resolveGpulseWsUrl();
    if (attempt > 0) {
      useGenesisStore.getState().setRealtimeWsSlice({ reconnecting: true });
    }

    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      attempt = 0;
      useGenesisStore.getState().setRealtimeWsSlice({ connected: true, reconnecting: false });
    };

    ws.onmessage = (ev) => {
      applyMessage(String(ev.data));
    };

    ws.onclose = () => {
      useGenesisStore.getState().setRealtimeWsSlice({ connected: false, reconnecting: true });
      ws = null;
      if (!stopped) scheduleReconnect();
    };

    ws.onerror = () => {
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }

  function scheduleReconnect() {
    if (stopped) return;
    const delay = Math.min(30_000, 800 * 2 ** Math.min(attempt, 6));
    attempt += 1;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connect(), delay);
  }

  connect();

  return () => {
    stopped = true;
    clearTimeout(reconnectTimer);
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
    ws = null;
    useGenesisStore.getState().setRealtimeWsSlice({ connected: false, reconnecting: false });
  };
}
