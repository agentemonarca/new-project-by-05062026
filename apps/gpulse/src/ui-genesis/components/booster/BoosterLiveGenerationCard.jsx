import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedMetric } from '../AnimatedMetric.jsx';

/**
 * Hero: live protocol generation from booster cores (rates from hook — summed for display only).
 */
export function BoosterLiveGenerationCard({ rateUsdtPerSecond, rateAigPerSecond }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-violet-400/30 bg-slate-950/80 p-6 md:p-8"
    >
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <motion.div
          className="absolute -inset-[20%] blur-3xl"
          animate={
            reduceMotion
              ? { opacity: 0.35 }
              : { opacity: [0.28, 0.5, 0.32, 0.45, 0.28], scale: [1, 1.04, 1, 1.03, 1] }
          }
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(circle at 30% 40%, rgba(167,139,250,0.35), transparent 45%), radial-gradient(circle at 70% 60%, rgba(34,211,238,0.2), transparent 50%)',
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-40">
        <motion.div
          className="absolute left-1/2 top-1/2 h-[180%] w-[180%] -translate-x-1/2 -translate-y-1/2"
          style={{
            background: 'conic-gradient(from 0deg, rgba(167,139,250,0.4), rgba(34,211,238,0.25), rgba(192,132,252,0.35), rgba(167,139,250,0.4))',
          }}
          animate={reduceMotion ? { rotate: 0 } : { rotate: 360 }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      <div className="relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">Generación en tiempo real</p>
        <div className="mt-4 flex flex-col gap-1">
          <motion.div
            className="font-display text-3xl font-bold tabular-nums text-white md:text-4xl"
            animate={reduceMotion ? {} : { textShadow: ['0 0 0 rgba(167,139,250,0)', '0 0 28px rgba(167,139,250,0.35)', '0 0 0 rgba(167,139,250,0)'] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <AnimatedMetric
              value={rateUsdtPerSecond}
              format={(v) =>
                `+${Number(v).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })} USDT / segundo`
              }
            />
          </motion.div>
          <p className="font-mono text-sm text-violet-200/85 md:text-base">
            ≈{' '}
            <AnimatedMetric
              value={rateAigPerSecond}
              format={(v) => `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 10 })} AIG / segundo`}
            />
          </p>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Suma de tasas de tus núcleos booster activos (contabilidad del protocolo).
        </p>
      </div>
    </motion.section>
  );
}
