import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedMetric } from '../AnimatedMetric.jsx';

/**
 * Admin counterpart to live generation cards: global protocol rate + distribution signals.
 * Reuses the same motion/aural treatment as booster generation UI without duplicating card markup verbatim.
 *
 * @param {{
 *   globalRateUsdt: number,
 *   globalRateAig: number,
 *   topRateUsdt: number,
 *   topRateAig: number,
 *   inactiveNodes: number,
 *   topPerformers?: { id: string, label: string, rateFactor: number }[],
 * }} props
 */
export function AdminGenerationCard({
  globalRateUsdt,
  globalRateAig,
  topRateUsdt,
  topRateAig,
  inactiveNodes,
  topPerformers = [],
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-cyan-400/28 bg-slate-950/80 p-6 md:p-8"
    >
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <motion.div
          className="absolute -inset-[18%] blur-3xl"
          animate={
            reduceMotion
              ? { opacity: 0.32 }
              : { opacity: [0.25, 0.48, 0.3, 0.42, 0.25], scale: [1, 1.03, 1, 1.02, 1] }
          }
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(circle at 25% 45%, rgba(34,211,238,0.28), transparent 45%), radial-gradient(circle at 75% 55%, rgba(139,92,246,0.22), transparent 48%)',
          }}
        />
      </div>

      <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/85">Generación global</p>
          <div className="mt-3 font-display text-2xl font-bold tabular-nums text-white md:text-3xl">
            <AnimatedMetric
              value={globalRateUsdt}
              format={(v) =>
                `+${Number(v).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })} USDT/s`
              }
            />
          </div>
          <p className="mt-1 font-mono text-sm text-violet-200/85">
            ≈{' '}
            <AnimatedMetric
              value={globalRateAig}
              format={(v) => `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 10 })} AIG/s`}
            />
          </p>
          <p className="mt-3 text-[11px] text-slate-500">
            Agregado de red (simulación administrativa) · no sustituye reporting fiscal.
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-white/10 bg-black/25 p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Top performantes</p>
            <p className="mt-1 font-mono text-sm text-emerald-200/95">
              Pico{' '}
              <AnimatedMetric
                value={topRateUsdt}
                format={(v) => `${Number(v).toExponential(2)} USDT/s`}
              />{' '}
              ·{' '}
              <AnimatedMetric value={topRateAig} format={(v) => `${Number(v).toFixed(4)} AIG/s`} />
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nodos inactivos (est.)</p>
            <p className="mt-1 font-display text-xl font-semibold text-amber-100">{inactiveNodes}</p>
          </div>
          {topPerformers.length > 0 ? (
            <ul className="space-y-2 text-xs text-slate-400">
              {topPerformers.slice(0, 3).map((p) => (
                <li key={p.id} className="flex justify-between gap-2 border-b border-white/5 pb-2 last:border-0">
                  <span className="text-slate-300">{p.label}</span>
                  <span className="font-mono text-cyan-200/90">×{p.rateFactor.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
