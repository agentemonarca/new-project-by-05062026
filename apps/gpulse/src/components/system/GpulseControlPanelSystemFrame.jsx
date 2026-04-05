import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { GPULSE_STATE, useGpulseRuntime, useGpulseSystem } from '../../context/GpulseContext.jsx';
import { DEFAULT_SYSTEM_MODE, resolveIdleVisualTier } from '../../system/decisionEngine.js';
import { SYSTEM_CORE_PHASE, useGpulseSystemCore } from '../../context/GpulseSystemCoreContext.jsx';

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

function panelTooltip(state) {
  switch (state) {
    case GPULSE_STATE.PROCESSING:
      return 'Processing…';
    case GPULSE_STATE.SIGNING:
      return 'Awaiting signature…';
    case GPULSE_STATE.BROADCASTING:
      return 'Broadcasting…';
    case GPULSE_STATE.CONFIRMING:
      return 'Confirming…';
    case GPULSE_STATE.SUCCESS:
      return 'Complete';
    case GPULSE_STATE.ERROR:
      return 'Needs attention';
    default:
      return 'G-Pulse panel — ready';
  }
}

/**
 * Left-rail G_Pulse panel chrome — prefers global GpulseContext, same effective state as floating core.
 * Visuals are intentionally softer than the floating orb (no layout shift, low distraction).
 */
export default React.memo(function GpulseControlPanelSystemFrame({ isLight, children }) {
  const { state: globalState } = useGpulseRuntime();
  const { systemHealth, systemMode } = useGpulseSystem();
  const { phase: derivedPhase } = useGpulseSystemCore();

  const safeSystemMode = typeof systemMode === 'string' ? systemMode : DEFAULT_SYSTEM_MODE;

  const state = useMemo(() => {
    if (globalState !== GPULSE_STATE.IDLE) return globalState;
    return fallbackVisualState(derivedPhase);
  }, [globalState, derivedPhase]);

  const organStress = useMemo(() => deriveOrganStress(systemHealth), [systemHealth]);
  const idleTier = useMemo(() => resolveIdleVisualTier(safeSystemMode, organStress), [safeSystemMode, organStress]);
  const idleOrgan = state === GPULSE_STATE.IDLE;

  const tooltip = useMemo(() => panelTooltip(state), [state]);

  const shellTransition = useMemo(() => {
    if (idleOrgan && idleTier === 'protection') return { duration: 0.9, repeat: Infinity, ease: 'easeInOut' };
    if (idleOrgan && idleTier === 'caution') return { duration: 1.1, repeat: Infinity, ease: 'easeInOut' };
    if (idleOrgan && idleTier === 'delayed') return { duration: 2.9, repeat: Infinity, ease: 'easeInOut' };
    if (state === GPULSE_STATE.ERROR) return { duration: 0.38, ease: 'easeInOut' };
    if (state === GPULSE_STATE.SUCCESS) {
      return { duration: 0.52, ease: [0.22, 1, 0.36, 1], times: [0, 0.4, 0.75, 1] };
    }
    if (state === GPULSE_STATE.CONFIRMING) return { duration: 2.8, repeat: Infinity, ease: 'easeInOut' };
    if (state === GPULSE_STATE.BROADCASTING) return { duration: 1.15, repeat: Infinity, ease: 'easeInOut' };
    if (state === GPULSE_STATE.PROCESSING) return { duration: 1.2, repeat: Infinity, ease: 'easeInOut' };
    if (state === GPULSE_STATE.SIGNING) return { duration: 3.4, repeat: Infinity, ease: 'easeInOut' };
    return { duration: 3.2, repeat: Infinity, ease: 'easeInOut' };
  }, [state, idleOrgan, idleTier]);

  const shellAnimate = useMemo(() => {
    if (idleOrgan && idleTier === 'protection') {
      return {
        boxShadow: [
          '0 0 0px rgba(239,68,68,0)',
          '0 0 12px rgba(239,68,68,0.2)',
          '0 0 4px rgba(239,68,68,0.1)',
          '0 0 0px rgba(239,68,68,0)',
        ],
      };
    }
    if (idleOrgan && idleTier === 'caution') {
      return {
        boxShadow: [
          '0 0 0px rgba(251,146,60,0)',
          '0 0 10px rgba(251,146,60,0.16)',
          '0 0 0px rgba(251,146,60,0)',
        ],
      };
    }
    if (idleOrgan && idleTier === 'delayed') {
      return {
        x: [0, -0.8, 0.8, 0],
        boxShadow: [
          '0 0 0px rgba(250,204,21,0)',
          '0 0 9px rgba(250,204,21,0.12)',
          '0 0 0px rgba(250,204,21,0)',
        ],
      };
    }
    if (state === GPULSE_STATE.ERROR) {
      return {
        scale: 1,
        x: [0, -2, 2, -1, 1, 0],
        boxShadow: [
          '0 0 0px rgba(239,68,68,0)',
          '0 0 14px rgba(239,68,68,0.28)',
          '0 0 8px rgba(239,68,68,0.18)',
          '0 0 0px rgba(239,68,68,0)',
        ],
      };
    }
    if (state === GPULSE_STATE.SUCCESS) {
      return {
        scale: [1, 1.004, 1],
        boxShadow: [
          '0 0 0px rgba(52,211,153,0)',
          '0 0 18px rgba(52,211,153,0.22)',
          '0 0 10px rgba(52,211,153,0.12)',
          '0 0 0px rgba(52,211,153,0)',
        ],
      };
    }
    if (state === GPULSE_STATE.CONFIRMING) {
      return {
        boxShadow: [
          '0 0 4px rgba(34,211,238,0.18)',
          '0 0 14px rgba(34,211,238,0.32)',
          '0 0 4px rgba(34,211,238,0.18)',
        ],
      };
    }
    if (state === GPULSE_STATE.BROADCASTING) {
      return {
        boxShadow: [
          '0 0 3px rgba(34,211,238,0.2)',
          '0 0 16px rgba(34,211,238,0.34)',
          '0 0 3px rgba(34,211,238,0.2)',
        ],
      };
    }
    if (state === GPULSE_STATE.PROCESSING) {
      return {
        boxShadow: [
          '0 0 2px rgba(34,211,238,0.14)',
          '0 0 12px rgba(34,211,238,0.26)',
          '0 0 2px rgba(34,211,238,0.14)',
        ],
      };
    }
    if (state === GPULSE_STATE.SIGNING) {
      return {
        boxShadow: [
          '0 0 2px rgba(167,139,250,0.14)',
          '0 0 12px rgba(139,92,246,0.22)',
          '0 0 2px rgba(167,139,250,0.14)',
        ],
      };
    }
    return {
      boxShadow: [
        '0 0 0px rgba(34,211,238,0)',
        '0 0 8px rgba(34,211,238,0.07)',
        '0 0 0px rgba(34,211,238,0)',
      ],
    };
  }, [state, idleOrgan, idleTier]);

  const showBroadcastRing = state === GPULSE_STATE.BROADCASTING;
  const showConfirmRing = state === GPULSE_STATE.CONFIRMING;
  const showSigningVeil = state === GPULSE_STATE.SIGNING;

  return (
    <motion.div
      className="relative rounded-2xl"
      data-gpulse-global-state={state}
      title={tooltip}
      animate={shellAnimate}
      transition={shellTransition}
    >
      {showSigningVeil ? (
        <span
          className="pointer-events-none absolute inset-0 z-[1] rounded-2xl bg-gradient-to-br from-violet-400/[0.06] via-transparent to-fuchsia-500/[0.04] motion-safe:animate-pulse"
          aria-hidden
        />
      ) : null}
      {showBroadcastRing ? (
        <span
          className="pointer-events-none absolute inset-[-1px] z-[1] rounded-[13px] border border-cyan-400/25 border-r-cyan-400/12 border-b-cyan-400/18 opacity-50 motion-safe:animate-[spin_3.6s_linear_infinite]"
          aria-hidden
        />
      ) : null}
      {showConfirmRing ? (
        <span
          className="pointer-events-none absolute inset-[-1px] z-[1] rounded-[13px] border border-cyan-300/28 motion-reduce:opacity-90 motion-safe:animate-pulse"
          aria-hidden
        />
      ) : null}
      <div
        className={`relative z-[2] rounded-2xl ${
          state === GPULSE_STATE.ERROR
            ? isLight
              ? 'ring-1 ring-red-400/28'
              : 'ring-1 ring-red-500/32'
            : state === GPULSE_STATE.SUCCESS
              ? isLight
                ? 'ring-1 ring-emerald-400/28'
                : 'ring-1 ring-emerald-400/28'
              : idleOrgan && idleTier === 'protection'
                ? isLight
                  ? 'ring-1 ring-red-400/22'
                  : 'ring-1 ring-red-500/25'
                : idleOrgan && idleTier === 'caution'
                  ? isLight
                    ? 'ring-1 ring-orange-400/22'
                    : 'ring-1 ring-orange-400/25'
                  : idleOrgan && idleTier === 'delayed'
                    ? isLight
                      ? 'ring-1 ring-amber-400/20'
                      : 'ring-1 ring-amber-400/22'
                    : ''
        }`}
      >
        {children}
      </div>
    </motion.div>
  );
});
