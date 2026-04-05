import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const DEFAULT_DURATION_MS = 2600;

const easeBreath = [0.4, 0, 0.2, 1];

const lineVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.32 + i * 0.36,
      duration: 0.9,
      ease: easeBreath,
    },
  }),
};

/**
 * Entrada G_Pulse: fondo negro, núcleo con pulso suave, glow púrpura/azul.
 * Secuencia ~2–3 s; sensación de respiración, no agresiva.
 * Montar dentro de `<AnimatePresence>`; al terminar llama `onComplete` para que el padre desmonte y ejecute `exit`.
 *
 * @param {{ onComplete?: () => void, durationMs?: number, className?: string }} props
 */
export default function GpulseEntryOverlay({
  onComplete,
  durationMs = DEFAULT_DURATION_MS,
  className = '',
}) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const id = window.setTimeout(() => {
      onCompleteRef.current?.();
    }, durationMs);
    return () => window.clearTimeout(id);
  }, [durationMs]);

  return (
    <motion.div
      role="presentation"
      aria-hidden
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden rounded-[inherit] bg-black ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: easeBreath }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_45%,rgba(139,92,246,0.14),transparent_55%),radial-gradient(ellipse_70%_50%_at_50%_55%,rgba(59,130,246,0.1),transparent_50%)]"
        aria-hidden
      />

      {/* Núcleo animado: respiración lenta */}
      <div className="relative mb-10 flex h-36 w-36 items-center justify-center sm:h-40 sm:w-40">
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/35 via-fuchsia-500/20 to-cyan-500/25 blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.45, 0.68, 0.45],
          }}
          transition={{
            duration: 3.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute inset-[18%] rounded-full border border-violet-400/25 bg-white/[0.03] shadow-[0_0_40px_rgba(139,92,246,0.35),0_0_80px_rgba(59,130,246,0.15)]"
          animate={{
            scale: [1, 1.04, 1],
            opacity: [0.85, 1, 0.85],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="relative h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_20px_rgba(196,181,253,0.9),0_0_36px_rgba(96,165,250,0.5)]"
          animate={{
            scale: [1, 1.12, 1],
            opacity: [0.65, 1, 0.65],
          }}
          transition={{
            duration: 2.6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      <motion.div
        className="relative z-10 max-w-[min(20rem,88vw)] px-6 text-center"
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: { staggerChildren: 0.1, delayChildren: 0.12 },
          },
        }}
      >
        <motion.h1
          custom={0}
          variants={lineVariants}
          className="text-[11px] font-semibold tracking-[0.42em] text-white/95 sm:text-xs"
        >
          G_PULSE
        </motion.h1>
        <motion.p
          custom={1}
          variants={lineVariants}
          className="mt-5 text-[13px] font-medium leading-relaxed text-white/72 sm:text-[14px]"
        >
          El pulso ya está en movimiento
        </motion.p>
        <motion.p
          custom={2}
          variants={lineVariants}
          className="mt-3 text-[12px] leading-relaxed text-white/48 sm:text-[13px]"
        >
          No se trata de predecir… se trata de sincronizar
        </motion.p>
        <motion.p
          custom={3}
          variants={lineVariants}
          className="mt-4 text-[11px] font-medium uppercase tracking-[0.2em] text-violet-300/75 sm:text-[12px]"
        >
          Tu acceso define tu conexión
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
