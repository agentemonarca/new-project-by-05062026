import React from 'react';
import { motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight, Menu, Sparkles } from 'lucide-react';
import { GradientButton } from './GradientButton.jsx';

function shortAddr(addr) {
  if (!addr || addr.length < 10) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatUsd(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n >= 1000 ? 0 : 2,
  }).format(n);
}

/**
 * Minimal Web3 top bar: logo · single status · wallet + balance + one primary CTA.
 *
 * @param {{
 *   onMenu: () => void,
 *   onToggleSidebarCollapse?: () => void,
 *   sidebarCollapsed?: boolean,
 *   onLogoClick?: () => void,
 *   hasSession: boolean,
 *   userEconomicallyActive: boolean,
 *   accountFrozen: boolean,
 *   walletAddress: string | null | undefined,
 *   balanceUsd: number | null | undefined,
 *   balanceLoading?: boolean,
 *   primaryLabel: string,
 *   onPrimaryAction: () => void,
 *   trailing?: React.ReactNode,
 * }} props
 */
export function Topbar({
  onMenu,
  onToggleSidebarCollapse,
  sidebarCollapsed = false,
  onLogoClick,
  hasSession,
  userEconomicallyActive,
  accountFrozen,
  walletAddress,
  balanceUsd,
  balanceLoading = false,
  primaryLabel,
  onPrimaryAction,
  trailing = null,
}) {
  const active = Boolean(hasSession && userEconomicallyActive && !accountFrozen);
  let dotClass = 'bg-slate-500';
  if (hasSession && accountFrozen) dotClass = 'bg-rose-400';
  else if (active) dotClass = 'bg-emerald-400';
  else if (hasSession) dotClass = 'bg-amber-400';

  const balanceShown =
    balanceLoading && hasSession ? '…' : hasSession ? formatUsd(balanceUsd ?? 0) : '—';

  return (
    <header className="flex-shrink-0 border-b border-white/[0.08] bg-slate-950/55 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 md:gap-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-200 md:hidden"
            onClick={onMenu}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </motion.button>
          {onToggleSidebarCollapse ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              className="hidden rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-200 transition-colors hover:border-white/15 hover:bg-white/[0.07] md:inline-flex"
              onClick={onToggleSidebarCollapse}
              aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
              aria-pressed={sidebarCollapsed}
            >
              {sidebarCollapsed ? (
                <ChevronsRight className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <ChevronsLeft className="h-5 w-5" strokeWidth={1.75} />
              )}
            </motion.button>
          ) : null}
          <button
            type="button"
            onClick={onLogoClick}
            className="flex min-w-0 items-center gap-2 rounded-lg text-left outline-none ring-cyan-400/0 transition hover:bg-white/[0.04] focus-visible:ring-2"
            aria-label="Inicio AiGenesis"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/15 to-violet-600/15 text-cyan-200 shadow-[0_0_20px_-8px_rgba(34,211,238,0.4)]">
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="hidden font-display text-sm font-semibold tracking-tight text-white sm:inline md:text-base">
              AiGenesis
            </span>
          </button>
        </div>

        <div className="flex justify-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5"
            title={hasSession ? (active ? 'Cuenta operativa' : 'Cuenta sin economía activa') : 'Sin sesión'}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ring-2 ring-slate-950 ${dotClass}`} aria-hidden />
            <span className="text-xs font-semibold text-slate-200 md:text-sm">
              {active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 sm:flex-nowrap md:gap-4">
          <div className="flex min-w-0 flex-col items-end text-right">
            <span className="font-mono text-[10px] text-slate-500 md:text-[11px]">
              {hasSession ? shortAddr(walletAddress) : 'Wallet'}
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-white md:text-sm">{balanceShown}</span>
          </div>
          {trailing}
          <GradientButton
            type="button"
            className="!shrink-0 !rounded-xl !py-2 !px-4 !text-xs !font-semibold md:!px-5"
            onClick={onPrimaryAction}
          >
            {primaryLabel}
          </GradientButton>
        </div>
      </div>
    </header>
  );
}
