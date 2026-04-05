import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Share2, Sparkles, Wallet, Layers } from 'lucide-react';
import { GlassCard } from './GlassCard.jsx';
import { useCore } from '../core/CoreContext.jsx';
import { buildNextActionStateFromCore, getNextAction } from '../core/nextActionEngine.js';
import { fadeUpBlur } from '../motion/variants.js';
import { ACTION_PRIORITY_STYLES } from '../styles/actionPriorityStyles.js';

const ACTION_ICON = {
  staking: Layers,
  wallet: Wallet,
  network: Share2,
};

/**
 * AiGenesis decision layer — one next step (staking / wallet / network).
 * Pass economy props when available so rules match notifications and gating.
 * @param {{
 *   userHasActiveStaking?: boolean,
 *   holdingPctAig?: number,
 *   minHoldingPct?: number,
 *   userEconomicallyActive?: boolean,
 * }} [props]
 */
export function NextActionCard({
  userHasActiveStaking,
  holdingPctAig,
  minHoldingPct = 7,
  userEconomicallyActive,
} = {}) {
  const core = useCore();
  const shell = core.shell;

  const decision = useMemo(() => {
    const state = buildNextActionStateFromCore(core, {
      userHasActiveStaking,
      holdingPctAig,
      minHoldingPct,
      userEconomicallyActive,
    });
    return getNextAction(state);
  }, [
    core.hasSession,
    core.economicActive,
    core.directClaimUsdt,
    core.leftPts,
    core.rightPts,
    core.claimUi?.directClaimUsdt,
    userHasActiveStaking,
    holdingPctAig,
    minHoldingPct,
    userEconomicallyActive,
  ]);

  const tier = useMemo(() => {
    if (decision.healthy) return 'healthy';
    if (decision.priority === 'HIGH') return 'high';
    if (decision.priority === 'MEDIUM') return 'medium';
    return 'low';
  }, [decision.healthy, decision.priority]);

  const styles = ACTION_PRIORITY_STYLES[tier] ?? ACTION_PRIORITY_STYLES.medium;
  const Icon = ACTION_ICON[decision.action] ?? Sparkles;

  const runCta = () => {
    if (!shell?.onNavigate) return;
    shell.onNavigate(decision.action);
  };

  const priorityLabel =
    decision.healthy || decision.priority === 'LOW' ? 'OK' : decision.priority;

  return (
    <motion.div variants={fadeUpBlur} className="w-full max-w-md md:max-w-lg">
      <GlassCard
        hover={false}
        glowClassName={`${styles.glassGlow ?? ''} transition-shadow duration-500`}
        contentClassName="p-5 md:p-6"
      >
        <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/15 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${styles.badge}`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-semibold leading-snug text-white md:text-lg">
                  Siguiente paso
                </h3>
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles.badge}`}
                >
                  {priorityLabel}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-400">{decision.message}</p>
            </div>
          </div>

          <motion.button
            type="button"
            disabled={!shell}
            onClick={runCta}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wide ${styles.cta} disabled:cursor-not-allowed disabled:opacity-40`}
            whileHover={{ scale: shell ? 1.02 : 1 }}
            whileTap={{ scale: shell ? 0.98 : 1 }}
          >
            {decision.ctaLabel}
            <ArrowRight className="h-4 w-4 opacity-90" strokeWidth={2} />
          </motion.button>
        </div>
      </GlassCard>
    </motion.div>
  );
}
