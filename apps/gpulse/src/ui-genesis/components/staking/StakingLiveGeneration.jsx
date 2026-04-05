import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedMetric } from '../AnimatedMetric.jsx';
import { useStakingEngineStore } from '../../stores/stakingEngineStore.js';

/**
 * @param {{ rateUsdtPerSecond: number, rateAigPerSecond: number, economicActive?: boolean }} props
 */
export function StakingLiveGeneration({ rateUsdtPerSecond, rateAigPerSecond, economicActive = true }) {
  const reduceMotion = useReducedMotion();
  const liveAccumulatedUsdt = useStakingEngineStore((s) => s.liveAccumulatedUsdt);
  const tickLiveEarnings = useStakingEngineStore((s) => s.tickLiveEarnings);
  const accrueEngineRewards = useStakingEngineStore((s) => s.accrueEngineRewards);

  useEffect(() => {
    if (!economicActive) return undefined;
    const id = window.setInterval(() => {
      tickLiveEarnings();
      accrueEngineRewards();
    }, 1000);
    return () => window.clearInterval(id);
  }, [economicActive, tickLiveEarnings, accrueEngineRewards]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-sky-500/25 bg-slate-950/80 p-6 md:p-8"
    >
      <div className="pointer-events-none absolute inset-0 opacity-85">
        <motion.div
          className="absolute -inset-[15%] blur-3xl"
          animate={
            reduceMotion
              ? { opacity: 0.3 }
              : { opacity: [0.24, 0.4, 0.28, 0.38, 0.24], scale: [1, 1.02, 1, 1.02, 1] }
          }
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(circle at 35% 40%, rgba(14,165,233,0.22), transparent 45%), radial-gradient(circle at 65% 60%, rgba(37,99,235,0.18), transparent 50%)',
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-35">
        <motion.div
          className="absolute left-1/2 top-1/2 h-[170%] w-[170%] -translate-x-1/2 -translate-y-1/2"
          style={{
            background: 'conic-gradient(from 0deg, rgba(14,165,233,0.35), rgba(37,99,235,0.25), rgba(56,189,248,0.3), rgba(14,165,233,0.35))',
          }}
          animate={reduceMotion ? { rotate: 0 } : { rotate: 360 }}
          transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      <div className="relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/80">Ingresos en vivo (simulado)</p>
        <p className="mt-2 text-xs text-slate-500">
          Contador acumulativo cada segundo + tasa del protocolo (USDT / AIG). Solo avanza con economía global ACTIVA.
        </p>
        {!economicActive ? (
          <p className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100/90">
            Simulación en pausa: activa staking y el mínimo AIG para acumular en vivo.
          </p>
        ) : null}

        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/80">Pool acumulado (demo)</p>
          <motion.p
            className="mt-1 font-display text-2xl font-bold tabular-nums text-white md:text-3xl"
            animate={reduceMotion ? {} : { textShadow: ['0 0 0 rgba(52,211,153,0)', '0 0 20px rgba(52,211,153,0.35)', '0 0 0 rgba(52,211,153,0)'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            $
            <AnimatedMetric value={liveAccumulatedUsdt} format={(v) => Number(v).toLocaleString('es-ES', { maximumFractionDigits: 2 })} />
          </motion.p>
        </div>

        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/80">Tasa instantánea</p>
        <div className="mt-4 flex flex-col gap-1">
          <motion.div
            className="font-display text-2xl font-bold tabular-nums text-white md:text-3xl"
            animate={
              reduceMotion
                ? {}
                : { textShadow: ['0 0 0 rgba(14,165,233,0)', '0 0 24px rgba(14,165,233,0.28)', '0 0 0 rgba(14,165,233,0)'] }
            }
            transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <AnimatedMetric
              value={economicActive ? rateUsdtPerSecond : 0}
              format={(v) =>
                `+${Number(v).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })} USDT / segundo`
              }
            />
          </motion.div>
          <p className="font-mono text-sm text-cyan-200/85 md:text-base">
            ≈{' '}
            <AnimatedMetric
              value={economicActive ? rateAigPerSecond : 0}
              format={(v) => `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 10 })} AIG / segundo`}
            />
          </p>
        </div>
      </div>
    </motion.section>
  );
}
