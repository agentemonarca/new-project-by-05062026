import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedMetric } from '../AnimatedMetric.jsx';
import { GradientButton } from '../GradientButton.jsx';
import {
  coreRemainingUsdt,
  getStakingLockedAig,
  isStakingFlexible,
  stakingLockRemainingDays,
  stakingLockTimeProgress01,
  stakingProgramLabel,
} from '../../types/miningCore.js';
import { usdToAig } from '../../../utils/pricing.js';

function coreDisplayIndex(core) {
  const tail = core.id.split('-').pop();
  return /^\d+$/.test(tail) ? tail : core.id.slice(-6);
}

/**
 * @param {{
 *   core: import('../../types/miningCore.js').MiningCore,
 *   onClaim: () => void,
 *   onWithdraw: () => void,
 *   claiming: boolean,
 *   canClaim: boolean,
 *   hasSession: boolean,
 *   hideInlineFinancialActions?: boolean,
 *   onGoToWallet?: () => void,
 * }} props
 */
export function StakingCoreCard({
  core,
  onClaim,
  onWithdraw,
  claiming,
  canClaim: _canClaim,
  hasSession,
  hideInlineFinancialActions = false,
  onGoToWallet,
}) {
  const reduceMotion = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const claimThreshold = 0.0001;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = stakingLockRemainingDays(core, now);
  const totalDays = core.lockDurationDays ?? 0;
  const flex = isStakingFlexible(core);
  const headroom = coreRemainingUsdt(core);
  const locked = getStakingLockedAig(core);
  const program = stakingProgramLabel(core);

  const timeProgress01 = flex ? core.progress : stakingLockTimeProgress01(core, now);
  const barFill = flex ? core.progress : stakingLockTimeProgress01(core, now);

  const lockComplete = !flex && totalDays > 0 && remaining === 0;
  const participationDone = headroom <= 0 && core.accumulated <= 1e-8;
  const completed = lockComplete || participationDone;

  const statusLabel = completed ? 'COMPLETADO' : '🔒 BLOQUEADO';

  const withdrawDisabledReason =
    !flex && !lockComplete ? 'Disponible al finalizar el periodo de bloqueo' : undefined;

  /** Reclamar recompensas solo tras finalizar el bloqueo (programas con plazo). */
  const claimAllowed = hasSession && core.accumulated > claimThreshold && (flex || lockComplete);

  const showWithdraw = flex || lockComplete;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { scale: 1.01 }}
      className="group relative h-full"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <motion.div
          className="absolute left-1/2 top-1/2 h-[200%] min-h-[110%] w-[200%] min-w-[110%] -translate-x-1/2 -translate-y-1/2 opacity-[0.75]"
          style={{
            background: 'conic-gradient(from 0deg, #3b82f6, #2563eb, #0ea5e9, #38bdf8, #3b82f6)',
          }}
          animate={reduceMotion ? { rotate: 0 } : { rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      <div className="relative m-[1px] overflow-hidden rounded-2xl border border-blue-500/20 bg-slate-950/85 p-5 shadow-[0_0_28px_-8px_rgba(37,99,235,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-cyan-500/8" />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-display text-sm font-semibold text-white">
                🔒 Núcleo Staking #{coreDisplayIndex(core)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Programa: <span className="text-sky-200/90">{program}</span>
              </p>
            </div>
            <span className="rounded-full border border-slate-600/50 bg-slate-900/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
              {statusLabel}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Bloqueado</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
                {locked.toLocaleString(undefined, { maximumFractionDigits: 0 })} AIG
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tiempo restante</p>
              <p className="mt-0.5 text-sm text-sky-100/95">
                {flex ? 'Sin plazo fijo' : `${remaining} días`}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Generación</p>
            <p className="mt-0.5 font-mono text-sm text-cyan-200/90">
              +
              <AnimatedMetric
                value={headroom > 0 ? core.ratePerSecond : 0}
                format={(v) =>
                  `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })} USDT / seg`
                }
              />
            </p>
          </div>

          <div className="grid gap-1 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Acumulado (USDT)</p>
              <p className="font-semibold tabular-nums text-white">
                <AnimatedMetric value={core.accumulated} format={(v) => `$${Number(v).toFixed(2)}`} />
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Equivalente AIG</p>
              <p className="font-mono text-sm text-slate-300">
                ≈{' '}
                <AnimatedMetric
                  value={usdToAig(core.accumulated)}
                  format={(v) => Number(v).toFixed(2)}
                />{' '}
                AIG
              </p>
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-[10px] text-slate-500">
              <span>Progreso</span>
              <span className="tabular-nums text-slate-400">
                {flex ? (
                  <>Generación del núcleo · {Math.round(timeProgress01 * 100)}%</>
                ) : (
                  <>
                    {remaining} / {totalDays} días
                  </>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400"
                initial={false}
                animate={{ width: `${Math.round(barFill * 100)}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {hideInlineFinancialActions ? (
              <GradientButton
                type="button"
                variant="ghost"
                className="!border-cyan-500/35 !bg-cyan-500/10 !py-2.5 !text-xs !text-cyan-100"
                disabled={!hasSession}
                onClick={onGoToWallet}
              >
                Retiros y reclamaciones → Wallet
              </GradientButton>
            ) : (
              <>
                <GradientButton
                  type="button"
                  variant="ghost"
                  className="!border-sky-500/35 !bg-sky-500/10 !py-2.5 !text-xs !text-sky-100 hover:!bg-sky-500/15"
                  disabled={!claimAllowed}
                  title={!flex && !lockComplete ? 'Claim bloqueado hasta finalizar el periodo' : undefined}
                  onClick={onClaim}
                >
                  {claiming ? 'Procesando…' : !flex && !lockComplete ? 'Reclamo bloqueado' : 'Reclamar AIG'}
                </GradientButton>

                {showWithdraw ? (
                  <GradientButton
                    type="button"
                    variant="ghost"
                    className="!border-blue-500/30 !bg-blue-500/8 !py-2.5 !text-xs !text-blue-100 hover:!bg-blue-500/12"
                    disabled={!hasSession}
                    onClick={onWithdraw}
                  >
                    Retirar
                  </GradientButton>
                ) : (
                  <span title={withdrawDisabledReason}>
                    <GradientButton
                      type="button"
                      variant="ghost"
                      className="!cursor-not-allowed !border-slate-600/40 !bg-slate-900/40 !py-2.5 !text-xs !text-slate-500"
                      disabled
                    >
                      Retirar
                    </GradientButton>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
