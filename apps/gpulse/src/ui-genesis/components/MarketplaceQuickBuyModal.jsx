import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useOptionalCore } from '../core/CoreContext.jsx';
import {
  MARKETPLACE_CATEGORY_VERB,
  STANDALONE_CORE_SNAPSHOT,
  calculateProductImpact,
  compareBeforeAfter,
  getPaymentSplit,
  getProductCtaLabel,
} from '../marketplace/impactEngine.js';
import { getAigPriceUsd } from '../payment/dualTokenPayment.js';
import { usdToAig } from '../../utils/pricing.js';

function AnimatedSplitBars({ aigPercent, reduceMotion }) {
  const aig = Math.min(100, Math.max(0, aigPercent));
  const usdt = 100 - aig;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pay with · split</p>
      <div className="flex items-center gap-2 text-[11px] text-cyan-200/95">
        <span className="w-12 font-mono text-cyan-400">AIG</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${aig}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.75, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <span className="w-10 text-right font-mono tabular-nums">{Math.round(aig)}%</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-violet-200/95">
        <span className="w-12 font-mono text-violet-400">USDT</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 shadow-[0_0_12px_rgba(139,92,246,0.35)]"
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${usdt}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.75, delay: reduceMotion ? 0 : 0.06, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <span className="w-10 text-right font-mono tabular-nums">{Math.round(usdt)}%</span>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   open: boolean,
 *   product: import('../marketplace/normalize.js').NormalizedMarketplaceProduct | null,
 *   onClose: () => void,
 *   onConfirm?: (product: import('../marketplace/normalize.js').NormalizedMarketplaceProduct) => void,
 * }} props
 */
export function MarketplaceQuickBuyModal({ open, product, onClose, onConfirm }) {
  const reduceMotion = useReducedMotion();
  const ctx = useOptionalCore();
  const core = ctx ?? STANDALONE_CORE_SNAPSHOT;

  const internalAig = Number(core?.aigBalance ?? STANDALONE_CORE_SNAPSHOT.aigBalance ?? 0);
  const ledgerUsdt = Number(core?.claimUi?.ledgerNetUsdt);
  const internalUsdt = Number.isFinite(ledgerUsdt) && ledgerUsdt > 0 ? ledgerUsdt : undefined;
  const split = useMemo(
    () =>
      product
        ? getPaymentSplit(product, { internalAigBalance: internalAig, internalUsdtBalance: internalUsdt })
        : null,
    [product, internalAig, internalUsdt],
  );
  const impact = useMemo(() => (product ? calculateProductImpact(product, core) : null), [product, core]);
  const beforeAfter = useMemo(() => (product ? compareBeforeAfter(core, product) : null), [product, core]);
  const aigOracle = getAigPriceUsd();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!product || !split || !impact || !beforeAfter) return null;

  const cta = getProductCtaLabel(product);
  const roiOk = impact.paybackTime < 9000 && impact.paybackTime > 0;
  const categoryVerb = MARKETPLACE_CATEGORY_VERB[product.category] ?? 'Earn';
  const priceUSD = Number(product.priceUsdt ?? 0);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            aria-label="Close"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-buy-title"
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-violet-500/35 bg-slate-950 shadow-[0_24px_80px_-24px_rgba(139,92,246,0.55)]"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-300/90">{categoryVerb}</p>
                <h2 id="quick-buy-title" className="font-display text-lg font-semibold text-white">
                  {product.title}
                </h2>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  ${priceUSD.toFixed(2)} USD · {split.points.toFixed(2)} pts · oracle {aigOracle.toFixed(4)} USD/AIG
                </p>
                <p className="mt-1 text-[10px] text-slate-400">{split.plan.ruleLabel}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              {!split.plan.valid && split.plan.validationError ? (
                <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/90">
                  {split.plan.validationError}
                </p>
              ) : null}

              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-200/85">
                  Projected earn boost
                </p>
                <p className="mt-1 font-mono text-sm text-emerald-100">
                  +{impact.percentageIncrease}% to your earn rate · +{Math.round(impact.estimatedAigPerDay).toLocaleString()}{' '}
                  AIG/day
                </p>
                {roiOk ? (
                  <p className="mt-1 font-mono text-xs text-emerald-200/75">
                    Payback ≈ {impact.paybackTime.toFixed(1)} days (est.)
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Earn · before → after
                </p>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 font-mono text-sm">
                  <span className="text-slate-400">
                    {beforeAfter.beforeAigPerSecond.toExponential(2)} AIG/s
                  </span>
                  <span className="text-slate-600">→</span>
                  <span className="text-cyan-200">{beforeAfter.afterAigPerSecond.toExponential(2)} AIG/s</span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  ≈ {Math.round(beforeAfter.beforeAigPerDay).toLocaleString()} →{' '}
                  {Math.round(beforeAfter.afterAigPerDay).toLocaleString()} AIG/day
                </p>
              </div>

              <div>
                <AnimatedSplitBars aigPercent={split.aigPercent} reduceMotion={reduceMotion} />
                <div className="mt-3 grid gap-2 font-mono text-xs text-slate-300">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-500">AIG (checkout)</span>
                    <span className="text-cyan-200">
                      {split.aigAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} AIG
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-500">USDT (checkout)</span>
                    <span className="text-violet-200">
                      {split.usdtAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="text-slate-500">USD → AIG equiv.</span>
                    <span>{usdToAig(priceUSD).toFixed(2)} AIG (full price)</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <motion.button
                  type="button"
                  className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-[0_0_24px_rgba(139,92,246,0.35)]"
                  whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  onClick={() => {
                    onConfirm?.(product);
                    onClose();
                  }}
                >
                  Confirm · {cta}
                </motion.button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
