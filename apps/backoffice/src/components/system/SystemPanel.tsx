import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  GlassCard,
  GlowContainer,
  MetricCard,
  PanelContainer,
  SignalList,
  StatusBadge,
  type ConnectionBadgeVariant,
  type ExecutionBadgeVariant,
  type SignalEntry,
} from '@ai-genesis/ui';
import { useGenesisStore, subscribe } from '@ai-genesis/state';
import type { GpulsePerformanceTrend, GpulseRuntimeStatus, GpulseStrategy } from '@ai-genesis/state';

const MOCK_INTERVAL_MS = 4000;

function connectionVariant(connected: boolean, status: GpulseRuntimeStatus): ConnectionBadgeVariant {
  if (status === 'syncing') return 'syncing';
  if (connected) return 'connected';
  return 'offline';
}

function connectionLabel(v: ConnectionBadgeVariant): string {
  if (v === 'connected') return 'Connected';
  if (v === 'syncing') return 'Syncing';
  return 'Offline';
}

function executionVariant(status: GpulseRuntimeStatus): ExecutionBadgeVariant {
  if (status === 'paused') return 'paused';
  if (status === 'running') return 'running';
  if (status === 'syncing') return 'syncing';
  return 'idle';
}

function executionLabel(v: ExecutionBadgeVariant): string {
  const map: Record<ExecutionBadgeVariant, string> = {
    idle: 'Idle',
    running: 'Running',
    paused: 'Paused',
    syncing: 'Handshake',
  };
  return map[v];
}

function strategyLabel(s: GpulseStrategy): string {
  const map: Record<GpulseStrategy, string> = {
    speed: 'Speed',
    balanced: 'Balanced',
    protection: 'Protection',
  };
  return map[s];
}

function trendLabel(t: GpulsePerformanceTrend): string {
  const map: Record<GpulsePerformanceTrend, string> = {
    improving: 'Improving',
    declining: 'Declining',
    stable: 'Stable',
  };
  return map[t];
}

function trendTextClass(t: GpulsePerformanceTrend): string {
  if (t === 'improving') return 'text-emerald-300';
  if (t === 'declining') return 'text-rose-300';
  return 'text-amber-200';
}

function trendBarGradient(t: GpulsePerformanceTrend): string {
  if (t === 'improving') return 'from-emerald-400 via-teal-400 to-cyan-400';
  if (t === 'declining') return 'from-rose-500 via-orange-500 to-amber-600';
  return 'from-amber-400 via-yellow-400 to-lime-300';
}

function ConfidenceSparkline({ values }: { values: number[] }) {
  const gradId = useId().replace(/:/g, '');
  const w = 120;
  const h = 36;
  const slice = values.slice(-16);
  if (slice.length < 2) {
    return <p className="font-mono text-[9px] text-white/35">Collecting samples…</p>;
  }
  const min = Math.min(...slice, 0);
  const max = Math.max(...slice, 1);
  const span = max - min || 1;
  const pts = slice
    .map((v, i) => {
      const x = (i / (slice.length - 1)) * (w - 4) + 2;
      const y = h - 2 - ((v - min) / span) * (h - 6);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible opacity-90" aria-hidden>
      <polyline
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgb(52, 211, 153)" />
          <stop offset="100%" stopColor="rgb(34, 211, 238)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function nextId() {
  return `sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function friendlyExecutionMessage(action: string, success: boolean): string {
  if (!success) return `Execution failed (${action})`;
  if (action === 'control:start') return 'Engine started (confirmed)';
  if (action === 'control:pause') return 'Engine paused (confirmed)';
  if (action.startsWith('strategy:')) {
    const v = action.slice('strategy:'.length);
    return `Strategy updated: ${v}`;
  }
  if (action === 'safety:on') return 'Safe mode enabled';
  if (action === 'safety:off') return 'Safe mode disabled';
  return `Execution confirmed · ${action}`;
}

/**
 * Live system visualization for G-Pulse: Zustand + event bus + mock metrics (UI-only simulation).
 */
export default function SystemPanel() {
  const gpulse = useGenesisStore((s) => s.gpulse);

  const [signals, setSignals] = useState<SignalEntry[]>(() => [
    {
      id: nextId(),
      at: Date.now(),
      message: 'System intelligence layer online',
      detail: 'Subscribed to gpulse:connection · gpulse:handshake',
    },
  ]);

  const pushSignal = useCallback((message: string, detail?: string) => {
    setSignals((prev) => {
      const next: SignalEntry[] = [
        { id: nextId(), at: Date.now(), message, detail },
        ...prev,
      ];
      return next.slice(0, 24);
    });
  }, []);

  const lastConnKey = useRef<string>('');
  const lastHsKey = useRef<string>('');

  useEffect(() => {
    const offConn = subscribe('gpulse:connection', (p) => {
      const key = `${p.connected}|${p.status}|${p.lastSync}`;
      if (key === lastConnKey.current) return;
      lastConnKey.current = key;
      pushSignal(
        `Connection ${p.connected ? 'active' : 'inactive'}`,
        `status=${p.status} · lastSync=${p.lastSync ? new Date(p.lastSync).toISOString() : '—'}`,
      );
    });
    const offHs = subscribe('gpulse:handshake', (p) => {
      const key = `${p.ok}|${p.latencyMs ?? ''}`;
      if (key === lastHsKey.current) return;
      lastHsKey.current = key;
      pushSignal(
        p.ok ? 'PONG received — handshake OK' : 'Handshake timeout',
        p.latencyMs != null ? `RTT ≈ ${p.latencyMs}ms` : undefined,
      );
    });
    return () => {
      offConn();
      offHs();
    };
  }, [pushSignal]);

  useEffect(() => {
    const offRt = subscribe('gpulse:realtime:update', (p) => {
      const message =
        p.source === 'snapshot' ? 'Live snapshot synced' : 'Realtime update received';
      pushSignal(message, new Date(p.timestamp).toISOString());
    });
    return () => offRt();
  }, [pushSignal]);

  useEffect(() => {
    const offAi = subscribe('gpulse:ai:update', (p) => {
      const d = p.lastDecision ?? '—';
      const shortReason =
        p.decisionReason.length > 140 ? `${p.decisionReason.slice(0, 140)}…` : p.decisionReason;
      pushSignal(
        `AI update · ${d}`,
        `${(p.decisionConfidence * 100).toFixed(1)}% · ${shortReason}`,
      );
    });
    return () => offAi();
  }, [pushSignal]);

  useEffect(() => {
    const offLearn = subscribe('gpulse:learning:update', (p) => {
      pushSignal(`Confidence updated → ${p.modelConfidence.toFixed(2)}`, `learningState=${p.learningState}`);
      pushSignal(`Performance trend → ${p.performanceTrend}`);
    });
    return () => offLearn();
  }, [pushSignal]);

  useEffect(() => {
    const offStrat = subscribe('gpulse:strategy:auto', (p) => {
      pushSignal(`AI adjusted strategy → ${p.strategy}`, `from ${p.previousStrategy} · model ${p.modelConfidence.toFixed(2)}`);
    });
    return () => offStrat();
  }, [pushSignal]);

  useEffect(() => {
    const offRelay = subscribe('gpulse:execution:confirmed', (p) => {
      const message = friendlyExecutionMessage(p.action, p.success);
      const detail = [
        new Date(p.timestamp).toISOString(),
        `latency ${p.latencyMs}ms`,
        p.success ? null : p.error ? `error=${p.error}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      pushSignal(message, detail);
    });
    return () => {
      offRelay();
    };
  }, [pushSignal]);

  /** UI-only mock metric (bounded random walk); engine modelConfidence comes from store / backend. */
  const [predictionAccuracy, setPredictionAccuracy] = useState(0.91);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPredictionAccuracy((v) => Math.min(0.995, Math.max(0.5, v + (Math.random() - 0.5) * 0.03)));
      pushSignal('Telemetry tick (mock)', 'Metrics refresh · display only');
    }, MOCK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [pushSignal]);

  const connVar = useMemo(
    () => connectionVariant(gpulse.connected, gpulse.status),
    [gpulse.connected, gpulse.status],
  );
  const execVar = useMemo(() => executionVariant(gpulse.status), [gpulse.status]);

  const lastSyncText =
    gpulse.lastSync > 0
      ? new Date(gpulse.lastSync).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'medium',
        })
      : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-5xl"
    >
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.38em] text-cyan-300/70">System intelligence</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-white">G-Pulse live control</h2>
        <p className="mt-1 text-xs text-white/45">
          Live stream, autonomous loop, and execution state — backend remains authoritative.
        </p>
      </div>

      <div className="mt-4">
        <GlowContainer className="rounded-2xl" accent="magenta">
          <motion.div
            layout
            animate={
              gpulse.autoMode
                ? { boxShadow: ['0 0 0 rgba(217,70,239,0)', '0 0 28px rgba(217,70,239,0.12)', '0 0 0 rgba(217,70,239,0)'] }
                : {}
            }
            transition={{ duration: 2.6, repeat: gpulse.autoMode ? Infinity : 0, ease: 'easeInOut' }}
            className="rounded-2xl"
          >
            <GlassCard
              className={[
                'border-fuchsia-500/10 !p-0 transition-[border-color,box-shadow] duration-500',
                gpulse.autoMode ? 'border-fuchsia-400/25 shadow-[0_0_36px_rgba(217,70,239,0.1)]' : '',
              ].join(' ')}
            >
              <PanelContainer
                title="AI Decisions"
                subtitle="gpulse:ai:decision → gpulse:ai:update · start / pause / hold"
                accent="magenta"
              >
                {gpulse.lastDecision != null && gpulse.decisionTimestamp > 0 ? (
                  <div className="space-y-3">
                    <motion.div
                      key={gpulse.decisionTimestamp}
                      initial={{ opacity: 0.75, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="font-mono text-sm font-bold uppercase tracking-widest text-fuchsia-200/95">
                        {gpulse.lastDecision}
                      </p>
                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-violet-500"
                          initial={false}
                          animate={{
                            width: `${Math.min(100, Math.max(0, gpulse.decisionConfidence * 100))}%`,
                          }}
                          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] font-mono text-white/50">
                        Confidence {(gpulse.decisionConfidence * 100).toFixed(1)}%
                      </p>
                      <p className="mt-3 text-[11px] leading-relaxed text-white/60">{gpulse.decisionReason}</p>
                      <p className="mt-2 font-mono text-[9px] text-white/35">
                        {new Date(gpulse.decisionTimestamp).toISOString()}
                      </p>
                    </motion.div>
                  </div>
                ) : (
                  <p className="text-[11px] text-white/40">Waiting for the decision loop — connect WebSocket + gpulse-api.</p>
                )}
              </PanelContainer>
            </GlassCard>
          </motion.div>
        </GlowContainer>
      </div>

      <div className="mt-4">
        <GlowContainer className="rounded-2xl" accent="cyan">
          <motion.div
            key={gpulse.lastLearningAt || 'idle'}
            animate={
              gpulse.lastLearningAt > 0
                ? {
                    boxShadow: [
                      '0 0 0 rgba(34,211,238,0)',
                      '0 0 22px rgba(34,211,238,0.14)',
                      '0 0 0 rgba(34,211,238,0)',
                    ],
                  }
                : {}
            }
            transition={{ duration: 0.85, ease: 'easeOut' }}
            className="rounded-2xl"
          >
            <GlassCard className="border-cyan-500/15 !p-0">
              <PanelContainer
                title="Adaptive Intelligence"
                subtitle="EMA learning · simulated outcomes · auto strategy (gpulse:learning:update)"
                accent="cyan"
              >
                <div className="space-y-4">
                  <div>
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-white/35">modelConfidence</p>
                        <p className="mt-0.5 font-mono text-lg font-bold text-white/90">
                          {gpulse.modelConfidence.toFixed(3)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[9px] uppercase tracking-widest text-white/35">performanceTrend</p>
                        <p className={`mt-0.5 text-sm font-bold ${trendTextClass(gpulse.performanceTrend)}`}>
                          {trendLabel(gpulse.performanceTrend)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${trendBarGradient(gpulse.performanceTrend)}`}
                        initial={false}
                        animate={{
                          width: `${Math.min(100, Math.max(0, gpulse.modelConfidence * 100))}%`,
                        }}
                        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] text-white/45">
                      learningState: <span className="font-mono text-white/65">{gpulse.learningState}</span> · strategy{' '}
                      <span className="font-mono text-white/65">{gpulse.strategy}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-white/35">Confidence evolution</p>
                      <div className="mt-1.5">
                        <ConfidenceSparkline values={gpulse.confidenceHistory} />
                      </div>
                    </div>
                    <p className="max-w-[14rem] text-[10px] leading-relaxed text-white/40">
                      Server applies EMA after each AI tick; strategy follows bands (&lt;0.6 protection, 0.6–0.8 balanced,
                      &gt;0.8 speed). Safe mode blocks auto execution only — learning continues.
                    </p>
                  </div>
                </div>
              </PanelContainer>
            </GlassCard>
          </motion.div>
        </GlowContainer>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlowContainer className="rounded-2xl" accent="cyan">
          <GlassCard glow className="h-full border-cyan-500/15 !p-0">
            <PanelContainer title="Connection status" subtitle="Iframe · PING/PONG · Zustand" accent="cyan">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge variant={connVar} label={connectionLabel(connVar)} style="connection" />
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/35">lastSync</p>
                  <p className="mt-1 font-mono text-sm text-white/85">{lastSyncText}</p>
                </div>
              </div>
            </PanelContainer>
          </GlassCard>
        </GlowContainer>

        <GlowContainer className="rounded-2xl" accent="purple">
          <GlassCard className="h-full border-purple-500/15 !p-0">
            <PanelContainer title="Execution state" subtitle="gpulse.status · WebSocket + REST" accent="purple">
              <motion.div
                layout
                className="flex flex-wrap items-center gap-3 transition-opacity duration-300 ease-out"
                key={gpulse.status}
                initial={{ opacity: 0.88 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                <StatusBadge variant={execVar} label={executionLabel(execVar)} style="execution" />
              </motion.div>
              <p className="mt-4 text-[11px] leading-relaxed text-white/45">
                Reflects the execution slice in the global store. Handshake uses <span className="text-white/60">syncing</span> during
                link negotiation.
              </p>
            </PanelContainer>
          </GlassCard>
        </GlowContainer>
      </div>

      <div className="mt-4">
        <GlowContainer className="rounded-2xl" accent="cyan">
          <GlassCard className="border-cyan-500/10 !p-0">
            <PanelContainer title="System metrics" subtitle="Store + mock telemetry" accent="cyan">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
                <MetricCard
                  label="modelConfidence"
                  value={gpulse.modelConfidence.toFixed(3)}
                  hint="0–1 · EMA + simulated outcomes"
                />
                <MetricCard
                  label="predictionAccuracy"
                  value={predictionAccuracy.toFixed(3)}
                  hint="0–1 · simulated drift"
                />
                <MetricCard
                  label="currentStrategy"
                  value={strategyLabel(gpulse.strategy)}
                  hint="REST + live stream"
                />
                <MetricCard
                  label="safeMode"
                  value={gpulse.safeMode ? 'ON' : 'OFF'}
                  hint="REST + live stream"
                />
                <MetricCard
                  label="autoMode"
                  value={gpulse.autoMode ? 'ON' : 'OFF'}
                  hint="autonomous execution gate"
                />
                <MetricCard
                  label="lastAction"
                  value={gpulse.lastAction ?? '—'}
                  hint="last pipeline action"
                />
                <MetricCard
                  label="lastExec / latency"
                  value={
                    gpulse.lastExecutionTime
                      ? `${new Date(gpulse.lastExecutionTime).toLocaleTimeString()} · ${gpulse.executionLatency != null ? `${gpulse.executionLatency}ms` : '—'}`
                      : '—'
                  }
                  hint="server ack time · round-trip"
                />
              </div>
            </PanelContainer>
          </GlassCard>
        </GlowContainer>
      </div>

      <div className="mt-4">
        <GlowContainer className="rounded-2xl" accent="magenta">
          <GlassCard className="border-fuchsia-500/10 !p-0">
            <PanelContainer
              title="Live signal feed"
              subtitle="Execution · realtime · AI decisions · telemetry"
              accent="magenta"
            >
              <SignalList entries={signals} maxVisible={12} emptyLabel="No signals yet." />
            </PanelContainer>
          </GlassCard>
        </GlowContainer>
      </div>
    </motion.div>
  );
}
