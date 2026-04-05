import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MiningCoreCard } from './MiningCoreCard.jsx';
import { ProtocolEnergyField } from './ProtocolEnergyField.jsx';
import { ProtocolDisclaimer } from './ProtocolDisclaimer.jsx';
import { GradientButton } from './GradientButton.jsx';
import { staggerContainer, fadeUpBlur } from '../motion/variants.js';
import { useCore } from '../core/CoreContext.jsx';

/**
 * Mining view: data from CoreContext (single mining snapshot).
 * @param {{ hideNonWalletFinancialActions?: boolean, onGoToWallet?: () => void, onActivatePurchase?: () => void, onOpenMiningWarning?: () => void }} props
 */
export function MiningCoreSystem({
  hideNonWalletFinancialActions = false,
  onGoToWallet,
  onActivatePurchase,
  onOpenMiningWarning,
} = {}) {
  const { mining, hasSession } = useCore();
  const { cores, claimCore, claimingId } = mining;
  const summary = useMemo(
    () => ({
      totalRatePerSecond: mining.totalPower,
      totalAccumulated: mining.totalAccumulated,
      totalGeneration: mining.totalGeneration,
    }),
    [mining.totalPower, mining.totalAccumulated, mining.totalGeneration],
  );

  return (
    <motion.div className="space-y-8" variants={staggerContainer} initial="hidden" animate="show">
      <motion.section variants={fadeUpBlur} className="rounded-2xl border border-cyan-500/20 bg-slate-950/50 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">Mining Core System</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Each liquidity contribution runs as its own <strong className="font-medium text-slate-300">core</strong> with
              an independent generation rate, buffer, and lifecycle cap. Cores accrue in parallel; claim each core when
              you are ready.
            </p>
          </div>
          {onActivatePurchase && hasSession ? (
            <GradientButton type="button" variant="ghost" className="!shrink-0 !border-cyan-500/30 !text-xs" onClick={onActivatePurchase}>
              Activar con pago
            </GradientButton>
          ) : null}
        </div>
        <div className="mt-6">
          <ProtocolDisclaimer variant="compact" />
        </div>
        {onOpenMiningWarning ? (
          <button
            type="button"
            className="mt-3 text-left text-[11px] font-medium text-cyan-400/90 hover:text-cyan-300"
            onClick={onOpenMiningWarning}
          >
            Aviso completo de minería →
          </button>
        ) : null}
      </motion.section>

      <motion.div variants={fadeUpBlur}>
        <ProtocolEnergyField
          totalRatePerSecond={summary.totalRatePerSecond}
          totalAccumulated={summary.totalAccumulated}
          hasSession={hasSession}
          coreCount={cores.length}
        />
      </motion.div>

      <motion.div
        variants={fadeUpBlur}
        className="relative flex flex-col items-center gap-2 py-2"
        aria-hidden
      >
        <div className="h-px w-full max-w-2xl bg-gradient-to-r from-transparent from-30% via-violet-500/25 via-50% to-transparent to-70%" />
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-600">Campo → núcleos</p>
      </motion.div>

      <div>
        <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-slate-500">Your cores</h3>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {cores.map((core) => (
            <MiningCoreCard
              key={core.id}
              core={core}
              claiming={claimingId === core.id}
              canClaim={hasSession && core.accumulated >= 0.0001}
              onClaim={() => claimCore(core)}
              hideFinancialActions={hideNonWalletFinancialActions}
              onGoToWallet={onGoToWallet}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
