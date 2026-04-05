import React from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { GlassCard } from '../GlassCard.jsx';
import { AnimatedMetric } from '../AnimatedMetric.jsx';

/**
 * Admin extension of balance/stat cards: system totals, growth, secondary KPIs.
 * Composes `GlassCard` + typography aligned with `StatCard`, not a duplicate implementation.
 *
 * @param {{
 *   title?: string,
 *   primaryValue: number,
 *   primaryPrefix?: string,
 *   primarySuffix?: string,
 *   growthPct?: number,
 *   growthLabel?: string,
 *   metrics?: { label: string, value: string }[],
 *   className?: string,
 * }} props
 */
export function AdminBalanceCard({
  title = 'Sistema',
  primaryValue,
  primaryPrefix = '$',
  primarySuffix = '',
  growthPct = 0,
  growthLabel = 'vs período anterior',
  metrics = [],
  className = '',
}) {
  const up = growthPct >= 0;
  const Trend = up ? TrendingUp : TrendingDown;

  return (
    <GlassCard className={`p-5 md:p-6 ${className}`} hover glowClassName="shadow-[0_0_36px_-10px_rgba(34,211,238,0.22)] border-cyan-500/25">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">{title}</p>
          <motion.p
            className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-white md:text-3xl"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {primaryPrefix}
            <AnimatedMetric
              value={primaryValue}
              format={(v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            />
            {primarySuffix}
          </motion.p>
        </div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            up ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/35 bg-rose-500/10 text-rose-100'
          }`}
        >
          <Trend className="h-3.5 w-3.5" />
          {up ? '+' : ''}
          {growthPct.toFixed(1)}% <span className="font-normal text-slate-400">{growthLabel}</span>
        </div>
      </div>
      {metrics.length > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs sm:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.label}>
              <dt className="text-[10px] uppercase tracking-wider text-slate-500">{m.label}</dt>
              <dd className="mt-0.5 font-mono text-slate-200">{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </GlassCard>
  );
}
