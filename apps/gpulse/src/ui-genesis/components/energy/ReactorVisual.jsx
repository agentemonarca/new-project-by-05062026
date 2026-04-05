import React, { memo, useId, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import './reactorVisual.css';

/** @typedef {'idle' | 'charging' | 'overdrive' | 'unstable'} ReactorVisualState */

const STATUS_MESSAGES = {
  idle: 'Core inactive',
  charging: 'Energy building',
  overdrive: 'Maximum efficiency',
  unstable: 'System overload',
};

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

function formatAigShort(v) {
  const n = Number(v) || 0;
  if (n >= 0.001) return n.toFixed(4);
  if (n >= 1e-9) return n.toExponential(2);
  return '0';
}

/**
 * Pure presentation: reactor shell, ring, overlays, and state-driven motion.
 *
 * @param {{
 *   state: ReactorVisualState,
 *   energy: number,
 *   aigPerSecond: number,
 *   yieldMultiplier: number,
 *   showEfficiencyWarning?: boolean,
 *   energyPulseTick?: number,
 *   multiplierFlashTick?: number,
 *   claimBurstTick?: number,
 *   onClick?: () => void,
 *   className?: string,
 * }} props
 */
function ReactorVisualInner({
  state,
  energy,
  aigPerSecond,
  yieldMultiplier,
  showEfficiencyWarning = false,
  energyPulseTick = 0,
  multiplierFlashTick = 0,
  claimBurstTick = 0,
  onClick,
  className = '',
}) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const gradHot = `reactorRingHot-${uid}`;
  const gradWarn = `reactorRingWarn-${uid}`;
  const pct = Math.max(0, Math.min(100, Number(energy) || 0));
  const status = STATUS_MESSAGES[state] ?? STATUS_MESSAGES.idle;

  const ringOffset = useMemo(() => RING_C * (1 - pct / 100), [pct]);

  const glowClass =
    state === 'idle'
      ? 'reactor-visual--idle-glow'
      : state === 'unstable'
        ? 'reactor-visual--unstable-flicker'
        : '';

  const shellShake = state === 'unstable' && !reduceMotion ? 'reactor-visual--unstable-shake' : '';

  const strokeColor =
    state === 'unstable'
      ? `url(#${gradWarn})`
      : state === 'overdrive'
        ? `url(#${gradHot})`
        : state === 'charging'
          ? 'rgba(34, 211, 238, 0.9)'
          : 'rgba(100, 116, 139, 0.65)';

  const shellClass = `relative h-40 w-40 shrink-0 outline-none md:h-44 md:w-44 ${
    onClick
      ? 'touch-manipulation rounded-full border-2 border-transparent bg-slate-950/85 ring-offset-2 ring-offset-slate-950 transition focus-visible:ring-2 focus-visible:ring-cyan-400/60 cursor-pointer'
      : 'rounded-full bg-slate-950/85'
  } ${shellShake}`;

  const inner = (
    <div className="relative h-full w-full">
          {claimBurstTick > 0 ? (
            <motion.div
              key={claimBurstTick}
              className="pointer-events-none absolute inset-0 z-[5] rounded-full reactor-visual--burst"
              style={{
                background:
                  'radial-gradient(circle, rgba(34,211,238,0.45) 0%, rgba(139,92,246,0.2) 45%, transparent 70%)',
              }}
              initial={reduceMotion ? false : { opacity: 0.85 }}
            />
          ) : null}

          {multiplierFlashTick > 0 ? (
            <motion.div
              key={multiplierFlashTick}
              className="pointer-events-none absolute inset-1 z-[4] rounded-full bg-fuchsia-400/25"
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          ) : null}

          {energyPulseTick > 0 ? (
            <motion.div
              key={energyPulseTick}
              className="pointer-events-none absolute inset-2 z-[4] rounded-full border-2 border-cyan-300/70"
              initial={reduceMotion ? { opacity: 0 } : { scale: 0.88, opacity: 0.9 }}
              animate={reduceMotion ? { opacity: 0 } : { scale: 1.12, opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          ) : null}

          <div
            className={`pointer-events-none absolute inset-0 z-0 rounded-full ${
              state === 'idle' ? 'opacity-40' : state === 'charging' ? 'opacity-70' : state === 'overdrive' ? 'opacity-95' : 'opacity-90'
            } ${glowClass}`}
            style={{
              boxShadow:
                state === 'idle'
                  ? '0 0 20px rgba(148,163,184,0.2)'
                  : state === 'charging'
                    ? '0 0 36px rgba(34,211,238,0.4)'
                    : state === 'overdrive'
                      ? '0 0 52px rgba(217,70,239,0.55), 0 0 80px rgba(34,211,238,0.25)'
                      : state === 'unstable'
                        ? '0 0 48px rgba(249,115,22,0.55), 0 0 72px rgba(239,68,68,0.35)'
                        : undefined,
            }}
          />

          {state === 'charging' && !reduceMotion ? (
            <div
              className="pointer-events-none absolute inset-[-4px] z-0 rounded-full border border-cyan-400/35 reactor-visual--charging-ring"
              style={{ animationDuration: '1.8s' }}
            />
          ) : null}

          {state === 'overdrive' ? (
            <>
              <div
                className="pointer-events-none absolute inset-[-2px] z-0 rounded-full opacity-50 reactor-visual--overdrive-wave"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 0%, rgba(217,70,239,0.35) 40%, transparent 65%)',
                }}
              />
              {!reduceMotion
                ? Array.from({ length: 7 }).map((_, i) => (
                    <span
                      key={i}
                      className="pointer-events-none absolute z-[1] h-1 w-1 rounded-full bg-cyan-200/90 reactor-visual--particle shadow-[0_0_6px_rgba(34,211,238,0.9)]"
                      style={{
                        left: `${28 + (i * 11) % 52}%`,
                        top: `${62 + (i % 3) * 8}%`,
                        animationDelay: `${i * 0.28}s`,
                      }}
                    />
                  ))
                : null}
            </>
          ) : null}

          <svg
            className="absolute left-1/2 top-1/2 z-[2] h-[120px] w-[120px] -translate-x-1/2 -translate-y-[52%] md:h-[128px] md:w-[128px]"
            viewBox="0 0 120 120"
            aria-hidden
          >
            <defs>
              <linearGradient id={gradHot} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgb(217, 70, 239)" />
                <stop offset="100%" stopColor="rgb(34, 211, 238)" />
              </linearGradient>
              <linearGradient id={gradWarn} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgb(251, 146, 60)" />
                <stop offset="100%" stopColor="rgb(239, 68, 68)" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r={RING_R} fill="none" stroke="rgba(30,41,59,0.85)" strokeWidth="7" />
            <motion.circle
              cx="60"
              cy="60"
              r={RING_R}
              fill="none"
              stroke={strokeColor}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              initial={false}
              animate={{ strokeDashoffset: ringOffset }}
              transition={{ type: 'spring', stiffness: 80, damping: 22 }}
            />
          </svg>

          <div
            className={`absolute left-1/2 top-1/2 z-[2] h-[76px] w-[76px] -translate-x-1/2 -translate-y-[58%] rounded-full bg-gradient-to-br md:h-[80px] md:w-[80px] ${
              state === 'idle'
                ? 'from-slate-700/85 to-slate-950'
                : state === 'charging'
                  ? 'from-cyan-600/88 to-violet-950'
                  : state === 'overdrive'
                    ? 'from-fuchsia-600 to-violet-950'
                    : 'from-orange-500 to-rose-950'
            } ${state === 'unstable' && !reduceMotion ? 'reactor-visual--unstable-flicker' : ''}`}
          />

          <div className="absolute left-1/2 top-[42%] z-[3] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
            <motion.span
              className="font-display text-2xl font-bold tabular-nums text-white md:text-3xl"
              animate={
                reduceMotion || energyPulseTick === 0
                  ? {}
                  : { scale: [1, 1.06, 1], transition: { duration: 0.45 } }
              }
              key={`n-${energyPulseTick}-${Math.round(pct)}`}
            >
              {Math.round(pct)}
            </motion.span>
            <span className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-white/55">energy</span>
          </div>

          <div className="absolute bottom-1 left-1/2 z-[3] w-[88%] -translate-x-1/2 rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 font-mono text-[9px] leading-tight text-cyan-100/95 md:text-[10px]">
              <span className="text-slate-400">AIG/s</span>
              <span className="tabular-nums text-cyan-200">{formatAigShort(aigPerSecond)}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[9px] leading-tight text-fuchsia-100/90 md:text-[10px]">
              <span className="text-slate-500">Yield ×</span>
              <span className="tabular-nums text-fuchsia-200">{Number(yieldMultiplier).toFixed(3)}</span>
            </div>
          </div>
        </div>
  );

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {showEfficiencyWarning ? (
        <p className="mb-2 max-w-[200px] text-center text-[10px] font-semibold leading-tight text-amber-300/95">
          ⚠️ Core underperforming
        </p>
      ) : null}

      {onClick ? (
        <motion.button
          type="button"
          onClick={onClick}
          whileTap={!reduceMotion ? { scale: 0.98 } : undefined}
          className={shellClass}
          aria-label="Open reactor details"
        >
          {inner}
        </motion.button>
      ) : (
        <div className={shellClass}>{inner}</div>
      )}

      <p className="mt-3 max-w-[220px] text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {status}
      </p>
      <p className="mt-1 font-mono text-[10px] text-slate-600">System core</p>
    </div>
  );
}

export const ReactorVisual = memo(ReactorVisualInner);
