import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedMetric } from '../AnimatedMetric.jsx';
import { getStakingLockedAig } from '../../types/miningCore.js';

/**
 * @param {{
 *   stakingCores: import('../../types/miningCore.js').MiningCore[],
 *   rateUsdtPerSecond: number,
 *   rateAigPerSecond: number,
 *   participationActive: boolean,
 * }} props
 */
export function StakingSummary({ stakingCores, rateUsdtPerSecond, rateAigPerSecond, participationActive }) {
  const reduceMotion = useReducedMotion();

  const totalLockedAig = useMemo(
    () => stakingCores.reduce((s, c) => s + getStakingLockedAig(c), 0),
    [stakingCores],
  );

  const participationTier = useMemo(() => {
    if (totalLockedAig >= 1000) return { label: 'Participación avanzada', className: 'border-sky-400/35 bg-sky-500/12 text-sky-100' };
    if (totalLockedAig >= 400) return { label: 'Participación consolidada', className: 'border-blue-400/30 bg-blue-500/10 text-blue-100' };
    return { label: 'Participación activa', className: 'border-slate-500/30 bg-slate-800/40 text-slate-200' };
  }, [totalLockedAig]);

  const statusLabel = participationActive ? '🔒 Participación activa' : 'En espera de núcleos';

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-slate-950/75 p-6 md:p-8"
    >
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <motion.div
          className="absolute -inset-[18%] blur-3xl"
          animate={reduceMotion ? { opacity: 0.28 } : { opacity: [0.22, 0.38, 0.24, 0.34, 0.22] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(circle at 25% 35%, rgba(37,99,235,0.28), transparent 42%), radial-gradient(circle at 72% 55%, rgba(14,165,233,0.18), transparent 48%)',
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/75">Resumen global</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Total bloqueado</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white md:text-3xl">
                <AnimatedMetric
                  value={totalLockedAig}
                  format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} AIG`}
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Generación total</p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums text-sky-100 md:text-2xl">
                <AnimatedMetric
                  value={rateUsdtPerSecond}
                  format={(v) =>
                    `+${Number(v).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })} USDT / segundo`
                  }
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Equivalente</p>
              <p className="mt-1 font-mono text-sm tabular-nums text-cyan-200/90 md:text-base">
                ≈{' '}
                <AnimatedMetric
                  value={rateAigPerSecond}
                  format={(v) =>
                    `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 10 })} AIG / segundo`
                  }
                />
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-400">{statusLabel}</p>
        </div>

        <div
          className={`flex shrink-0 flex-col items-start gap-2 rounded-xl border px-4 py-3 ${participationTier.className}`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400/90">Nivel de participación</span>
          <span className="text-sm font-semibold">{participationTier.label}</span>
        </div>
      </div>
    </motion.section>
  );
}
