import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { coreRemainingUsdt } from '../../types/miningCore.js';

/**
 * @param {{ cores: import('../../types/miningCore.js').MiningCore[] }} props
 */
export function BoosterHistoryList({ cores }) {
  const reduceMotion = useReducedMotion();

  if (cores.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">
        Aún no hay inyecciones booster. Usa &quot;Inyectar booster&quot; para añadir participación.
      </p>
    );
  }

  return (
    <div>
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-slate-500">
        Historial de aportes
      </h2>
      <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 md:mx-0 md:flex-wrap md:overflow-visible">
        {cores.map((core, i) => {
          const remaining = coreRemainingUsdt(core);
          const done = remaining < 0.01 && core.progress >= 0.999;
          const active = !done && remaining > 0;
          return (
            <motion.article
              key={core.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={reduceMotion ? undefined : { scale: 1.02 }}
              className="relative min-w-[200px] shrink-0 rounded-2xl border border-violet-500/20 bg-slate-950/70 p-4 shadow-[0_0_24px_-8px_rgba(139,92,246,0.25)] md:min-w-0 md:flex-1 md:basis-[calc(50%-0.375rem)]"
            >
              <p className="font-mono text-[10px] text-violet-300/80">Booster #{core.id.replace(/\D/g, '').slice(-4) || core.id.slice(-6)}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{core.id}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Aporte</dt>
                  <dd className="font-mono text-white">{core.contribution.toLocaleString()} USDT</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Total generado</dt>
                  <dd className="font-mono text-violet-100">
                    {(core.totalGenerated + core.accumulated).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                    USDT
                  </dd>
                </div>
              </dl>
              <div className="mt-3">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    done
                      ? 'border-slate-500/40 bg-slate-800/60 text-slate-400'
                      : active
                        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  {done ? 'Completed' : active ? 'Active' : '—'}
                </span>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
