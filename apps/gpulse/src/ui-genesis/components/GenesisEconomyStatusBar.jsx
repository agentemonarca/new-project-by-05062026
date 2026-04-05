import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Layers, Percent, Wallet } from 'lucide-react';

/**
 * Global protocol status: staking, AIG holding %, account state.
 * @param {{
 *   hasSession: boolean,
 *   walletAddress: string | null,
 *   userHasActiveStaking: boolean,
 *   holdingPct: number,
 *   minHoldingPct: number,
 *   accountFrozen: boolean,
 *   userEconomicallyActive: boolean,
 * }} props
 */
export function GenesisEconomyStatusBar({
  hasSession,
  walletAddress,
  userHasActiveStaking,
  holdingPct,
  minHoldingPct,
  accountFrozen,
  userEconomicallyActive,
}) {
  const walletLabel = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : '—';

  const accountLabel = !hasSession
    ? 'OFFLINE'
    : accountFrozen
      ? 'CONGELADO'
      : !userHasActiveStaking
        ? 'INACTIVO'
        : userEconomicallyActive
          ? 'ACTIVO'
          : 'INACTIVO';

  const accountClass = !hasSession
    ? 'border-slate-500/35 bg-slate-500/10 text-slate-300'
    : accountFrozen
      ? 'border-rose-500/40 bg-rose-500/15 text-rose-100'
      : userEconomicallyActive
        ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-100'
        : 'border-amber-500/40 bg-amber-500/12 text-amber-100';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="border-b border-cyan-500/15 bg-slate-950/65 px-4 py-2.5 backdrop-blur-xl md:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] md:gap-3 md:text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-medium text-slate-200">
            <Wallet className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-mono text-cyan-100/90">{walletLabel}</span>
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
              userHasActiveStaking
                ? 'border-violet-500/35 bg-violet-500/12 text-violet-100'
                : 'border-slate-500/35 bg-slate-800/50 text-slate-400'
            }`}
          >
            <Layers className="h-3.5 w-3.5 shrink-0" />
            Staking: {userHasActiveStaking ? 'ACTIVO' : 'INACTIVO'}
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
              hasSession && holdingPct + 1e-6 >= minHoldingPct
                ? 'border-cyan-500/35 bg-cyan-500/10 text-cyan-100'
                : 'border-amber-500/35 bg-amber-500/10 text-amber-100'
            }`}
          >
            <Percent className="h-3.5 w-3.5 shrink-0" />
            AIG ~{holdingPct.toFixed(1)}% · mín. {minHoldingPct}%
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-bold uppercase tracking-wide ${accountClass}`}
          >
            <Activity className="h-3.5 w-3.5 shrink-0" />
            Cuenta · {accountLabel}
          </span>
        </div>
        <p className="max-w-xl text-[10px] leading-snug text-slate-500 sm:text-right md:text-xs">
          Ingresos solo con cuenta <span className="text-emerald-200/90">ACTIVA</span>: staking +{' '}
          <span className="font-mono text-slate-300">{minHoldingPct}%</span> AIG y sin congelación.
        </p>
      </div>
    </motion.div>
  );
}
