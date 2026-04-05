import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedMetric } from '../AnimatedMetric.jsx';

/**
 * @param {{ label?: string, generatedUsdt: number, capUsdt: number, progress01: number, live: boolean }} props
 */
export function BoosterProgressCard({
  label = 'Booster activo',
  generatedUsdt,
  capUsdt,
  progress01,
  live,
}) {
  const pct = Math.round(Math.min(100, Math.max(0, progress01 * 100)));
  const remaining = Math.max(0, capUsdt - generatedUsdt);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-5 md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-600/[0.07] via-transparent to-cyan-500/[0.06]" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-white">{label}</h2>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              live ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300' : 'border-slate-600/40 bg-slate-800/60 text-slate-400'
            }`}
          >
            {live ? 'LIVE' : 'Idle'}
          </span>
        </div>

        <p className="mt-4 font-mono text-sm text-slate-400">
          <span className="text-white">
            <AnimatedMetric
              value={Math.min(generatedUsdt, capUsdt)}
              format={(v) => String(Math.round(Number(v)))}
            />
          </span>
          <span className="text-slate-500"> / </span>
          <span>{Math.round(capUsdt)}</span>
          <span className="ml-1 text-slate-500">USDT</span>
        </p>

        <div className="mt-3 h-3 overflow-hidden rounded-full border border-white/10 bg-slate-900/80">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 22 }}
          />
        </div>

        <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Generado</dt>
            <dd className="mt-0.5 font-mono text-violet-100">
              <AnimatedMetric
                value={generatedUsdt}
                format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`}
              />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Restante</dt>
            <dd className="mt-0.5 font-mono text-cyan-100/90">
              <AnimatedMetric
                value={remaining}
                format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`}
              />
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[10px] text-slate-600">
          Progreso agregado de tus aportes booster (límite de ciclo del protocolo).
        </p>
      </div>
    </section>
  );
}
