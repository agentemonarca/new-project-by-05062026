import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Clock, TrendingUp, Zap } from 'lucide-react';
import { useOptionalCore } from '../core/CoreContext.jsx';
import {
  MARKETPLACE_CATEGORY_VERB,
  STANDALONE_CORE_SNAPSHOT,
  calculateProductImpact,
  formatLossAversionLine,
  getListingUrgencyPercent,
  getPopularityBadge,
  getProductCtaLabel,
  getProductContextTag,
  impactToOutputPercent,
  productAlignsWithNextAction,
} from '../marketplace/impactEngine.js';

const POPULARITY_STYLES = {
  fire: 'border-amber-400/55 bg-amber-500/15 text-amber-50 shadow-[0_0_16px_rgba(251,191,36,0.22)]',
  bolt: 'border-rose-400/50 bg-rose-500/12 text-rose-100 shadow-[0_0_14px_rgba(244,63,94,0.15)]',
  star: 'border-cyan-400/50 bg-cyan-500/12 text-cyan-50 shadow-[0_0_14px_rgba(34,211,238,0.18)]',
  spark: 'border-violet-400/50 bg-violet-500/12 text-violet-100 shadow-[0_0_14px_rgba(139,92,246,0.15)]',
};

function AnimatedFillBar({ value, className, delay = 0, reduceMotion }) {
  const w = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/90 ring-1 ring-white/5">
      <motion.div
        className={`h-full rounded-full ${className}`}
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${w}%` }}
        transition={{ delay: reduceMotion ? 0 : delay, duration: reduceMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

function PaymentSplitBarAnimated({ aigPercent, reduceMotion }) {
  const aig = Math.min(100, Math.max(0, aigPercent));
  const usdt = 100 - aig;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pay with · split</p>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-cyan-200/95">
          <span className="w-10 shrink-0 font-mono text-cyan-400">AIG</span>
          <AnimatedFillBar
            value={aig}
            reduceMotion={reduceMotion}
            delay={0.05}
            className="bg-gradient-to-r from-cyan-500 to-teal-400 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
          />
          <span className="w-10 shrink-0 text-right font-mono tabular-nums">{Math.round(aig)}%</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-violet-200/95">
          <span className="w-10 shrink-0 font-mono text-violet-400">USDT</span>
          <AnimatedFillBar
            value={usdt}
            reduceMotion={reduceMotion}
            delay={0.12}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-500 shadow-[0_0_12px_rgba(139,92,246,0.35)]"
          />
          <span className="w-10 shrink-0 text-right font-mono tabular-nums">{Math.round(usdt)}%</span>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   product: import('../marketplace/normalize.js').NormalizedMarketplaceProduct,
 *   sortedIndex?: number,
 *   compact?: boolean,
 *   onQuickBuy?: (product: import('../marketplace/normalize.js').NormalizedMarketplaceProduct) => void,
 * }} props
 */
export function SmartProductCard({ product, sortedIndex = 0, compact = false, onQuickBuy }) {
  const reduceMotion = useReducedMotion();
  const ctx = useOptionalCore();
  const core = ctx ?? STANDALONE_CORE_SNAPSHOT;

  const impact = useMemo(() => calculateProductImpact(product, core), [product, core]);
  const tag = useMemo(() => getProductContextTag(product, core, sortedIndex), [product, core, sortedIndex]);
  const lossLine = useMemo(() => formatLossAversionLine(core, product), [core, product]);
  const alignsNext = useMemo(() => (ctx ? productAlignsWithNextAction(product, core) : false), [ctx, product, core]);
  const cta = getProductCtaLabel(product);
  const pct = impactToOutputPercent(product);
  const popularity = getPopularityBadge(sortedIndex);
  const urgencyPct = useMemo(() => getListingUrgencyPercent(product), [product]);

  const roiOk = impact.paybackTime < 9000 && impact.paybackTime > 0;
  const categoryVerb = MARKETPLACE_CATEGORY_VERB[product.category] ?? 'Earn';

  const tagPill = (
    <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-200">
      {tag.icon} {tag.label}
    </span>
  );

  const popPill = (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${POPULARITY_STYLES[popularity.variant]}`}
    >
      {popularity.label}
    </span>
  );

  return (
    <motion.article
      layout
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: compact ? -6 : -10,
              transition: { type: 'spring', stiffness: 420, damping: 26 },
            }
      }
      className={`group relative flex shrink-0 flex-col overflow-hidden rounded-2xl border border-violet-500/40 bg-slate-950/70 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_8px_40px_-12px_rgba(139,92,246,0.45),0_20px_60px_-24px_rgba(34,211,238,0.18)] backdrop-blur-xl transition-shadow duration-500 hover:border-cyan-400/35 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_16px_56px_-10px_rgba(139,92,246,0.55),0_24px_80px_-20px_rgba(34,211,238,0.28)] ${
        compact ? 'w-[280px]' : 'w-full'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-600/18 via-transparent to-cyan-500/14 opacity-95 transition duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-fuchsia-500/15 blur-3xl transition duration-700 group-hover:bg-fuchsia-500/22" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-cyan-500/12 blur-3xl transition duration-700 group-hover:bg-cyan-500/18" />

      {product.image ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950">
          <img src={product.image} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
          <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
            {popPill}
            {tagPill}
            {alignsNext ? (
              <span className="rounded-full border border-cyan-400/45 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-50 shadow-[0_0_12px_rgba(34,211,238,0.25)]">
                Fits your stack
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="relative border-b border-white/10 bg-slate-900/60 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {popPill}
            {tagPill}
            {alignsNext ? (
              <span className="rounded-full border border-cyan-400/45 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-50">
                Fits your stack
              </span>
            ) : null}
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-fuchsia-300/90">{categoryVerb}</p>
          <h4 className="mt-0.5 font-display text-sm font-semibold leading-snug text-white line-clamp-2">{product.title}</h4>
        </div>

        <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-200/90">Earn boost</p>
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-200/85">
              <TrendingUp className="h-3 w-3" strokeWidth={2} />+{pct.toFixed(0)}%
            </span>
          </div>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-100 md:text-xl">
            +{Math.round(impact.estimatedAigPerDay).toLocaleString()}{' '}
            <span className="text-sm font-semibold text-emerald-200/80">AIG/day</span>
          </p>
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1 text-amber-200/90">
                <Zap className="h-3 w-3 text-amber-400" />
                Limited slots
              </span>
              <span className="font-mono text-amber-100/90">{urgencyPct}% filled</span>
            </div>
            <AnimatedFillBar
              value={urgencyPct}
              reduceMotion={reduceMotion}
              delay={0.08}
              className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 shadow-[0_0_14px_rgba(251,191,36,0.35)]"
            />
          </div>
        </div>

        <PaymentSplitBarAnimated aigPercent={product.aigPercent} reduceMotion={reduceMotion} />

        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
            Payback
          </span>
          <span className="font-mono font-semibold text-cyan-200">
            {roiOk ? `${impact.paybackTime.toFixed(1)}d est.` : '—'}
          </span>
        </div>

        <p className="font-mono text-xs text-slate-400">
          <span className="text-slate-500">From</span> ${product.priceUsdt.toLocaleString()}{' '}
          <span className="text-slate-600">USDT</span>
        </p>

        {lossLine ? <p className="text-[11px] leading-snug text-rose-200/90">{lossLine}</p> : null}

        <motion.button
          type="button"
          onClick={() => onQuickBuy?.(product)}
          className="relative mt-auto w-full overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_28px_rgba(139,92,246,0.45)] ring-1 ring-white/10 transition hover:brightness-110"
          whileHover={reduceMotion ? undefined : { scale: 1.02 }}
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        >
          <span className="relative z-10">{cta}</span>
        </motion.button>
      </div>
    </motion.article>
  );
}
