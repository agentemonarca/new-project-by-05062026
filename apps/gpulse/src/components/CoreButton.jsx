import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function CoreButton({ onClick, disabled = false, isExecuting = false, syncReady = false, coreVisual = null }) {
  const derived = isExecuting ? 'EXECUTING' : syncReady ? 'READY' : 'IDLE';
  const state = coreVisual && coreVisual !== 'IDLE' && coreVisual !== 'READY' ? coreVisual : derived;

  const palette = useMemo(() => {
    if (state === 'READY') {
      return {
        ring: 'border-emerald-400/40',
        core: 'from-emerald-300/25 via-emerald-400/10 to-emerald-300/25',
        glow: 'bg-emerald-400/25',
        dot: 'bg-emerald-300',
      };
    }
    if (state === 'EXECUTING') {
      return {
        ring: 'border-violet-400/45',
        core: 'from-violet-300/25 via-fuchsia-400/10 to-violet-300/25',
        glow: 'bg-violet-500/30',
        dot: 'bg-violet-300',
      };
    }
    if (state === 'BLOCKED_SYNC') {
      return {
        ring: 'border-cyan-400/35',
        core: 'from-cyan-300/20 via-cyan-400/8 to-cyan-300/20',
        glow: 'bg-cyan-400/18',
        dot: 'bg-cyan-200',
      };
    }
    if (state === 'BLOCKED_GPULSE') {
      return {
        ring: 'border-fuchsia-400/35',
        core: 'from-violet-300/20 via-fuchsia-400/8 to-violet-300/20',
        glow: 'bg-fuchsia-500/20',
        dot: 'bg-fuchsia-200',
      };
    }
    if (state === 'ERROR_FUNDS') {
      return {
        ring: 'border-red-400/50',
        core: 'from-red-300/22 via-red-500/10 to-red-300/22',
        glow: 'bg-red-500/35',
        dot: 'bg-red-200',
      };
    }
    if (state === 'INTERRUPTED') {
      return {
        ring: 'border-amber-300/35',
        core: 'from-amber-200/18 via-amber-400/7 to-amber-200/18',
        glow: 'bg-amber-400/18',
        dot: 'bg-amber-200',
      };
    }
    return {
      ring: 'border-white/15',
      core: 'from-white/10 via-white/5 to-white/10',
      glow: 'bg-cyan-400/10',
      dot: 'bg-cyan-300/70',
    };
  }, [state]);

  const baseScale = state === 'EXECUTING' ? 1.1 : 1;
  const shake = state === 'ERROR_FUNDS';
  const pulse = state === 'BLOCKED_GPULSE';
  const fade = state === 'INTERRUPTED';

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        whileTap={disabled ? undefined : { scale: 0.9 }}
        whileHover={disabled ? undefined : { scale: 1.05 }}
        animate={
          shake
            ? { x: [0, -2, 2, -2, 2, 0] }
            : pulse
              ? { scale: [baseScale, baseScale + 0.025, baseScale] }
              : fade
                ? { opacity: [1, 0.65, 1] }
                : state === 'EXECUTING'
                  ? { scale: [baseScale, baseScale + 0.03, baseScale] }
                  : { scale: baseScale }
        }
        transition={
          shake
            ? { duration: 0.28, ease: 'easeInOut' }
            : pulse
              ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' }
              : fade
                ? { repeat: Infinity, duration: 2.4, ease: 'easeInOut' }
                : state === 'EXECUTING'
                  ? { repeat: Infinity, duration: 1.0, ease: 'easeInOut' }
                  : { type: 'spring', stiffness: 220, damping: 18 }
        }
        className={[
          'relative w-20 h-20 rounded-full',
          'backdrop-blur-xl bg-black/25',
          'border',
          palette.ring,
          'shadow-[0_14px_40px_rgba(0,0,0,0.45)]',
          'transition-all duration-400',
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
          'overflow-hidden',
        ].join(' ')}
        aria-label={state === 'EXECUTING' ? 'Abortar ejecución' : 'Iniciar núcleo'}
      >
        {/* External glow */}
        <div
          className={`absolute -inset-6 blur-2xl ${palette.glow} transition-opacity duration-500`}
          style={{ opacity: state === 'EXECUTING' ? 0.9 : state === 'ERROR_FUNDS' ? 0.95 : state === 'READY' ? 0.75 : 0.6 }}
          aria-hidden
        />

        {/* Glass sweep */}
        <div
          className="absolute inset-0 opacity-35 pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 35%, rgba(255,255,255,0.08) 100%)',
          }}
          aria-hidden
        />

        {/* Inner core */}
        <motion.div
          className={`absolute inset-[10px] rounded-full border border-white/10 bg-gradient-to-br ${palette.core}`}
          animate={state === 'EXECUTING' ? { rotate: 360 } : { rotate: 0 }}
          transition={state === 'EXECUTING' ? { repeat: Infinity, duration: 6, ease: 'linear' } : { duration: 0.4 }}
          aria-hidden
        />

        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <div className={`w-2.5 h-2.5 rounded-full ${palette.dot} shadow-[0_0_18px_rgba(34,211,238,0.35)]`} />
        </div>
      </motion.button>

      {isExecuting ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70 select-none"
          aria-hidden
        >
          ABORTAR
        </motion.div>
      ) : null}
    </div>
  );
}

