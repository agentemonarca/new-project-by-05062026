import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GlassCard } from '../GlassCard.jsx';
import { AnimatedMetric } from '../AnimatedMetric.jsx';
import { useStakingEngineStore } from '../../stores/stakingEngineStore.js';

const AIG_USD = 0.02;

/**
 * Top economic summary — USD totals, daily flow, ROI %, LIVE status.
 */
export function StakingEngineHero({
  totalLockedAig,
  rateUsdtPerSecond,
  userHasActiveStaking,
  userEconomicallyActive = userHasActiveStaking,
  hasSession,
}) {
  const reduceMotion = useReducedMotion();
  const activeEngineStakings = useStakingEngineStore((s) => s.activeEngineStakings);

  const engineInvested = useMemo(
    () => activeEngineStakings.filter((r) => !r.claimed).reduce((s, r) => s + r.investedUsdt, 0),
    [activeEngineStakings],
  );

  const totalStakingUsd = useMemo(
    () => totalLockedAig * AIG_USD + engineInvested,
    [totalLockedAig, engineInvested],
  );

  const dailyUsdt = userEconomicallyActive ? rateUsdtPerSecond * 86400 : 0;
  const monthlyRoiDisplay = userEconomicallyActive ? 10.5 : 0;
  const statusActive = Boolean(hasSession && userEconomicallyActive);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard
        hover={false}
        glowClassName={
          statusActive
            ? 'border-cyan-400/30 shadow-[0_0_48px_-10px_rgba(34,211,238,0.35),0_0_40px_-12px_rgba(167,139,250,0.22)]'
            : 'border-white/10 shadow-[0_0_32px_-12px_rgba(71,85,105,0.35)]'
        }
        className={statusActive ? 'ring-1 ring-cyan-400/15' : ''}
        contentClassName="relative overflow-hidden p-6 md:p-8"
      >
        <motion.div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/15 blur-3xl"
          animate={
            reduceMotion || !statusActive
              ? {}
              : { opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }
          }
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/85">Motor económico · Staking</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Total Staking Value (USD)</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white md:text-3xl">
                $
                <AnimatedMetric
                  value={totalStakingUsd}
                  format={(v) => Number(v).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Daily Earnings (est.)</p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums text-emerald-200 md:text-2xl">
                +$
                <AnimatedMetric
                  value={dailyUsdt}
                  format={(v) => Number(v).toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Monthly ROI activo</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-violet-200 md:text-3xl">
                <AnimatedMetric value={monthlyRoiDisplay} format={(v) => `${Number(v).toFixed(1)}%`} />
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Estado</p>
              <motion.div
                className="mt-2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold uppercase tracking-wide"
                animate={
                  statusActive ? { boxShadow: ['0 0 0 rgba(52,211,153,0)', '0 0 24px rgba(52,211,153,0.35)', '0 0 0 rgba(52,211,153,0)'] } : {}
                }
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  borderColor: statusActive ? 'rgba(52,211,153,0.45)' : 'rgba(100,116,139,0.4)',
                  background: statusActive ? 'rgba(16,185,129,0.12)' : 'rgba(51,65,85,0.25)',
                  color: statusActive ? 'rgb(167,243,208)' : 'rgb(148,163,184)',
                }}
              >
                <span
                  className={`h-2 w-2 rounded-full ${statusActive ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`}
                />
                {statusActive ? 'ACTIVE' : 'INACTIVE'}
              </motion.div>
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
