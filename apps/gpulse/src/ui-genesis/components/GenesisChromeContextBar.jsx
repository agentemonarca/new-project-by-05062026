import React from 'react';
import { GenesisNotificationCenter } from './GenesisNotificationCenter.jsx';
import { deriveGpulseNavVisualState, GpulseChromeButton } from './GpulseChromeButton.jsx';

/**
 * Secondary protocol context: mining rate, rules/alerts copy, text links, notifications.
 * Replaces stacked badges + separate economy strip + heavy dock CTAs.
 *
 * @param {{
 *   hasSession: boolean,
 *   userEconomicallyActive: boolean,
 *   userHasActiveStaking: boolean,
 *   accountFrozen: boolean,
 *   holdingPctAig: number,
 *   minHoldingPct: number,
 *   rateUsdtPerSecond: number,
 *   navigateTo: (id: string) => void,
 *   notificationProps: Record<string, unknown>,
 *   gpulseLobbyActive?: boolean,
 * }} props
 */
export function GenesisChromeContextBar({
  hasSession,
  userEconomicallyActive,
  userHasActiveStaking,
  accountFrozen,
  holdingPctAig,
  minHoldingPct,
  rateUsdtPerSecond,
  navigateTo,
  notificationProps,
  gpulseLobbyActive = false,
}) {
  const rate =
    rateUsdtPerSecond < 0.001 ? rateUsdtPerSecond.toExponential(2) : rateUsdtPerSecond.toFixed(6);

  let alertLine = '';
  if (hasSession && !userEconomicallyActive) {
    alertLine =
      'Activa staking y mantén AIG ≥ umbral para desbloquear ingresos del protocolo.';
  } else if (hasSession && accountFrozen) {
    alertLine = 'Cuenta congelada por holding AIG — regulariza en Portfolio.';
  } else if (hasSession && !userHasActiveStaking) {
    alertLine = 'Sin staking activo · ingresos limitados hasta participar.';
  } else if (hasSession && holdingPctAig + 1e-6 < minHoldingPct) {
    alertLine = `Holding AIG ${holdingPctAig.toFixed(1)}% · objetivo ~${minHoldingPct}%`;
  } else if (hasSession) {
    alertLine = 'Ingresos sujetos a reglas de protocolo y actividad de red.';
  } else {
    alertLine = 'Conecta wallet e inicia sesión para métricas en vivo.';
  }

  const linkCl =
    'rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-white/[0.05] hover:text-cyan-200/90';

  const gpulseState = deriveGpulseNavVisualState({
    gpulseLobbyActive,
    hasSession,
    userEconomicallyActive,
    accountFrozen,
  });

  return (
    <div className="border-b border-white/[0.06] bg-slate-950/40 px-4 py-2 backdrop-blur-md md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] md:text-xs">
          <span className="shrink-0 font-mono tabular-nums text-cyan-200/90">
            {rate} <span className="text-slate-500">USDT/s</span>
          </span>
          <span
            className={`min-w-0 leading-snug ${
              accountFrozen || (hasSession && !userEconomicallyActive) ? 'text-amber-200/85' : 'text-slate-500'
            }`}
          >
            {alertLine}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <button type="button" className={linkCl} onClick={() => navigateTo('booster')}>
            Booster
          </button>
          <span className="text-slate-700" aria-hidden>
            ·
          </span>
          <button type="button" className={linkCl} onClick={() => navigateTo('staking')}>
            Staking
          </button>
          <span className="text-slate-700" aria-hidden>
            ·
          </span>
          <button type="button" className={linkCl} onClick={() => navigateTo('wallet')}>
            Portfolio
          </button>
          <span className="text-slate-700 max-sm:hidden" aria-hidden>
            ·
          </span>
          <GpulseChromeButton
            state={gpulseState}
            onClick={() => navigateTo('gpulse-lobby')}
            className="max-sm:ml-auto"
          />
          <GenesisNotificationCenter {...notificationProps} />
        </div>
      </div>
    </div>
  );
}
