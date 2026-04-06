import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Radar } from 'lucide-react';

/** @typedef {'idle' | 'scanning' | 'signal_active'} GpulseNavVisualState */

export const GPULSE_NAV_STATE = /** @type {const} */ ({
  IDLE: 'idle',
  SCANNING: 'scanning',
  SIGNAL_ACTIVE: 'signal_active',
});

/**
 * Maps session + route to GPulse chrome visual mode (idle · scanning · signal live).
 * @param {{
 *   gpulseLobbyActive: boolean,
 *   hasSession: boolean,
 *   userEconomicallyActive: boolean,
 *   accountFrozen: boolean,
 * }} p
 * @returns {GpulseNavVisualState}
 */
export function deriveGpulseNavVisualState({
  gpulseLobbyActive,
  hasSession,
  userEconomicallyActive,
  accountFrozen,
}) {
  if (gpulseLobbyActive) return GPULSE_NAV_STATE.SIGNAL_ACTIVE;
  if (hasSession && userEconomicallyActive && !accountFrozen) return GPULSE_NAV_STATE.SCANNING;
  return GPULSE_NAV_STATE.IDLE;
}

/**
 * Highlight GPulse entry in the context bar — glass gradient, state-driven glow, hover lift.
 *
 * @param {{
 *   state: GpulseNavVisualState,
 *   onClick: () => void,
 *   className?: string,
 * }} props
 */
export function GpulseChromeButton({ state, onClick, className = '' }) {
  const reduceMotion = useReducedMotion();
  const isIdle = state === GPULSE_NAV_STATE.IDLE;
  const isScanning = state === GPULSE_NAV_STATE.SCANNING;
  const isSignal = state === GPULSE_NAV_STATE.SIGNAL_ACTIVE;
  const showDot = !isIdle;

  const ariaLabel =
    state === GPULSE_NAV_STATE.SIGNAL_ACTIVE
      ? 'GPulse Oracle — señal activa, abrir lobby'
      : state === GPULSE_NAV_STATE.SCANNING
        ? 'GPulse Oracle — escaneo en curso, abrir lobby'
        : 'GPulse Oracle — abrir lobby';

  const glowMotion = reduceMotion
    ? {}
    : isSignal
      ? {
          opacity: [0.55, 1, 0.55],
          scale: [1, 1.08, 1],
        }
      : isScanning
        ? { opacity: [0.35, 0.85, 0.35] }
        : { opacity: [0.2, 0.45, 0.2] };

  const glowTransition = reduceMotion
    ? {}
    : isSignal
      ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
      : isScanning
        ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
        : { duration: 3.5, repeat: Infinity, ease: 'easeInOut' };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      whileHover={
        reduceMotion
          ? undefined
          : {
              scale: 1.09,
              boxShadow: isSignal
                ? '0 0 42px -4px rgba(217,70,239,0.6), 0 0 32px -2px rgba(34,211,238,0.45), inset 0 1px 0 0 rgba(255,255,255,0.14)'
                : isScanning
                  ? '0 0 36px -4px rgba(34,211,238,0.55), 0 0 28px -2px rgba(139,92,246,0.4), inset 0 1px 0 0 rgba(255,255,255,0.11)'
                  : '0 0 28px -4px rgba(34,211,238,0.42), inset 0 1px 0 0 rgba(255,255,255,0.09)',
            }
      }
      whileTap={{ scale: 0.96 }}
      className={[
        'relative isolate min-h-[44px] touch-manipulation overflow-hidden rounded-xl border px-3 py-2 sm:min-h-0 sm:px-3 sm:py-2',
        'bg-gradient-to-br from-cyan-500/20 via-violet-500/[0.14] to-fuchsia-500/18 backdrop-blur-md',
        'outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        'shadow-[0_0_22px_-6px_rgba(34,211,238,0.35),inset_0_1px_0_0_rgba(255,255,255,0.08)]',
        isIdle && 'border-cyan-400/30',
        isScanning && 'border-cyan-400/45',
        isSignal && 'border-fuchsia-400/55 shadow-[0_0_28px_-6px_rgba(217,70,239,0.4),0_0_18px_-4px_rgba(34,211,238,0.3)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Animated aura — behind content */}
      <motion.span
        aria-hidden
        className={`pointer-events-none absolute -inset-px rounded-xl blur-md ${
          isSignal
            ? 'bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,rgba(217,70,239,0.45),rgba(34,211,238,0.2)_45%,transparent_70%)]'
            : isScanning
              ? 'bg-[radial-gradient(ellipse_90%_90%_at_40%_40%,rgba(34,211,238,0.4),transparent_65%)]'
              : 'bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,rgba(34,211,238,0.15),transparent_70%)]'
        }`}
        animate={glowMotion}
        transition={glowTransition}
      />

      {/* Shimmer sweep — scanning / signal active */}
      {!isIdle && !reduceMotion ? (
        <span className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-xl">
          <motion.span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[45%] bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: ['-100%', '320%'] }}
            transition={{
              duration: isSignal ? 2 : 2.8,
              repeat: Infinity,
              ease: 'linear',
              repeatDelay: isSignal ? 0.2 : 0.6,
            }}
          />
        </span>
      ) : null}

      <span className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2">
        {showDot ? (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                isSignal ? 'bg-fuchsia-400' : 'bg-cyan-400'
              }`}
              style={{ animationDuration: isSignal ? '1.5s' : '2s' }}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-slate-950 ${
                isSignal ? 'bg-fuchsia-400' : 'bg-cyan-400'
              }`}
            />
          </span>
        ) : null}

        <motion.span
          className="flex shrink-0"
          animate={
            reduceMotion
              ? {}
              : isSignal
                ? { scale: [1, 1.08, 1], rotate: [0, 6, -6, 0] }
                : isScanning
                  ? { rotate: 360 }
                  : { scale: [1, 1.04, 1] }
          }
          transition={
            reduceMotion
              ? {}
              : isSignal
                ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
                : isScanning
                  ? { duration: 14, repeat: Infinity, ease: 'linear' }
                  : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <Radar
            className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
              isSignal ? 'text-fuchsia-200' : isScanning ? 'text-cyan-200' : 'text-cyan-200/70'
            }`}
            strokeWidth={1.75}
          />
        </motion.span>

        <span
          className={`bg-gradient-to-r from-cyan-100 via-white to-fuchsia-100 bg-clip-text font-display text-[11px] font-bold uppercase tracking-wide text-transparent sm:text-xs ${
            isIdle ? 'opacity-90' : ''
          }`}
        >
          GPulse
        </span>
      </span>
    </motion.button>
  );
}
