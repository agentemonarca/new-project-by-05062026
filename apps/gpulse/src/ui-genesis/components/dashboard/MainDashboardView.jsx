import React, { useMemo } from 'react';
import { useRuntimeTrace } from '../../../utils/runtimeDiagnostics.js';
import { motion, useReducedMotion } from 'framer-motion';
import { Pickaxe, Sparkles, Wallet } from 'lucide-react';
import { AnimatedMetric } from '../AnimatedMetric.jsx';
import { ReactorCore } from '../energy/ReactorCore.jsx';
import { EnergyStats } from '../energy/EnergyStats.jsx';
import { NextActionCard } from '../NextActionCard.jsx';
import { AIDecisionCard } from '../AIDecisionCard.jsx';
import { ActivityFeed } from '../../widgets/ActivityFeed.jsx';
import { useCore } from '../../core/CoreContext.jsx';
import { useUiModeStore } from '../../stores/uiModeStore.js';
import { fadeUpBlur, staggerContainer } from '../../motion/variants.js';

const LITE_ACTIVITY_PREVIEW = [
  { id: 'lite-a1', text: 'Sincronización de balances', meta: 'Protocolo', tone: 'cyan' },
  { id: 'lite-a2', text: 'Motor de yield activo', meta: 'Tiempo real', tone: 'violet' },
  { id: 'lite-a3', text: 'Próximo: revisa wallet y staking', meta: 'Sugerido', tone: 'neutral' },
];

function formatUsdtPerSec(r) {
  if (r >= 0.001) return `+${r.toFixed(6)} /s`;
  return `+${r.toExponential(2)} USDT/s`;
}

/**
 * Hybrid dashboard — engine state from `useCore()`; only shell navigation callbacks here.
 * @param {{
 *   onNavigate: (id: string) => void,
 *   onOpenMarketplace: () => void,
 *   walletAddress: string | null,
 *   accountFrozen: boolean,
 *   holdingPct: number,
 *   minHoldingPct: number,
 *   userHasActiveStaking: boolean,
 *   referralActive: boolean,
 *   userEconomicallyActive: boolean,
 *   onGoToWallet: () => void,
 * }} props
 */
export function MainDashboardView({
  onNavigate,
  onOpenMarketplace,
  walletAddress,
  accountFrozen,
  holdingPct,
  minHoldingPct,
  userHasActiveStaking,
  referralActive,
  userEconomicallyActive,
  onGoToWallet,
}) {
  if (import.meta.env.DEV) console.count('Dashboard render');
  const reduceMotion = useReducedMotion();
  const uiMode = useUiModeStore((s) => s.uiMode);
  const isLite = uiMode === 'lite';

  const {
    cores,
    hasSession,
    aigBalance,
    totalYieldUsdtPerSecond,
    totalYieldAigPerSecond,
    claimUi,
  } = useCore();

  const ledgerNetUsdt = claimUi?.ledgerNetUsdt ?? 0;
  const minHoldingUsdt = claimUi?.minHoldingUsdt ?? 50;
  const claimBusy = Boolean(claimUi?.claimAllBusy);

  const holdingMet = hasSession && ledgerNetUsdt >= minHoldingUsdt;
  const missing = Math.max(0, minHoldingUsdt - ledgerNetUsdt);

  const frozenOrLocked = accountFrozen || !holdingMet || !userEconomicallyActive;

  const miningCoresOnly = useMemo(() => cores.filter((c) => c.type === 'mining'), [cores]);
  const totalInvestedUsdt = useMemo(
    () => miningCoresOnly.reduce((s, c) => s + (Number(c.contribution) || 0), 0),
    [miningCoresOnly],
  );
  const totalGenerationUsdt = useMemo(
    () => miningCoresOnly.reduce((s, c) => s + c.totalGenerated + c.accumulated, 0),
    [miningCoresOnly],
  );
  const roiProgressPct = useMemo(
    () => (totalInvestedUsdt > 0 ? Math.min(250, (totalGenerationUsdt / totalInvestedUsdt) * 100) : 0),
    [totalInvestedUsdt, totalGenerationUsdt],
  );

  const totalUsdEstimate = useMemo(() => {
    const aigUsd = Number(aigBalance) * 0.02;
    return ledgerNetUsdt + aigUsd;
  }, [ledgerNetUsdt, aigBalance]);

  useRuntimeTrace(
    'MainDashboardView',
    () => ({
      coresLen: cores?.length ?? 0,
      hasSession,
      claimBusy,
      ledgerNetUsdt,
      aigBalance,
    }),
    [cores, hasSession, claimBusy, ledgerNetUsdt, aigBalance],
  );

  return (
    <motion.div className="space-y-8" variants={staggerContainer} initial="hidden" animate="show">
      {/* 1. User status bar — Pro only */}
      {!isLite ? (
      <motion.section
        variants={fadeUpBlur}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs md:gap-6"
      >
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-medium text-slate-200">
          Wallet:{' '}
          <span className="font-mono text-cyan-200/90">
            {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : 'No conectada'}
          </span>
        </span>
        <span
          className={`rounded-full border px-3 py-1.5 font-semibold ${
            accountFrozen
              ? 'border-rose-500/40 bg-rose-500/15 text-rose-100'
              : holdingMet
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
                : 'border-amber-500/35 bg-amber-500/10 text-amber-100'
          }`}
        >
          Holding: {accountFrozen ? 'CONGELADA' : holdingMet ? 'OK' : 'BAJO'} (~{holdingPct.toFixed(1)}% AIG)
        </span>
        <span
          className={`rounded-full border px-3 py-1.5 font-semibold ${
            userEconomicallyActive
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
              : 'border-slate-500/35 bg-slate-800/50 text-slate-400'
          }`}
        >
          Economía: {userEconomicallyActive ? 'ACTIVA' : 'OFF'}
        </span>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 font-medium text-violet-100/95">
          Referral: {referralActive ? 'Activo' : '—'}
        </span>
      </motion.section>
      ) : null}

      {/* 2. Balance — Lite: simple; Pro: reactor + métricas energía */}
      <motion.section
        variants={fadeUpBlur}
        className={`relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-950/80 p-6 shadow-[0_0_48px_-12px_rgba(34,211,238,0.25)] md:p-8 ${isLite ? 'border-cyan-500/20' : ''}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.2),transparent_55%)]" />
        <div className={`relative z-10 grid gap-8 ${isLite ? '' : 'lg:grid-cols-[1fr_auto] lg:items-center'}`}>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200/90">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              {isLite ? 'Tu balance' : 'Valor total estimado'}
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total (USD aprox.)</p>
            <p className="font-display text-4xl font-bold tabular-nums text-white md:text-5xl">
              $
              <AnimatedMetric
                value={totalUsdEstimate}
                format={(v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              />
            </p>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Balance AIG</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-cyan-200/95">
              <AnimatedMetric
                value={aigBalance}
                format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} AIG`}
              />
            </p>
            {!isLite ? (
              <p className="mt-2 font-mono text-sm text-slate-500">
                Conversión tiempo real (motor) ≈{' '}
                <AnimatedMetric value={totalYieldAigPerSecond} format={(v) => `${Number(v).toFixed(6)} AIG/s`} />
              </p>
            ) : null}
          </div>
          {!isLite ? (
            <div className="flex flex-col items-center gap-4 lg:items-end">
              <ReactorCore className="max-w-[280px]" />
              <EnergyStats />
            </div>
          ) : null}
        </div>
        {!holdingMet && hasSession && !accountFrozen ? (
          <p className="relative z-10 mt-6 border-t border-amber-500/20 pt-4 text-xs text-amber-200/90">
            Añade {missing.toFixed(2)} USDT net al ledger para desbloquear acciones — mínimo {minHoldingUsdt} USDT.
          </p>
        ) : null}
      </motion.section>

      {/* 3. Siguiente paso (+ asesor IA en Pro) */}
      <motion.section variants={fadeUpBlur} className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <NextActionCard
          userHasActiveStaking={userHasActiveStaking}
          holdingPctAig={holdingPct}
          minHoldingPct={minHoldingPct}
          userEconomicallyActive={userEconomicallyActive}
        />
        {!isLite ? (
          <AIDecisionCard
            userHasActiveStaking={userHasActiveStaking}
            holdingPctAig={holdingPct}
            minHoldingPct={minHoldingPct}
            userEconomicallyActive={userEconomicallyActive}
            accountFrozen={accountFrozen}
          />
        ) : null}
      </motion.section>

      {/* 4. Estado minería — Pro */}
      {!isLite ? (
      <motion.section variants={fadeUpBlur} className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-white">Estado de minería</h3>
          <button
            type="button"
            onClick={() => onNavigate('mining')}
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
          >
            Gestionar →
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Invertido (cores)</p>
            <p className="mt-1 font-mono text-lg font-semibold text-white">
              ${totalInvestedUsdt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Progreso ROI (cap 250%)</p>
            <p className="mt-1 font-display text-2xl font-bold text-cyan-200">{roiProgressPct.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Ganancia / segundo</p>
            <p className="mt-1 font-mono text-lg text-cyan-200">
              <AnimatedMetric value={totalYieldUsdtPerSecond} format={formatUsdtPerSec} />
            </p>
          </div>
        </div>
      </motion.section>
      ) : null}

      {/* 5. Quick actions — financial ops solo en Wallet */}
      <motion.section variants={fadeUpBlur}>
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Acciones rápidas</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <motion.button
            type="button"
            disabled={frozenOrLocked}
            onClick={() => onNavigate('mining')}
            className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-600/30 to-sky-600/10 p-4 text-left transition hover:border-cyan-400/30 disabled:opacity-40"
            whileHover={reduceMotion || frozenOrLocked ? undefined : { y: -2 }}
          >
            <Pickaxe className="h-5 w-5 text-cyan-200" strokeWidth={1.75} />
            <span className="font-display text-sm font-semibold text-white">Productos</span>
            <span className="text-[11px] text-slate-400">Minería, booster y staking</span>
          </motion.button>
          <motion.button
            type="button"
            onClick={onGoToWallet}
            className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-blue-600/25 to-cyan-600/10 p-4 text-left transition hover:border-cyan-400/30"
            whileHover={reduceMotion ? undefined : { y: -2 }}
          >
            <Wallet className="h-5 w-5 text-cyan-200" strokeWidth={1.75} />
            <span className="font-display text-sm font-semibold text-white">Wallet</span>
            <span className="text-[11px] text-slate-400">Claim y retiros</span>
          </motion.button>
        </div>
      </motion.section>

      {/* Vista previa actividad — Lite (después de acciones rápidas) */}
      {isLite ? (
        <motion.section variants={fadeUpBlur}>
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Actividad (vista previa)
          </h3>
          <ActivityFeed items={LITE_ACTIVITY_PREVIEW} />
        </motion.section>
      ) : null}

      {/* Marketplace — Pro */}
      {!isLite ? (
      <motion.section variants={fadeUpBlur} className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-center text-sm text-slate-400">
        <button type="button" onClick={onOpenMarketplace} className="font-semibold text-cyan-400 hover:text-cyan-300">
          Abrir Marketplace →
        </button>
      </motion.section>
      ) : null}
    </motion.div>
  );
}
