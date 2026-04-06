import React from 'react';
import { motion } from 'framer-motion';
import { useAigPriceFromContext } from '@/hooks/useAigPrice.js';
import { ChevronsLeft, ChevronsRight, Menu } from 'lucide-react';
import { BRAND } from '@/branding/brand.js';
import { BrandLogo } from '@/branding/BrandLogo.jsx';
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
 * Top bar: logo · status · Web3 address · protocol balance · AIG ticker · Web3 Connect/Disconnect (no internal Portfolio link).
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
 *   primaryDisabled?: boolean,
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
  primaryDisabled = false,
  onPrimaryAction,
  trailing = null,
}) {
  const aig = useAigPriceFromContext();
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
            aria-label={`Inicio ${BRAND.name}`}
          >
            <BrandLogo size="md" className="shrink-0" />
            <span className="hidden font-display text-sm font-semibold tracking-tight text-white sm:inline md:text-base">
              {BRAND.name}
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
          <div
            className="flex min-w-0 flex-col items-end text-right"
            title={
              walletAddress
                ? 'Dirección Web3 (conexión en cadena). El importe es saldo de cuenta en protocolo (Portfolio), no el balance on-chain.'
                : 'Conecta tu wallet Web3 con el botón Connect'
            }
          >
            <span className="font-mono text-[10px] text-slate-500 md:text-[11px]">
              {walletAddress ? (
                <>
                  <span className="text-slate-600">Web3 · </span>
                  {shortAddr(walletAddress)}
                </>
              ) : (
                <span className="text-slate-600">Web3 · sin conectar</span>
              )}
            </span>
            <span
              className="font-mono text-xs font-semibold tabular-nums text-white md:text-sm"
              title="Saldo estimado en protocolo (Portfolio)"
            >
              {balanceShown}
            </span>
          </div>
          {aig ? (
            <div className="flex items-center gap-2 text-sm transition-all duration-300 ease-in-out">
              <span className="text-slate-400">AIG</span>
              <span className="font-semibold tabular-nums text-white">${aig.price}</span>
              <span
                className={`tabular-nums transition-all duration-300 ease-in-out ${
                  aig.direction === 'up' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {aig.direction === 'up' ? '▲' : '▼'} {aig.percent}%
              </span>
            </div>
          ) : null}
          {trailing}
          <GradientButton
            type="button"
            className="!shrink-0 !rounded-xl !py-2 !px-4 !text-xs !font-semibold md:!px-5"
            disabled={primaryDisabled}
            onClick={onPrimaryAction}
          >
            {primaryLabel}
          </GradientButton>
        </div>
      </div>
    </header>
  );
}
