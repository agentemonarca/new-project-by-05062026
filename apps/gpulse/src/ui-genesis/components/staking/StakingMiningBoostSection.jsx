import React from 'react';
import { Pickaxe } from 'lucide-react';
import { GlassCard } from '../GlassCard.jsx';
import { AnimatedMetric } from '../AnimatedMetric.jsx';
import { ProgressBar } from '../ProgressBar.jsx';

/**
 * Links staking weight to mining performance (UI model).
 */
export function StakingMiningBoostSection({ userEconomicallyActive }) {
  const boostPct = userEconomicallyActive ? 22 : 0;
  const capacityPct = userEconomicallyActive ? 78 : 40;
  const roiProgress = userEconomicallyActive ? 58 : 22;

  return (
    <GlassCard hover={false} glowClassName="border-amber-500/20 shadow-[0_0_28px_-8px_rgba(251,191,36,0.15)]" contentClassName="p-5 md:p-6">
      <div className="flex items-center gap-2">
        <Pickaxe className="h-5 w-5 text-amber-300" strokeWidth={1.75} />
        <h2 className="font-display text-base font-semibold text-white">Impacto en Minería</h2>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Boost por staking</p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-200">
            +<AnimatedMetric value={boostPct} format={(v) => `${Math.round(v)}%`} />
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Capacidad desbloqueada</p>
          <p className="mt-1 font-display text-2xl font-bold text-cyan-200">
            <AnimatedMetric value={capacityPct} format={(v) => `${Math.round(v)}%`} />
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Progreso ROI (ref.)</p>
          <p className="mt-1 font-display text-2xl font-bold text-violet-200">
            <AnimatedMetric value={roiProgress} format={(v) => `${Math.round(v)}%`} />
          </p>
        </div>
      </div>
      <div className="mt-5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Aceleración de ciclo</p>
        <ProgressBar value={userEconomicallyActive ? 72 : 34} />
      </div>
    </GlassCard>
  );
}
