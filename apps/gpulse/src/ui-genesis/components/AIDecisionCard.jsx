import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  LayoutDashboard,
  Layers,
  Share2,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { GlassCard } from './GlassCard.jsx';
import { useCore } from '../core/CoreContext.jsx';
import { buildAIDecisionInputFromCore, getAIDecision } from '../core/AIDecisionEngine.js';
import { fadeUpBlur } from '../motion/variants.js';

/** Priority → advisor chrome (red / yellow / blue / green). */
const PRIORITY_THEME = {
  critical: {
    glow: 'border-rose-500/50 shadow-[0_0_44px_-10px_rgba(244,63,94,0.38)]',
    badge: 'border-rose-400/55 bg-rose-500/20 text-rose-50',
    label: 'Crítico',
    impactBox: 'border-rose-500/35 bg-rose-950/25 text-rose-100/95',
    predictionBox: 'border-rose-500/20 bg-rose-950/15 text-rose-200/85',
    cta: 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-[0_0_26px_rgba(244,63,94,0.35)]',
  },
  warning: {
    glow: 'border-amber-400/50 shadow-[0_0_40px_-10px_rgba(251,191,36,0.32)]',
    badge: 'border-amber-400/55 bg-amber-500/18 text-amber-50',
    label: 'Atención',
    impactBox: 'border-amber-500/35 bg-amber-950/25 text-amber-100/95',
    predictionBox: 'border-amber-500/25 bg-amber-950/15 text-amber-100/88',
    cta: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_0_24px_rgba(251,191,36,0.3)]',
  },
  opportunity: {
    glow: 'border-sky-500/50 shadow-[0_0_40px_-10px_rgba(56,189,248,0.3)]',
    badge: 'border-sky-400/55 bg-sky-500/18 text-sky-50',
    label: 'Oportunidad',
    impactBox: 'border-sky-500/35 bg-sky-950/25 text-sky-100/95',
    predictionBox: 'border-sky-500/20 bg-sky-950/15 text-sky-100/85',
    cta: 'bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-[0_0_24px_rgba(56,189,248,0.32)]',
  },
  healthy: {
    glow: 'border-emerald-500/45 shadow-[0_0_40px_-10px_rgba(52,211,153,0.28)]',
    badge: 'border-emerald-400/55 bg-emerald-500/16 text-emerald-50',
    label: 'Saludable',
    impactBox: 'border-emerald-500/35 bg-emerald-950/22 text-emerald-100/95',
    predictionBox: 'border-emerald-500/20 bg-emerald-950/12 text-emerald-100/85',
    cta: 'border border-emerald-500/45 bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/25',
  },
};

const ACTION_ICON = {
  staking: Layers,
  wallet: Wallet,
  network: Share2,
  dashboard: LayoutDashboard,
};

const CTA_LABEL = {
  staking: 'Ir a staking',
  wallet: 'Ir a Portfolio',
  network: 'Ver red',
  dashboard: 'Ir al inicio',
};

/**
 * AiGenesis “intelligent advisor” card — impact + prediction + CTA.
 * @param {{
 *   userHasActiveStaking?: boolean,
 *   holdingPctAig?: number,
 *   minHoldingPct?: number,
 *   userEconomicallyActive?: boolean,
 *   accountFrozen?: boolean,
 *   activity?: { engagement?: 'idle'|'low'|'steady'|'high' },
 * }} [props]
 */
export function AIDecisionCard({
  userHasActiveStaking,
  holdingPctAig,
  minHoldingPct = 7,
  userEconomicallyActive,
  accountFrozen,
  activity,
} = {}) {
  const core = useCore();
  const shell = core.shell;

  const decision = useMemo(() => {
    const input = buildAIDecisionInputFromCore(core, {
      userHasActiveStaking,
      holdingPctAig,
      minHoldingPct,
      userEconomicallyActive,
      accountFrozen,
      activity,
    });
    return getAIDecision(input);
  }, [
    core.hasSession,
    core.economicActive,
    core.directClaimUsdt,
    core.leftPts,
    core.rightPts,
    core.totalYieldUsdtPerSecond,
    core.cores,
    core.claimUi?.accountFrozen,
    core.claimUi?.directClaimUsdt,
    userHasActiveStaking,
    holdingPctAig,
    minHoldingPct,
    userEconomicallyActive,
    accountFrozen,
    activity,
  ]);

  const theme = PRIORITY_THEME[decision.priority] ?? PRIORITY_THEME.healthy;
  const Icon = ACTION_ICON[decision.action] ?? Sparkles;
  const ctaLabel = CTA_LABEL[decision.action] ?? 'Continuar';

  const runCta = () => {
    if (!shell?.onNavigate) return;
    shell.onNavigate(decision.action);
  };

  return (
    <motion.div variants={fadeUpBlur} className="w-full max-w-md md:max-w-lg">
      <GlassCard
        hover={false}
        glowClassName={`${theme.glow} transition-shadow duration-500`}
        contentClassName="p-5 md:p-6"
      >
        <div className="pointer-events-none absolute -left-6 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-gradient-to-tr from-violet-500/15 to-cyan-500/10 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${theme.badge}`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300"
                >
                  <BrainCircuit className="h-3 w-3 text-cyan-300/90" />
                  Asesor IA
                </span>
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${theme.badge}`}
                >
                  {theme.label}
                </span>
              </div>
              <h3 className="font-display text-base font-semibold leading-snug text-white md:text-lg">
                {decision.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-400">{decision.message}</p>
            </div>
          </div>

          <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${theme.impactBox}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Impacto</p>
            <p className="mt-1.5 font-medium">{decision.impact}</p>
          </div>

          <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${theme.predictionBox}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Proyección</p>
            <p className="mt-1.5 italic text-slate-200/95">{decision.prediction}</p>
          </div>

          <motion.button
            type="button"
            disabled={!shell}
            onClick={runCta}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wide ${theme.cta} disabled:cursor-not-allowed disabled:opacity-40`}
            whileHover={{ scale: shell ? 1.02 : 1 }}
            whileTap={{ scale: shell ? 0.98 : 1 }}
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4 opacity-90" strokeWidth={2} />
          </motion.button>
        </div>
      </GlassCard>
    </motion.div>
  );
}
