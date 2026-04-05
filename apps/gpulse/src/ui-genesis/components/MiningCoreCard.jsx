import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pickaxe, Cpu, Layers } from 'lucide-react';
import { GradientButton } from './GradientButton.jsx';
import { AnimatedMetric } from './AnimatedMetric.jsx';
import { USDT_TO_AIG_DISPLAY, coreRemainingUsdt } from '../types/miningCore.js';

/** Reactor palette: glow + conic border + progress bar */
const TYPE_REACTOR = {
  mining: {
    label: 'Mining',
    icon: Pickaxe,
    bar: 'from-cyan-400 via-cyan-500 to-sky-400',
    badge: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.25)]',
    rateText: 'text-cyan-200/95',
    conic: 'conic-gradient(from 0deg, #22d3ee, #06b6d4, #0891b2, #0e7490, #22d3ee)',
    shadowIdle: '0 0 28px rgba(34,211,238,0.22), 0 0 56px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
    shadowPulse: '0 0 40px rgba(34,211,238,0.45), 0 0 72px rgba(34,211,238,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
    shadowHover: '0 0 48px rgba(34,211,238,0.55), 0 0 96px rgba(34,211,238,0.22), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  booster: {
    label: 'Booster',
    icon: Cpu,
    bar: 'from-violet-500 via-fuchsia-500 to-violet-400',
    badge: 'border-violet-400/40 bg-violet-500/15 text-violet-100 shadow-[0_0_20px_rgba(139,92,246,0.3)]',
    rateText: 'text-violet-200/95',
    conic: 'conic-gradient(from 0deg, #a78bfa, #8b5cf6, #c084fc, #d946ef, #a78bfa)',
    shadowIdle: '0 0 28px rgba(139,92,246,0.24), 0 0 56px rgba(192,132,252,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
    shadowPulse: '0 0 42px rgba(139,92,246,0.48), 0 0 80px rgba(217,70,239,0.16), inset 0 1px 0 rgba(255,255,255,0.08)',
    shadowHover: '0 0 52px rgba(139,92,246,0.58), 0 0 100px rgba(192,132,252,0.22), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  staking: {
    label: 'Staking',
    icon: Layers,
    bar: 'from-blue-500 via-sky-400 to-blue-400',
    badge: 'border-blue-400/40 bg-blue-500/12 text-blue-100 shadow-[0_0_20px_rgba(59,130,246,0.28)]',
    rateText: 'text-sky-200/95',
    conic: 'conic-gradient(from 0deg, #3b82f6, #2563eb, #0ea5e9, #38bdf8, #3b82f6)',
    shadowIdle: '0 0 28px rgba(59,130,246,0.22), 0 0 56px rgba(14,165,233,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
    shadowPulse: '0 0 40px rgba(59,130,246,0.45), 0 0 76px rgba(14,165,233,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
    shadowHover: '0 0 50px rgba(59,130,246,0.55), 0 0 100px rgba(56,189,248,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
};

function formatRate(r) {
  if (r >= 0.001) return `${r.toFixed(6)} USDT/s`;
  return `${r.toExponential(2)} USDT/s`;
}

/**
 * @param {{
 *   core: import('../types/miningCore.js').MiningCore,
 *   onClaim: () => void,
 *   claiming: boolean,
 *   canClaim: boolean,
 *   hideFinancialActions?: boolean,
 *   onGoToWallet?: () => void,
 * }} props
 */
export function MiningCoreCard({ core, onClaim, claiming, canClaim, hideFinancialActions = false, onGoToWallet }) {
  const reactor = TYPE_REACTOR[core.type] ?? TYPE_REACTOR.mining;
  const Icon = reactor.icon;
  const remaining = coreRemainingUsdt(core);
  const pct = Math.round(Math.min(100, Math.max(0, core.progress * 100)));
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      className="group relative h-full"
      style={{ transformOrigin: 'center center' }}
    >
      {/* Moving gradient border (reactor ring) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <motion.div
          className="absolute left-1/2 top-1/2 h-[220%] min-h-[120%] w-[220%] min-w-[120%] -translate-x-1/2 -translate-y-1/2 opacity-[0.85]"
          style={{ background: reactor.conic }}
          animate={reduceMotion ? { rotate: 0 } : { rotate: 360 }}
          transition={{ duration: 14, repeat: reduceMotion ? 0 : Infinity, ease: 'linear' }}
        />
      </div>

      {/* Inner reactor body */}
      <motion.div
        className="relative z-10 m-[1px] overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/[0.94] p-5 backdrop-blur-xl md:p-6"
        initial={false}
        animate={
          reduceMotion
            ? { boxShadow: reactor.shadowIdle }
            : {
                boxShadow: [reactor.shadowIdle, reactor.shadowPulse, reactor.shadowIdle],
              }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
        }
        whileHover={reduceMotion ? undefined : { boxShadow: reactor.shadowHover }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255,255,255,0.25), transparent 55%)',
          }}
        />

        <div className="relative mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.span
              className={`flex h-11 w-11 items-center justify-center rounded-xl border ${reactor.badge}`}
              animate={reduceMotion ? {} : { scale: [1, 1.03, 1] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
            </motion.span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Core</p>
              <p className="font-display text-sm font-semibold text-white">{reactor.label}</p>
              <p className="mt-0.5 font-mono text-[10px] text-slate-600">{core.id}</p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-slate-400">
            Live
          </span>
        </div>

        <dl className="relative grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Contribution</dt>
            <dd className={`mt-0.5 font-mono ${reactor.rateText}`}>
              <AnimatedMetric
                value={core.contribution}
                format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`}
              />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Generation rate</dt>
            <dd className={`mt-0.5 font-mono ${reactor.rateText}`}>{formatRate(core.ratePerSecond)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Accumulated</dt>
            <dd className="mt-0.5 font-mono text-emerald-200/95">
              <AnimatedMetric
                value={core.accumulated}
                format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })} USDT`}
              />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">AIG (equiv.)</dt>
            <dd className="mt-0.5 font-mono text-violet-200/90">
              <AnimatedMetric
                value={core.accumulated * USDT_TO_AIG_DISPLAY}
                format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} AIG`}
              />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total generated</dt>
            <dd className="mt-0.5 font-mono text-slate-200">
              <AnimatedMetric
                value={core.totalGenerated}
                format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`}
              />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Remaining</dt>
            <dd className="mt-0.5 font-mono text-slate-300">
              <AnimatedMetric
                value={remaining}
                format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`}
              />
            </dd>
          </div>
        </dl>

        <div className="relative mt-5">
          <div className="mb-1.5 flex justify-between text-[10px] text-slate-500">
            <span>Energy to cap</span>
            <span className={`font-mono ${reactor.rateText}`}>{pct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full border border-white/10 bg-slate-950/90 shadow-[inset_0_1px_8px_rgba(0,0,0,0.45)]">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${reactor.bar}`}
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 110, damping: 20 }}
              style={{
                boxShadow: '0 0 12px rgba(255,255,255,0.15)',
              }}
            />
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-5">
          <p className="max-w-[14rem] text-[10px] leading-relaxed text-slate-500">
            {hideFinancialActions
              ? 'Reclamaciones consolidadas en Wallet (único hub financiero).'
              : 'Claims use the protocol channel for this engine; backend may aggregate by type.'}
          </p>
          {hideFinancialActions ? (
            <GradientButton
              type="button"
              variant="ghost"
              className="!border-cyan-500/35 !px-5 !py-2 !text-xs"
              onClick={onGoToWallet}
            >
              Ir a Wallet
            </GradientButton>
          ) : (
            <GradientButton
              type="button"
              className="!px-5 !py-2 !text-xs font-semibold"
              disabled={!canClaim || claiming || core.accumulated < 0.0001}
              onClick={onClaim}
            >
              {claiming ? 'Claiming…' : 'Claim rewards'}
            </GradientButton>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
