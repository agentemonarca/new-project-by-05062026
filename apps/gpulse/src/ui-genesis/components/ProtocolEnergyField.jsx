import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, Pause } from 'lucide-react';
import { AnimatedMetric } from './AnimatedMetric.jsx';
import { usdToAig } from '../../utils/pricing.js';

/**
 * Global “protocol energy field” above core grid — unified generation context.
 * @param {{
 *   totalRatePerSecond: number,
 *   totalAccumulated: number,
 *   hasSession: boolean,
 *   coreCount: number,
 * }} props
 */
export function ProtocolEnergyField({ totalRatePerSecond, totalAccumulated, hasSession, coreCount }) {
  const reduceMotion = useReducedMotion();
  const aigEquiv = usdToAig(totalAccumulated);

  const { status, statusLabel } = useMemo(() => {
    const generating = hasSession && totalRatePerSecond > 1e-8;
    if (generating) return { status: 'active', statusLabel: 'Active' };
    return { status: 'paused', statusLabel: 'Paused' };
  }, [hasSession, totalRatePerSecond]);

  const formatRate = (r) => {
    if (r >= 0.001) return `${r.toFixed(6)} USDT/s`;
    return `${r.toExponential(2)} USDT/s`;
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-white/[0.12] bg-slate-950/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] md:p-8"
    >
      {/* Soft animated mesh — cyan / violet / blue (core family) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <motion.div
          className="absolute -inset-[40%] opacity-70 blur-3xl"
          animate={
            reduceMotion
              ? { opacity: 0.45 }
              : {
                  opacity: [0.35, 0.55, 0.38, 0.5, 0.35],
                  scale: [1, 1.05, 1, 1.03, 1],
                }
          }
          transition={reduceMotion ? { duration: 0 } : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(ellipse 50% 40% at 20% 30%, rgba(34,211,238,0.35), transparent 55%), radial-gradient(ellipse 45% 45% at 80% 20%, rgba(139,92,246,0.32), transparent 50%), radial-gradient(ellipse 40% 50% at 50% 90%, rgba(59,130,246,0.28), transparent 55%)',
          }}
        />
        <motion.div
          className="absolute inset-0"
          animate={reduceMotion ? { opacity: 0.1 } : { opacity: [0.08, 0.16, 0.1, 0.14, 0.08] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            backgroundImage:
              'linear-gradient(125deg, rgba(34,211,238,0.2) 0%, transparent 40%, rgba(139,92,246,0.15) 50%, transparent 60%, rgba(59,130,246,0.18) 100%)',
            backgroundSize: '200% 200%',
          }}
        />
      </div>

      {/* Connection motif: hub + satellites */}
      <svg
        className="pointer-events-none absolute right-4 top-1/2 hidden h-32 w-40 -translate-y-1/2 opacity-[0.35] md:block lg:right-8"
        viewBox="0 0 160 120"
        aria-hidden
      >
        <defs>
          <linearGradient id="energy-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(34,211,238)" stopOpacity="0.8" />
            <stop offset="50%" stopColor="rgb(139,92,246)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="rgb(59,130,246)" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <motion.circle
          cx="80"
          cy="60"
          r="8"
          fill="rgba(34,211,238,0.5)"
          animate={reduceMotion ? {} : { opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        {[
          [30, 28],
          [130, 28],
          [80, 108],
        ].map(([x, y], i) => (
          <g key={i}>
            <line
              x1="80"
              y1="60"
              x2={x}
              y2={y}
              stroke="url(#energy-line)"
              strokeWidth="1.2"
              strokeOpacity="0.5"
            />
            <circle cx={x} cy={y} r="5" fill={i === 0 ? 'rgba(34,211,238,0.45)' : i === 1 ? 'rgba(139,92,246,0.45)' : 'rgba(59,130,246,0.45)'} />
          </g>
        ))}
      </svg>

      <div className="relative z-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-white md:text-2xl">
              ⚛️ Campo del Protocolo
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Un solo campo energético conecta tus núcleos: la generación se suma aquí antes de fluir a cada core.
            </p>
            <p className="mt-2 font-mono text-[10px] text-slate-600">
              {coreCount} core{coreCount === 1 ? '' : 's'} en red
            </p>
          </div>

          <div
            className={`flex shrink-0 items-center gap-2.5 self-start rounded-2xl border px-4 py-2.5 ${
              status === 'active'
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            }`}
          >
            {status === 'active' ? (
              <Activity className="h-4 w-4 text-emerald-300" strokeWidth={2} />
            ) : (
              <Pause className="h-4 w-4 text-amber-300" strokeWidth={2} />
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Estado</p>
              <p className="text-sm font-semibold">{statusLabel}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: 'Tasa total de generación',
              value: totalRatePerSecond,
              format: () => formatRate(totalRatePerSecond),
              sub: 'Suma de tasas (núcleos activos)',
              accent: 'text-cyan-200',
            },
            {
              label: 'Total acumulado',
              value: totalAccumulated,
              format: (v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })} USDT`,
              sub: 'Buffer reclamable conjunto',
              accent: 'text-violet-200',
            },
            {
              label: 'Equivalente AIG',
              value: aigEquiv,
              format: (v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} AIG`,
              sub: 'Vista informativa',
              accent: 'text-sky-200',
            },
          ].map((row) => (
            <motion.div
              key={row.label}
              className="rounded-2xl border border-white/[0.08] bg-slate-950/50 px-4 py-4 backdrop-blur-md"
              whileHover={reduceMotion ? undefined : { y: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{row.label}</p>
              <p className={`mt-2 font-display text-xl font-bold tabular-nums md:text-2xl ${row.accent}`}>
                {row.label === 'Tasa total de generación' ? (
                  row.format()
                ) : (
                  <AnimatedMetric value={row.value} format={row.format} />
                )}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">{row.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom pulse line — “field boundary” */}
      <motion.div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px"
        animate={reduceMotion ? { opacity: 0.4 } : { opacity: [0.3, 0.75, 0.35] }}
        transition={reduceMotion ? {} : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.6), rgba(139,92,246,0.5), rgba(59,130,246,0.6), transparent)',
        }}
      />
    </motion.section>
  );
}
