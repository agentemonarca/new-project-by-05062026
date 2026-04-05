import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { GPULSE_STATE, useGpulseRuntime, useGpulseSystem } from '../../context/GpulseContext.jsx';
import { useRenderCount } from '../../hooks/useRenderCount.js';
import { DEFAULT_SYSTEM_MODE, resolveIdleVisualTier } from '../../system/decisionEngine.js';
import { SYSTEM_CORE_PHASE, useGpulseSystemCore } from '../../context/GpulseSystemCoreContext.jsx';

/** When global context is still IDLE, mirror derived TX / runtime phase so the core stays alive. */
function fallbackVisualState(phase) {
  switch (phase) {
    case SYSTEM_CORE_PHASE.PROCESSING:
      return GPULSE_STATE.PROCESSING;
    case SYSTEM_CORE_PHASE.CONFIRMING:
      return GPULSE_STATE.CONFIRMING;
    case SYSTEM_CORE_PHASE.SUCCESS:
      return GPULSE_STATE.SUCCESS;
    case SYSTEM_CORE_PHASE.ERROR:
      return GPULSE_STATE.ERROR;
    default:
      return GPULSE_STATE.IDLE;
  }
}

function deriveOrganStress(health) {
  if (!health || typeof health !== 'object') return 'healthy';
  if (health.riskLevel === 'high' || health.network === 'offline') return 'high';
  if (health.riskLevel === 'medium' || health.mempool === 'congested') return 'medium';
  if (
    health.network === 'degraded' ||
    health.backend === 'lagging' ||
    health.signer === 'delayed' ||
    health.signer === 'error'
  ) {
    return 'degraded';
  }
  return 'healthy';
}

function gpulseFloatingMeta(state) {
  switch (state) {
    case GPULSE_STATE.PROCESSING:
      return {
        tooltip: 'Processing…',
        ariaLabel: 'G-Pulse core — processing',
      };
    case GPULSE_STATE.SIGNING:
      return {
        tooltip: 'Awaiting signature…',
        ariaLabel: 'G-Pulse core — signing',
      };
    case GPULSE_STATE.BROADCASTING:
      return {
        tooltip: 'Broadcasting…',
        ariaLabel: 'G-Pulse core — broadcasting',
      };
    case GPULSE_STATE.CONFIRMING:
      return {
        tooltip: 'Confirming…',
        ariaLabel: 'G-Pulse core — confirming',
      };
    case GPULSE_STATE.SUCCESS:
      return {
        tooltip: 'Complete',
        ariaLabel: 'G-Pulse core — complete',
      };
    case GPULSE_STATE.ERROR:
      return {
        tooltip: 'Needs attention',
        ariaLabel: 'G-Pulse core — error',
      };
    default:
      return {
        tooltip: 'System active — ready',
        ariaLabel: 'G-Pulse system core — ready',
      };
  }
}

/**
 * Floating system core — prefers global GpulseContext; falls back to GpulseSystemCore when global is IDLE.
 */
const GpulseSystemCoreIndicator = React.memo(function GpulseSystemCoreIndicator({ isLight, onActivate }) {
  useRenderCount('GpulseSystemCoreIndicator');
  const { state: globalState } = useGpulseRuntime();
  const { systemHealth, systemMode } = useGpulseSystem();
  const { phase: derivedPhase } = useGpulseSystemCore();

  const safeSystemMode =
    typeof systemMode === 'string' ? systemMode : DEFAULT_SYSTEM_MODE;

  const state = useMemo(() => {
    if (globalState !== GPULSE_STATE.IDLE) return globalState;
    return fallbackVisualState(derivedPhase);
  }, [globalState, derivedPhase]);

  const organStress = useMemo(() => deriveOrganStress(systemHealth), [systemHealth]);
  const idleTier = useMemo(() => resolveIdleVisualTier(safeSystemMode, organStress), [safeSystemMode, organStress]);
  const idleStressActive = state === GPULSE_STATE.IDLE;

  const { tooltip, ariaLabel } = useMemo(() => gpulseFloatingMeta(state), [state]);

  const breatheTransition = useMemo(() => {
    if (idleStressActive && idleTier === 'protection') {
      return { duration: 0.55, repeat: Infinity, ease: 'easeInOut' };
    }
    if (idleStressActive && idleTier === 'caution') {
      return { duration: 1.15, repeat: Infinity, ease: 'easeInOut' };
    }
    if (idleStressActive && idleTier === 'delayed') {
      return { duration: 3.35, repeat: Infinity, ease: 'easeInOut' };
    }
    if (state === GPULSE_STATE.ERROR) return { duration: 0.42, ease: 'easeInOut' };
    if (state === GPULSE_STATE.SUCCESS) {
      return { duration: 0.58, ease: [0.22, 1, 0.36, 1], times: [0, 0.35, 0.72, 1] };
    }
    if (state === GPULSE_STATE.CONFIRMING) {
      return { duration: 2.4, repeat: Infinity, ease: 'easeInOut' };
    }
    if (state === GPULSE_STATE.BROADCASTING) {
      return { duration: 0.92, repeat: Infinity, ease: 'easeInOut' };
    }
    if (state === GPULSE_STATE.PROCESSING) {
      return { duration: 1.12, repeat: Infinity, ease: 'easeInOut' };
    }
    if (state === GPULSE_STATE.SIGNING) {
      return { duration: 3.15, repeat: Infinity, ease: 'easeInOut' };
    }
    return { duration: 2.85, repeat: Infinity, ease: 'easeInOut' };
  }, [state, idleStressActive, idleTier]);

  const breatheAnimate = useMemo(() => {
    if (idleStressActive && idleTier === 'protection') {
      return {
        scale: [1, 1.05, 0.98, 1.04, 1],
        x: [0, -4, 3, -2, 4, 0],
        rotate: [0, -1.2, 1.2, -0.8, 0],
      };
    }
    if (idleStressActive && idleTier === 'caution') {
      return {
        scale: [1, 1.05, 1, 1.04, 1],
      };
    }
    if (idleStressActive && idleTier === 'delayed') {
      return { scale: [1, 1.035, 1, 1.028, 1], x: [0, -1.5, 1.5, -1, 0] };
    }
    if (state === GPULSE_STATE.ERROR) {
      return { scale: 1, x: [0, -5, 5, -3, 3, 0], rotate: [0, -2, 2, 0] };
    }
    if (state === GPULSE_STATE.SUCCESS) {
      return { scale: [1, 1.22, 1.04, 1] };
    }
    if (state === GPULSE_STATE.CONFIRMING) {
      return { scale: [1, 1.025, 1] };
    }
    if (state === GPULSE_STATE.BROADCASTING) {
      return { scale: [1, 1.09, 1] };
    }
    if (state === GPULSE_STATE.PROCESSING) {
      return { scale: [1, 1.075, 1] };
    }
    if (state === GPULSE_STATE.SIGNING) {
      return { scale: [1, 1.06, 1] };
    }
    return { scale: [1, 1.06, 1] };
  }, [state, idleStressActive, idleTier]);

  const surface = isLight
    ? 'bg-white/92 text-cyan-600'
    : 'bg-[rgba(6,14,32,0.9)] text-cyan-200';

  const ringTone = useMemo(() => {
    if (idleStressActive && idleTier === 'protection') {
      return 'border-red-500/50 shadow-[0_0_28px_rgba(239,68,68,0.5)]';
    }
    if (idleStressActive && idleTier === 'caution') {
      return 'border-orange-400/50 shadow-[0_0_26px_rgba(251,146,60,0.42)]';
    }
    if (idleStressActive && idleTier === 'delayed') {
      return 'border-amber-400/48 shadow-[0_0_22px_rgba(250,204,21,0.35)]';
    }
    if (state === GPULSE_STATE.ERROR) {
      return 'border-red-400/55 shadow-[0_0_26px_rgba(239,68,68,0.55)]';
    }
    if (state === GPULSE_STATE.SUCCESS) {
      return 'border-emerald-400/55 shadow-[0_0_40px_rgba(52,211,153,0.52)]';
    }
    if (state === GPULSE_STATE.CONFIRMING) {
      return 'border-cyan-400/70 shadow-[0_0_36px_rgba(34,211,238,0.68)]';
    }
    if (state === GPULSE_STATE.BROADCASTING) {
      return 'border-cyan-400/60 shadow-[0_0_38px_rgba(34,211,238,0.68)]';
    }
    if (state === GPULSE_STATE.PROCESSING) {
      return 'border-cyan-400/55 shadow-[0_0_32px_rgba(34,211,238,0.55)]';
    }
    if (state === GPULSE_STATE.SIGNING) {
      return 'border-violet-400/55 shadow-[0_0_28px_rgba(167,139,250,0.45),0_0_48px_rgba(139,92,246,0.22)]';
    }
    return 'border-cyan-400/45 shadow-[0_0_20px_rgba(34,211,238,0.38)]';
  }, [state, idleStressActive, idleTier]);

  const innerGradient = useMemo(() => {
    if (idleStressActive && idleTier === 'protection') {
      return 'from-red-500/18 via-transparent to-orange-500/10';
    }
    if (idleStressActive && idleTier === 'caution') {
      return 'from-orange-400/16 via-transparent to-amber-500/10';
    }
    if (idleStressActive && idleTier === 'delayed') {
      return 'from-amber-400/14 via-transparent to-yellow-500/8';
    }
    if (state === GPULSE_STATE.SIGNING) {
      return 'from-violet-400/22 via-transparent to-fuchsia-500/12';
    }
    return 'from-cyan-400/15 via-transparent to-blue-500/10';
  }, [state, idleStressActive, idleTier]);

  const showSpinRing =
    state === GPULSE_STATE.PROCESSING ||
    state === GPULSE_STATE.BROADCASTING;
  const spinDurationClass =
    state === GPULSE_STATE.BROADCASTING
      ? 'motion-safe:animate-[spin_1.65s_linear_infinite]'
      : 'motion-safe:animate-[spin_2.1s_linear_infinite]';

  const showConfRing = state === GPULSE_STATE.CONFIRMING;

  const iconClass =
    state === GPULSE_STATE.ERROR
      ? isLight
        ? 'text-red-600'
        : 'text-red-400'
      : state === GPULSE_STATE.SUCCESS
        ? isLight
          ? 'text-emerald-600'
          : 'text-emerald-300'
        : state === GPULSE_STATE.SIGNING
          ? isLight
            ? 'text-violet-600'
            : 'text-violet-300'
          : idleStressActive && idleTier === 'protection'
            ? isLight
              ? 'text-red-600'
              : 'text-red-400'
            : idleStressActive && idleTier === 'caution'
              ? isLight
                ? 'text-orange-600'
                : 'text-orange-300'
              : idleStressActive && idleTier === 'delayed'
                ? isLight
                  ? 'text-amber-600'
                  : 'text-amber-300'
                : isLight
                  ? 'text-cyan-600'
                  : 'text-cyan-300';

  const innerPulseProps =
    idleStressActive && idleTier === 'caution'
      ? {
          animate: { opacity: [0.55, 0.82, 0.58, 0.78, 0.55] },
          transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
        }
      : idleStressActive && idleTier === 'protection'
        ? {
            animate: { opacity: [0.5, 0.88, 0.48, 0.85, 0.52] },
            transition: { duration: 1.55, repeat: Infinity, ease: 'linear' },
          }
        : {};

  return (
    <motion.button
      type="button"
      title={tooltip}
      aria-label={ariaLabel}
      aria-live="polite"
      data-gpulse-global-state={state}
      onClick={onActivate}
      animate={breatheAnimate}
      transition={breatheTransition}
      className={`group fixed z-40 flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-visible rounded-full border backdrop-blur-md outline-none transition-[box-shadow,border-color] duration-300 focus-visible:ring-2 focus-visible:ring-cyan-400/50 max-lg:bottom-20 max-lg:right-5 lg:bottom-8 lg:right-6 pointer-events-auto ${surface} ${ringTone} hover:scale-[1.05] active:scale-[0.96]`}
      style={showSpinRing ? { willChange: 'transform' } : undefined}
    >
      <motion.span
        className={`pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br ${innerGradient} opacity-70 motion-reduce:opacity-40 ${
          state === GPULSE_STATE.IDLE && idleTier === 'normal' ? 'motion-safe:animate-pulse' : ''
        }`}
        aria-hidden
        {...innerPulseProps}
      />

      {showSpinRing ? (
        <span
          className={`pointer-events-none absolute inset-[-6px] rounded-full border-[1.5px] border-cyan-400/55 border-r-cyan-400/15 border-b-cyan-400/25 ${spinDurationClass}`}
          aria-hidden
        />
      ) : null}

      {showConfRing ? (
        <span
          className="pointer-events-none absolute inset-[-3px] rounded-full border border-cyan-300/55 motion-reduce:opacity-90 motion-safe:animate-pulse"
          aria-hidden
        />
      ) : null}

      <span className="pointer-events-none relative z-[1] flex items-center justify-center rounded-full">
        <Activity size={22} strokeWidth={2.25} aria-hidden className={iconClass} />
      </span>

      <span
        className={`pointer-events-none absolute bottom-full right-0 z-[1] mb-2 max-w-[200px] whitespace-normal rounded-lg border px-2.5 py-1.5 text-left text-[9px] font-black uppercase leading-snug tracking-wide opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 ${isLight ? 'border-cyan-500/25 bg-white/95 text-slate-800' : 'border-cyan-500/30 bg-[rgba(6,14,32,0.95)] text-cyan-100/95'}`}
        role="tooltip"
      >
        {tooltip}
      </span>
    </motion.button>
  );
});

export default GpulseSystemCoreIndicator;
