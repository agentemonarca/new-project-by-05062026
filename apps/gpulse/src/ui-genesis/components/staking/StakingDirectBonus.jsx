import React, { useMemo } from 'react';
import { Users } from 'lucide-react';
import { GlassCard } from '../GlassCard.jsx';
import { AnimatedMetric } from '../AnimatedMetric.jsx';
import { useStakingEngineStore } from '../../stores/stakingEngineStore.js';

/**
 * Direct leg staking totals + 11% bonus (gated by global economy).
 */
export function StakingDirectBonus({ userEconomicallyActive }) {
  const teamFlat = useStakingEngineStore((s) => s.teamFlat);
  const pct = useStakingEngineStore((s) => s.binaryBonusPct);

  const { directTotal, bonusEarned, dailyFromDirect } = useMemo(() => {
    const direct = teamFlat.slice(0, 3);
    const total = direct.filter((u) => u.active).reduce((s, u) => s + u.amount, 0);
    const bonus = userEconomicallyActive ? total * (pct / 100) : 0;
    const daily = userEconomicallyActive ? bonus / 30 : 0;
    return { directTotal: total, bonusEarned: bonus, dailyFromDirect: daily };
  }, [teamFlat, pct, userEconomicallyActive]);

  return (
    <GlassCard
      hover={false}
      glowClassName="border-cyan-500/20 shadow-glowCyan"
      contentClassName="space-y-4 p-5 md:p-6"
    >
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-cyan-300" strokeWidth={1.75} />
        <h2 className="font-display text-base font-semibold text-white">Bonus directo</h2>
      </div>
      <p className="text-xs text-slate-500">
        Referidos directos en staking · {pct}% sobre su participación {!userEconomicallyActive ? '(economía inactiva)' : ''}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total staking directos</p>
          <p className="mt-1 font-mono text-lg font-bold text-white">
            $<AnimatedMetric value={directTotal} format={(v) => Number(v).toLocaleString('es-ES')} />
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bonus ganado (11%)</p>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-200">
            $<AnimatedMetric value={bonusEarned} format={(v) => Number(v).toLocaleString('es-ES', { maximumFractionDigits: 2 })} />
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Est. diario red directa</p>
          <p className="mt-1 font-mono text-lg font-bold text-cyan-200">
            $<AnimatedMetric value={dailyFromDirect} format={(v) => Number(v).toLocaleString('es-ES', { maximumFractionDigits: 2 })} />
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
