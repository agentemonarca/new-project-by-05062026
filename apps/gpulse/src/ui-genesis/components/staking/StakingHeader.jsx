import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function StakingHeader() {
  const reduceMotion = useReducedMotion();

  return (
    <header className="relative overflow-hidden rounded-2xl border border-blue-500/25 bg-slate-950/70 p-6 shadow-[0_0_48px_-12px_rgba(37,99,235,0.35),0_0_32px_-8px_rgba(14,165,233,0.12)] md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(37,99,235,0.22),transparent_55%)]" />
      <div className="pointer-events-none absolute -right-20 top-0 h-44 w-44 rounded-full bg-sky-500/12 blur-3xl" />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
            🔒 Staking del Protocolo
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sky-100/80 md:text-base">
            Bloquea AIG y aumenta tu participación en la distribución del sistema. Las recompensas dependen de la
            actividad del protocolo.
          </p>
        </div>
        <motion.div
          className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-500/35 bg-sky-500/10 px-4 py-2"
          animate={reduceMotion ? {} : { boxShadow: ['0 0 0 rgba(14,165,233,0)', '0 0 22px rgba(14,165,233,0.2)', '0 0 0 rgba(14,165,233,0)'] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="relative flex h-2 w-2">
            {!reduceMotion ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-35" />
            ) : null}
            <span className="relative h-2 w-2 rounded-full bg-sky-400" />
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-sky-200/95">Live</span>
        </motion.div>
      </div>
    </header>
  );
}
