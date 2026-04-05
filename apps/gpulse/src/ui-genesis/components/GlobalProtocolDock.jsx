import React from 'react';
import { Activity, Droplets, Layers, Wallet } from 'lucide-react';
import { GradientButton } from './GradientButton.jsx';

/**
 * Sticky global status + quick protocol actions (no claim — claims only in Wallet).
 */
export function GlobalProtocolDock({
  hasSession,
  ledgerNetUsdt,
  minHoldingUsdt,
  rateUsdtPerSecond,
  accountFrozen,
  userEconomicallyActive = false,
  userHasActiveStaking = false,
  onInject,
  onStaking,
  onOpenWallet,
}) {
  const holdingOk = hasSession && ledgerNetUsdt >= minHoldingUsdt;
  const statusLabel = !hasSession
    ? 'No session'
    : accountFrozen
      ? 'Congelado · <7% AIG'
      : !userHasActiveStaking
        ? 'Inactivo · sin staking'
        : !userEconomicallyActive
          ? 'Economía off'
          : !holdingOk
            ? 'Ledger bajo'
            : rateUsdtPerSecond > 0
              ? 'Activos generando'
              : 'Idle';

  return (
    <div className="sticky top-0 z-30 border-b border-white/[0.07] bg-slate-950/75 px-4 py-2.5 backdrop-blur-xl md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
              userEconomicallyActive
                ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-100/95'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-100/90'
            }`}
          >
            <Activity className={`h-3.5 w-3.5 ${userEconomicallyActive ? 'text-emerald-400' : 'text-amber-300'}`} />
            {statusLabel}
          </span>
          <span className="font-mono text-slate-400 tabular-nums">
            Σ rate{' '}
            <span className="text-cyan-200/90">
              {rateUsdtPerSecond < 0.001
                ? rateUsdtPerSecond.toExponential(2)
                : rateUsdtPerSecond.toFixed(6)}{' '}
              USDT/s
            </span>
          </span>
          {hasSession ? (
            <span className="text-slate-500">
              Ledger <span className="font-mono text-slate-300">{ledgerNetUsdt.toFixed(2)}</span> USDT
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-[10px] text-slate-500 sm:inline">
            Claims y retiros →{' '}
          </span>
          <GradientButton
            type="button"
            variant="ghost"
            className="!border-cyan-500/35 !bg-cyan-500/10 !py-2 !text-[11px] !uppercase !tracking-wide !text-cyan-100"
            onClick={onOpenWallet}
          >
            <Wallet className="mr-1 h-3.5 w-3.5" />
            Wallet
          </GradientButton>
          <GradientButton
            type="button"
            className="!py-2 !text-[11px] !uppercase !tracking-wide"
            disabled={Boolean(accountFrozen)}
            onClick={onInject}
          >
            <Droplets className="mr-1 h-3.5 w-3.5" />
            Invertir
          </GradientButton>
          <GradientButton
            type="button"
            variant="ghost"
            className="!border-violet-500/35 !bg-violet-500/10 !py-2 !text-[11px] !uppercase !tracking-wide !text-violet-100"
            disabled={Boolean(accountFrozen)}
            onClick={onStaking}
          >
            <Layers className="mr-1 h-3.5 w-3.5" />
            Staking
          </GradientButton>
        </div>
      </div>
    </div>
  );
}
