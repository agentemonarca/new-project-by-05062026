import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard, GlowContainer, NeonButton, PanelContainer } from '@ai-genesis/ui';
import { useGenesisStore } from '@ai-genesis/state';
import type { GpulseStrategy } from '@ai-genesis/state';
import {
  mapEngineToStatus,
  postGpulseAuto,
  postGpulseControl,
  postGpulseSafety,
  postGpulseStrategy,
  type GpulseApiStatus,
} from '@/api/gpulseExecution';
import InlineSpinner from '@/components/system/InlineSpinner';

function statusExtras(st: GpulseApiStatus) {
  return {
    ...(typeof st.autoMode === 'boolean' ? { autoMode: st.autoMode } : {}),
    ...(st.modelConfidence != null && Number.isFinite(st.modelConfidence)
      ? { modelConfidence: st.modelConfidence }
      : {}),
  };
}

const STRATEGIES: GpulseStrategy[] = ['speed', 'balanced', 'protection'];

function strategyLabel(s: GpulseStrategy): string {
  const m: Record<GpulseStrategy, string> = {
    speed: 'Speed',
    balanced: 'Balanced',
    protection: 'Protection',
  };
  return m[s];
}

type Pending =
  | null
  | { kind: 'control'; action: 'start' | 'pause' }
  | { kind: 'strategy'; value: GpulseStrategy }
  | { kind: 'safety' }
  | { kind: 'auto' };

/**
 * Control surface: UI → API Gateway → gpulse-api → Zustand + events (iframe relay after server ack).
 */
export default function ControlPanel() {
  const gpulse = useGenesisStore((s) => s.gpulse);
  const applyExecutionResult = useGenesisStore((s) => s.applyExecutionResult);
  const toggleAutoMode = useGenesisStore((s) => s.toggleAutoMode);

  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [okHint, setOkHint] = useState<string | null>(null);

  useEffect(() => {
    if (!okHint) return;
    const id = window.setTimeout(() => setOkHint(null), 2200);
    return () => window.clearTimeout(id);
  }, [okHint]);

  const busy = pending !== null;
  const controlPending = (a: 'start' | 'pause') =>
    pending?.kind === 'control' && pending.action === a;

  const running = gpulse.status === 'running';
  const paused = gpulse.status === 'paused';
  const safeBlocksStart = gpulse.safeMode;

  const runControl = useCallback(
    async (action: 'start' | 'pause') => {
      setError(null);
      setOkHint(null);
      if (action === 'start' && safeBlocksStart) {
        setError('Safe mode is ON — start is blocked. Turn off safe mode first.');
        return;
      }
      setPending({ kind: 'control', action });
      const actionKey = `control:${action}` as const;
      try {
        const { ok, latencyMs, data } = await postGpulseControl(action);
        const ts = data.timestamp ?? Date.now();
        const failed = !ok || data.success === false;
        if (failed) {
          const err =
            data.error === 'safe_mode_blocks_start'
              ? 'Server rejected start while safe mode is active.'
              : 'Control request failed.';
          applyExecutionResult({
            success: false,
            action: actionKey,
            latencyMs,
            timestamp: ts,
            error: typeof data.error === 'string' ? data.error : 'request_failed',
          });
          setError(err);
          return;
        }
        const st = data.status;
        if (!st) {
          applyExecutionResult({
            success: false,
            action: actionKey,
            latencyMs,
            timestamp: ts,
            error: 'missing_status',
          });
          setError('Invalid API response (missing status).');
          return;
        }
        applyExecutionResult({
          success: true,
          action: actionKey,
          latencyMs,
          timestamp: ts,
          status: mapEngineToStatus(st.engine),
          strategy: st.strategy,
          safeMode: st.safeMode,
          ...statusExtras(st),
          relay: { type: 'control', action },
        });
        setOkHint(action === 'start' ? 'Engine started — backend confirmed' : 'Engine paused — backend confirmed');
      } catch {
        const ts = Date.now();
        applyExecutionResult({
          success: false,
          action: actionKey,
          latencyMs: 0,
          timestamp: ts,
          error: 'network_error',
        });
        setError('Network error — is the API gateway running on port 4000?');
      } finally {
        setPending(null);
      }
    },
    [applyExecutionResult, safeBlocksStart],
  );

  const runStrategy = useCallback(
    async (value: GpulseStrategy) => {
      setError(null);
      setOkHint(null);
      setPending({ kind: 'strategy', value });
      const actionKey = `strategy:${value}` as const;
      try {
        const { ok, latencyMs, data } = await postGpulseStrategy(value);
        const ts = data.timestamp ?? Date.now();
        if (!ok || data.success === false) {
          applyExecutionResult({
            success: false,
            action: actionKey,
            latencyMs,
            timestamp: ts,
            error: typeof data.error === 'string' ? data.error : 'request_failed',
          });
          setError('Strategy update failed.');
          return;
        }
        const st = data.status;
        if (!st) {
          applyExecutionResult({
            success: false,
            action: actionKey,
            latencyMs,
            timestamp: ts,
            error: 'missing_status',
          });
          setError('Invalid API response (missing status).');
          return;
        }
        applyExecutionResult({
          success: true,
          action: actionKey,
          latencyMs,
          timestamp: ts,
          status: mapEngineToStatus(st.engine),
          strategy: st.strategy,
          safeMode: st.safeMode,
          ...statusExtras(st),
          relay: { type: 'strategy', value },
        });
        setOkHint(`Strategy set to ${value} — confirmed`);
      } catch {
        const ts = Date.now();
        applyExecutionResult({
          success: false,
          action: actionKey,
          latencyMs: 0,
          timestamp: ts,
          error: 'network_error',
        });
        setError('Network error — is the API gateway running?');
      } finally {
        setPending(null);
      }
    },
    [applyExecutionResult],
  );

  const runSafety = useCallback(
    async (enabled: boolean) => {
      setError(null);
      setOkHint(null);
      setPending({ kind: 'safety' });
      const actionKey = `safety:${enabled ? 'on' : 'off'}` as const;
      try {
        const { ok, latencyMs, data } = await postGpulseSafety(enabled);
        const ts = data.timestamp ?? Date.now();
        if (!ok || data.success === false) {
          applyExecutionResult({
            success: false,
            action: actionKey,
            latencyMs,
            timestamp: ts,
            error: typeof data.error === 'string' ? data.error : 'request_failed',
          });
          setError('Safety mode update failed.');
          return;
        }
        const st = data.status;
        if (!st) {
          applyExecutionResult({
            success: false,
            action: actionKey,
            latencyMs,
            timestamp: ts,
            error: 'missing_status',
          });
          setError('Invalid API response (missing status).');
          return;
        }
        applyExecutionResult({
          success: true,
          action: actionKey,
          latencyMs,
          timestamp: ts,
          status: mapEngineToStatus(st.engine),
          strategy: st.strategy,
          safeMode: st.safeMode,
          ...statusExtras(st),
          relay: { type: 'safety', enabled },
        });
        setOkHint(enabled ? 'Safe mode enabled — confirmed' : 'Safe mode disabled — confirmed');
      } catch {
        const ts = Date.now();
        applyExecutionResult({
          success: false,
          action: actionKey,
          latencyMs: 0,
          timestamp: ts,
          error: 'network_error',
        });
        setError('Network error — is the API gateway running?');
      } finally {
        setPending(null);
      }
    },
    [applyExecutionResult],
  );

  const runAuto = useCallback(async () => {
    setError(null);
    setOkHint(null);
    toggleAutoMode();
    const desired = useGenesisStore.getState().gpulse.autoMode;
    setPending({ kind: 'auto' });
    const actionKey = `auto:${desired ? 'on' : 'off'}` as const;
    try {
      const { ok, latencyMs, data } = await postGpulseAuto(desired);
      const ts = data.timestamp ?? Date.now();
      if (!ok || data.success === false) {
        toggleAutoMode();
        applyExecutionResult({
          success: false,
          action: actionKey,
          latencyMs,
          timestamp: ts,
          error: typeof data.error === 'string' ? data.error : 'request_failed',
        });
        setError('Auto mode request failed.');
        return;
      }
      const st = data.status;
      if (!st) {
        toggleAutoMode();
        applyExecutionResult({
          success: false,
          action: actionKey,
          latencyMs,
          timestamp: ts,
          error: 'missing_status',
        });
        setError('Invalid API response (missing status).');
        return;
      }
      applyExecutionResult({
        success: true,
        action: actionKey,
        latencyMs,
        timestamp: ts,
        status: mapEngineToStatus(st.engine),
        strategy: st.strategy,
        safeMode: st.safeMode,
        ...statusExtras(st),
      });
      setOkHint(desired ? 'Autonomous mode ON — server confirmed' : 'Autonomous mode OFF — server confirmed');
    } catch {
      toggleAutoMode();
      const ts = Date.now();
      applyExecutionResult({
        success: false,
        action: actionKey,
        latencyMs: 0,
        timestamp: ts,
        error: 'network_error',
      });
      setError('Network error — is the API gateway running?');
    } finally {
      setPending(null);
    }
  }, [applyExecutionResult, toggleAutoMode]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-5xl"
    >
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.38em] text-fuchsia-300/70">Control layer</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-white">Operate G-Pulse</h2>
        <p className="mt-1 text-xs text-white/45">
          Commands go through the API gateway; the backend confirms execution, then the store and iframe stay in
          sync.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-[11px] text-rose-100/95">
          {error}
        </div>
      ) : null}

      {okHint ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/35 px-4 py-3 text-[11px] text-emerald-100/95">
          {okHint}
        </div>
      ) : null}

      {safeBlocksStart ? (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-950/35 px-4 py-3 text-[11px] text-amber-100/90">
          Safe mode is <span className="font-bold">ON</span> — engine start is disabled until you turn safe mode off
          (server will also reject start with HTTP 403).
        </div>
      ) : null}

      {gpulse.autoMode ? (
        <div className="mb-4 rounded-xl border border-fuchsia-500/35 bg-fuchsia-950/30 px-4 py-3 text-[11px] text-fuchsia-100/90 shadow-[0_0_28px_rgba(217,70,239,0.15)]">
          <span className="font-bold uppercase tracking-widest">Autonomous mode active</span>
          <p className="mt-1 text-white/55">
            The decision engine may start or pause the engine when rules match. You can turn this off anytime; pause
            still overrides immediately.
          </p>
        </div>
      ) : null}

      <motion.div
        className="mb-4"
        animate={
          gpulse.autoMode
            ? { boxShadow: ['0 0 0 rgba(0,240,255,0)', '0 0 32px rgba(0,240,255,0.12)', '0 0 0 rgba(0,240,255,0)'] }
            : {}
        }
        transition={{ duration: 2.8, repeat: gpulse.autoMode ? Infinity : 0, ease: 'easeInOut' }}
      >
        <GlowContainer className="rounded-2xl" accent="cyan">
          <GlassCard
            className={[
              '!p-0 border transition-[border-color,box-shadow] duration-500',
              gpulse.autoMode
                ? 'border-cyan-400/35 shadow-[0_0_40px_rgba(0,240,255,0.12)]'
                : 'border-white/[0.08]',
            ].join(' ')}
          >
            <PanelContainer title="Autonomous mode" subtitle="POST /api/gpulse/auto · server-side loop" accent="cyan">
              <button
                type="button"
                role="switch"
                aria-busy={pending?.kind === 'auto'}
                aria-checked={gpulse.autoMode}
                disabled={busy}
                onClick={() => void runAuto()}
                className="group flex w-full max-w-md items-center justify-between gap-4 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-left transition-all duration-300 hover:border-cyan-400/35 disabled:opacity-45 disabled:pointer-events-none"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/90">Auto mode</p>
                  <p className="mt-0.5 text-[10px] text-white/40">
                    OFF = advisory AI only · ON = engine may auto-start / pause per mock rules (blocked if safe mode)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pending?.kind === 'auto' ? <InlineSpinner className="h-4 w-4 text-cyan-300" /> : null}
                  <div
                    className="relative h-8 w-14 shrink-0 rounded-full border border-white/15"
                    style={{
                      background: gpulse.autoMode
                        ? 'linear-gradient(90deg, rgba(0,240,255,0.35) 0%, rgba(123,44,255,0.4) 100%)'
                        : 'rgba(0,0,0,0.35)',
                      boxShadow: gpulse.autoMode ? '0 0 24px rgba(0, 240, 255, 0.25)' : 'none',
                    }}
                  >
                    <motion.span
                      className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-md"
                      initial={false}
                      animate={{ x: gpulse.autoMode ? 28 : 4 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                      style={{ left: 0 }}
                    />
                  </div>
                </div>
              </button>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-white/30">
                {pending?.kind === 'auto' ? 'Syncing…' : gpulse.autoMode ? 'AUTO ON' : 'MANUAL'}
              </p>
            </PanelContainer>
          </GlassCard>
        </GlowContainer>
      </motion.div>

      <GlowContainer className="rounded-2xl" accent="magenta">
        <GlassCard glow className="border-fuchsia-500/15 !p-0">
          <PanelContainer title="Engine" subtitle="Start / pause via POST /api/gpulse/control" accent="magenta">
            <div className="flex flex-wrap gap-3">
              <motion.div whileTap={{ scale: busy ? 1 : 0.97 }} className="relative">
                <NeonButton
                  type="button"
                  disabled={busy || safeBlocksStart}
                  onClick={() => void runControl('start')}
                  className={[
                    'inline-flex items-center justify-center gap-2',
                    running ? 'ring-2 ring-cyan-400/50 ring-offset-2 ring-offset-[#070b14]' : '',
                  ].join(' ')}
                >
                  {controlPending('start') ? <InlineSpinner /> : null}
                  {controlPending('start') ? 'Starting…' : 'Start G-Pulse'}
                </NeonButton>
              </motion.div>
              <motion.div whileTap={{ scale: busy ? 1 : 0.97 }}>
                <NeonButton
                  type="button"
                  variant="magenta"
                  disabled={busy}
                  onClick={() => void runControl('pause')}
                  className={[
                    'inline-flex items-center justify-center gap-2',
                    paused ? 'ring-2 ring-fuchsia-400/50 ring-offset-2 ring-offset-[#070b14]' : '',
                  ].join(' ')}
                >
                  {controlPending('pause') ? <InlineSpinner /> : null}
                  {controlPending('pause') ? 'Pausing…' : 'Pause G-Pulse'}
                </NeonButton>
              </motion.div>
            </div>
            <p className="mt-3 font-mono text-[10px] text-white/35">
              Reversible: pause preserves link; execution state is owned by gpulse-api.
            </p>
          </PanelContainer>
        </GlassCard>
      </GlowContainer>

      <div className="mt-4">
        <GlowContainer className="rounded-2xl" accent="cyan">
          <GlassCard className="border-cyan-500/12 !p-0">
            <PanelContainer title="Execution strategy" subtitle="POST /api/gpulse/strategy" accent="cyan">
              <div className="flex flex-wrap gap-2 rounded-xl border border-white/[0.08] bg-black/30 p-1.5">
                {STRATEGIES.map((s) => {
                  const active = gpulse.strategy === s;
                  const isLoading = pending?.kind === 'strategy' && pending.value === s;
                  return (
                    <motion.button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => void runStrategy(s)}
                      className={[
                        'relative flex-1 min-w-[88px] rounded-lg px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all duration-300',
                        busy && !isLoading ? 'opacity-40 pointer-events-none' : '',
                        active
                          ? 'text-[#070b14]'
                          : 'border border-transparent text-white/45 hover:border-white/10 hover:text-white/75',
                        isLoading ? 'opacity-90' : '',
                      ].join(' ')}
                      style={
                        active
                          ? {
                              background: `linear-gradient(135deg, #00f0ff 0%, #7b2cff 100%)`,
                              boxShadow: `0 0 24px rgba(0, 240, 255, 0.25), inset 0 1px 0 rgba(255,255,255,0.2)`,
                            }
                          : { background: 'transparent' }
                      }
                      whileHover={{ scale: busy ? 1 : active ? 1 : 1.02 }}
                      whileTap={{ scale: busy ? 1 : 0.98 }}
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        {isLoading ? <InlineSpinner className="h-3 w-3" /> : null}
                        {isLoading ? 'Applying…' : strategyLabel(s)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </PanelContainer>
          </GlassCard>
        </GlowContainer>
      </div>

      <div className="mt-4">
        <GlowContainer className="rounded-2xl" accent="purple">
          <GlassCard className="border-purple-500/12 !p-0">
            <PanelContainer title="Safe mode" subtitle="POST /api/gpulse/safety" accent="purple">
              <button
                type="button"
                role="switch"
                aria-busy={pending?.kind === 'safety'}
                aria-checked={gpulse.safeMode}
                disabled={busy}
                onClick={() => void runSafety(!gpulse.safeMode)}
                className="group flex w-full max-w-sm items-center justify-between gap-4 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-left transition-all duration-300 hover:border-cyan-400/25 disabled:opacity-45 disabled:pointer-events-none"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/85">Safe mode</p>
                  <p className="mt-0.5 text-[10px] text-white/40">
                    Extra guardrails · start may be blocked while ON
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pending?.kind === 'safety' ? <InlineSpinner className="h-4 w-4 text-cyan-300" /> : null}
                <div
                  className="relative h-8 w-14 shrink-0 rounded-full border border-white/15"
                  style={{
                    background: gpulse.safeMode
                      ? 'linear-gradient(90deg, rgba(0,240,255,0.25) 0%, rgba(123,44,255,0.35) 100%)'
                      : 'rgba(0,0,0,0.35)',
                    boxShadow: gpulse.safeMode ? '0 0 20px rgba(0, 240, 255, 0.2)' : 'none',
                  }}
                >
                  <motion.span
                    className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-md"
                    initial={false}
                    animate={{ x: gpulse.safeMode ? 28 : 4 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                    style={{ left: 0 }}
                  />
                </div>
                </div>
              </button>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-white/30">
                {pending?.kind === 'safety' ? 'Applying…' : gpulse.safeMode ? 'ON' : 'OFF'}
              </p>
            </PanelContainer>
          </GlassCard>
        </GlowContainer>
      </div>
    </motion.div>
  );
}
