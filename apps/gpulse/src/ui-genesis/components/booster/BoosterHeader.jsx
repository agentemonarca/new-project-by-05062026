import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function BoosterHeader() {
  const reduceMotion = useReducedMotion();

  return (
    <header className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-slate-950/70 p-6 shadow-[0_0_48px_-12px_rgba(139,92,246,0.35),0_0_32px_-8px_rgba(34,211,238,0.12)] md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(167,139,250,0.2),transparent_55%)]" />
      <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
            ⚡ Booster de Aceleración
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-violet-100/75 md:text-base">
            Aumenta la velocidad de generación del protocolo. Participación en aceleración — no es un depósito ni un
            producto financiero.
          </p>
        </div>
        <motion.div
          className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2"
          animate={reduceMotion ? {} : { boxShadow: ['0 0 0 rgba(52,211,153,0)', '0 0 20px rgba(52,211,153,0.25)', '0 0 0 rgba(52,211,153,0)'] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="relative flex h-2 w-2">
            {!reduceMotion ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
            ) : null}
            <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-200/95">Live</span>
        </motion.div>
      </div>
    </header>
  );
}
