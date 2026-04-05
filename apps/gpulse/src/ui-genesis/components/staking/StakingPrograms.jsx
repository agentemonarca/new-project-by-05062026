import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Calendar, Percent, TrendingUp } from 'lucide-react';
import { GlassCard } from '../GlassCard.jsx';
import { NeonButton } from '../NeonButton.jsx';
import { STAKING_PLANS, useStakingEngineStore } from '../../stores/stakingEngineStore.js';

const EXAMPLE_PRINCIPAL = 1000;

/**
 * Five premium staking programs — GlassCard + NeonButton CTA.
 */
export function StakingPrograms({ onActivate }) {
  const reduceMotion = useReducedMotion();
  const activatePlan = useStakingEngineStore((s) => s.activatePlan);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-white">Programas premium de staking</h2>
        <p className="mt-1 text-sm text-slate-500">
          Cada bloqueo activa el motor económico, bonos binarios y boost de minería. Confirma fondos en el modal de
          wallet.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {STAKING_PLANS.map((p) => {
          const estReturn = EXAMPLE_PRINCIPAL * (p.monthlyRoiPct / 100) * p.months;
          return (
            <motion.div
              key={p.id}
              whileHover={reduceMotion ? undefined : { scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="h-full"
            >
              <GlassCard
                hover
                glowClassName="shadow-glowCyan hover:shadow-glowMagenta border-cyan-500/15"
                className="h-full"
                contentClassName="flex h-full flex-col p-4 md:p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-200">
                    {p.name}
                  </span>
                  <Calendar className="h-4 w-4 text-slate-500" />
                </div>
                <p className="mt-3 font-display text-xl font-bold text-white">{p.months} mes{p.months > 1 ? 'es' : ''}</p>
                <div className="mt-3 flex items-center gap-2 text-emerald-200">
                  <Percent className="h-4 w-4" />
                  <span className="text-sm font-bold">{p.monthlyRoiPct}% mensual</span>
                </div>
                <div className="mt-2 flex items-start gap-2 text-xs text-slate-400">
                  <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                  <span>
                    Est. retorno total (~{EXAMPLE_PRINCIPAL} USDT):{' '}
                    <span className="font-mono text-cyan-200/90">${estReturn.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</span>
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Bloqueo: {p.lockDays} días</p>
                <div className="mt-auto pt-4">
                  <NeonButton
                    type="button"
                    variant="primary"
                    className="!w-full !min-w-0 !normal-case !py-2.5 !text-xs !font-bold"
                    onClick={() => {
                      activatePlan(p.id);
                      onActivate?.();
                    }}
                  >
                    Activar Staking
                  </NeonButton>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
