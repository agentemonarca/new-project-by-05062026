import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '../GlassCard.jsx';
import { NeonButton } from '../NeonButton.jsx';
import { AnimatedMetric } from '../AnimatedMetric.jsx';
import { useStakingEngineStore } from '../../stores/stakingEngineStore.js';

function formatRemaining(ms) {
  if (ms <= 0) return 'Bloqueo finalizado';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

/**
 * Mock engine stakes from store — countdown + claim only after lock end.
 */
export function StakingEngineActiveLocks() {
  const rows = useStakingEngineStore((s) => s.activeEngineStakings);
  const claimEngineStaking = useStakingEngineStore((s) => s.claimEngineStaking);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (rows.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-white">Contratos de staking (motor)</h2>
        <p className="mt-1 text-sm text-slate-500">Recompensas reclamables solo tras finalizar el periodo de bloqueo.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((row) => {
          const rem = row.endsAt - now;
          const unlocked = rem <= 0 && !row.claimed;
          const locked = rem > 0;
          const canClaimNow = unlocked && !row.claimed;

          return (
            <GlassCard
              key={row.id}
              hover
              glowClassName="shadow-glowCyan border-cyan-500/20"
              contentClassName="space-y-4 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-sm font-semibold text-white">Plan {row.planLabel}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                    row.claimed ? 'border border-slate-600 bg-slate-800 text-slate-400' : locked ? 'border border-amber-500/35 bg-amber-500/10 text-amber-200' : 'border border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                  }`}
                >
                  {row.claimed ? 'RECLAMADO' : locked ? 'BLOQUEADO' : 'LISTO'}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Invertido</p>
                  <p className="font-mono text-lg text-white">
                    $<AnimatedMetric value={row.investedUsdt} format={(v) => Number(v).toFixed(0)} />
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Recompensas acumuladas</p>
                  <p className="font-mono text-lg text-cyan-200">
                    $<AnimatedMetric value={row.rewardsUsdt} format={(v) => Number(v).toFixed(2)} />
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Tiempo restante</p>
                <p className="mt-1 font-mono text-sm text-sky-200">{formatRemaining(rem)}</p>
              </div>
              <NeonButton
                type="button"
                variant={canClaimNow ? 'primary' : 'outline'}
                className="!w-full !normal-case !text-xs"
                disabled={!canClaimNow}
                onClick={() => claimEngineStaking(row.id)}
              >
                {locked ? 'CLAIM BLOQUEADO' : row.claimed ? 'Completado' : 'Reclamar'}
              </NeonButton>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}
