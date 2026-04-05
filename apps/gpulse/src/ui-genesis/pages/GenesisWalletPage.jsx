import React, { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, ArrowDownToLine, Sparkles } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import { AnimatedMetric } from '../components/AnimatedMetric.jsx';
import { StatCardSkeleton } from '../components/StatCardSkeleton.jsx';
import { fadeUpBlur, staggerContainer } from '../motion/variants.js';
import { USDT_TO_AIG_DISPLAY } from '../types/miningCore.js';

/**
 * Single financial hub: claim + withdraw only here (Genesis shell).
 * @param {{
 *   hasSession: boolean,
 *   showSkeleton: boolean,
 *   ledgerNetUsdt: number,
 *   directClaimUsdt: number,
 *   leftPts: number,
 *   rightPts: number,
 *   totalUsdtAccumMining: number,
 *   aigBalanceDisplay: number,
 *   claimAllBusy: boolean,
 *   claimDisabled: boolean,
 *   accountFrozen: boolean,
 *   userEconomicallyActive: boolean,
 *   centralRewardBalanceAig: number,
 *   onClaimAll: () => Promise<void>,
 *   onWithdraw: () => void,
 * }} props
 */
export function GenesisWalletPage({
  hasSession,
  showSkeleton,
  ledgerNetUsdt,
  directClaimUsdt,
  leftPts,
  rightPts,
  totalUsdtAccumMining,
  aigBalanceDisplay,
  claimAllBusy,
  claimDisabled,
  accountFrozen,
  userEconomicallyActive = true,
  centralRewardBalanceAig = 0,
  onClaimAll,
  onWithdraw,
}) {
  const [localErr, setLocalErr] = useState(null);

  const binaryMin = Math.min(leftPts, rightPts);
  const miningAigRaw = totalUsdtAccumMining * USDT_TO_AIG_DISPLAY;
  const binaryAigRaw = binaryMin * USDT_TO_AIG_DISPLAY;
  const directAigRaw = directClaimUsdt * USDT_TO_AIG_DISPLAY;
  const miningAig = userEconomicallyActive ? miningAigRaw : 0;
  const binaryAig = userEconomicallyActive ? binaryAigRaw : 0;
  const directAig = userEconomicallyActive ? directAigRaw : 0;
  const totalClaimableAig = useMemo(
    () => Math.max(0, miningAig + binaryAig + directAig),
    [miningAig, binaryAig, directAig],
  );

  const runClaim = useCallback(async () => {
    setLocalErr(null);
    try {
      await onClaimAll();
    } catch (e) {
      setLocalErr(String(e?.message || e));
    }
  }, [onClaimAll]);

  const frozenOrDisabled = accountFrozen || claimDisabled;

  return (
    <motion.div className="space-y-8" variants={staggerContainer} initial="hidden" animate="show">
      <motion.section variants={fadeUpBlur} className="rounded-2xl border border-cyan-500/25 bg-slate-950/50 p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-600 to-violet-600 text-white shadow-lg">
            <Wallet className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-white">Wallet</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Único punto de control financiero: convertir ganancias USDT → AIG al precio vigente, consolidar en el balance
              de recompensas central y solicitar retiros.
            </p>
            <p className="mt-2 max-w-2xl text-xs text-slate-500">
              Claim y withdraw solo desde aquí. El resto del protocolo muestra estado sin ejecutar movimientos.
            </p>
          </div>
        </div>
      </motion.section>

      {showSkeleton ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((k) => (
            <StatCardSkeleton key={k} />
          ))}
        </div>
      ) : (
        <motion.div variants={fadeUpBlur} className="grid gap-4 lg:grid-cols-3">
          <GlassCard className="border-white/10 p-5" contentClassName="p-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total reclamable (AIG est.)</p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums text-white">
              <AnimatedMetric
                value={totalClaimableAig}
                format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} AIG`}
              />
            </p>
            <p className="mt-2 text-xs text-slate-500">Suma de fuentes activas (minado, binario, bono directo).</p>
          </GlassCard>
          <GlassCard className="border-white/10 p-5" contentClassName="p-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Saldo AIG (vista protocolo)</p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums text-cyan-200/95">
              <AnimatedMetric
                value={aigBalanceDisplay}
                format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} AIG`}
              />
            </p>
            <p className="mt-2 text-xs text-slate-500">Ledger neto USDT: {ledgerNetUsdt.toFixed(2)}</p>
          </GlassCard>
          <GlassCard className="border-violet-500/20 p-5" contentClassName="p-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Balance recompensas (central)</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-violet-100">
              <AnimatedMetric
                value={centralRewardBalanceAig}
                format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} AIG`}
              />
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Tras cada claim, el protocolo acredita aquí antes de retiro o reúso en el ecosistema.
            </p>
          </GlassCard>
        </motion.div>
      )}

      <motion.div variants={fadeUpBlur} className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Minería (acum. cores)', value: miningAig, sub: 'USDT en motor → AIG' },
          { label: 'Red binaria (emparejado)', value: binaryAig, sub: `Vol min L/R · ${binaryMin}` },
          { label: 'Bono directo', value: directAig, sub: 'Claimable ledger' },
        ].map((row) => (
          <GlassCard key={row.label} className="border-white/10 p-4" contentClassName="p-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{row.label}</p>
            <p className="mt-2 font-mono text-lg font-semibold text-white tabular-nums">
              {hasSession ? `${row.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} AIG` : '—'}
            </p>
            <p className="mt-1 text-[10px] text-slate-600">{row.sub}</p>
          </GlassCard>
        ))}
      </motion.div>

      <motion.div variants={fadeUpBlur} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <GradientButton
          type="button"
          className="!px-8 !py-3.5"
          disabled={!hasSession || frozenOrDisabled || claimAllBusy}
          onClick={runClaim}
        >
          <Sparkles className="mr-2 inline h-4 w-4" />
          {claimAllBusy ? 'Reclamando…' : 'Claim ALL'}
        </GradientButton>
        <GradientButton
          type="button"
          variant="ghost"
          className="!border-cyan-500/40 !px-8 !py-3.5"
          disabled={!hasSession || accountFrozen}
          onClick={onWithdraw}
        >
          <ArrowDownToLine className="mr-2 inline h-4 w-4" />
          Withdraw
        </GradientButton>
      </motion.div>
      {!userEconomicallyActive && hasSession ? (
        <p className="text-xs text-amber-200/90">
          Economía inactiva: no se acreditan nuevos volúmenes ni bonus. Activa staking y mantén 7% en AIG para reclamar el
          flujo completo.
        </p>
      ) : null}
      {accountFrozen ? (
        <p className="text-xs text-amber-200/90">Acciones congeladas hasta cumplir el mínimo de holding en AIG.</p>
      ) : null}
      {localErr ? <p className="text-sm text-rose-300">{localErr}</p> : null}
    </motion.div>
  );
}
