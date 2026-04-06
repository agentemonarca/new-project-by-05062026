import React, { memo } from 'react';
import { Radar, AlertTriangle, Filter } from 'lucide-react';

/**
 * @param {{
 *   summary: { totalFlagged: number, high: number, medium: number, low: number, byRule: Record<string, number> },
 *   inViewCount: number,
 *   alertsOnly: boolean,
 *   onToggleAlertsOnly: () => void,
 *   monitoringEnabled: boolean,
 *   compact?: boolean,
 * }} props
 */
function WalletAlertPanelInner({
  summary,
  inViewCount,
  alertsOnly,
  onToggleAlertsOnly,
  monitoringEnabled,
  compact = false,
}) {
  const { totalFlagged, high, medium, low, byRule } = summary;
  const ruleLabels = {
    high_amount: 'Monto alto',
    rapid_activity: 'Ráfaga',
    reject_history: 'Rechazos',
  };

  if (!monitoringEnabled) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-slate-950/40 px-4 py-3 text-xs text-slate-500">
        Monitoreo inteligente desactivado en configuración del proyecto.
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.06] to-slate-950/60 ${
        compact ? 'px-3 py-2' : 'px-4 py-3'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-200">
            <Radar className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">Monitoreo financiero</p>
            <p className="mt-0.5 truncate text-sm text-white">
              <span className="font-mono font-semibold text-amber-100">{totalFlagged}</span>
              <span className="text-slate-500"> alertas en ledger · </span>
              <span className="text-slate-400">
                esta vista: <span className="font-mono text-cyan-200/90">{inViewCount}</span>
              </span>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2 text-[10px]">
              {high > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 px-2 py-0.5 font-semibold text-rose-100">
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                  Alta {high}
                </span>
              ) : null}
              {medium > 0 ? (
                <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-100">Media {medium}</span>
              ) : null}
              {low > 0 ? (
                <span className="rounded-md bg-slate-500/20 px-2 py-0.5 font-semibold text-slate-300">Baja {low}</span>
              ) : null}
              {totalFlagged === 0 ? (
                <span className="text-slate-500">Sin alertas según reglas actuales</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleAlertsOnly}
            disabled={totalFlagged === 0}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              alertsOnly
                ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-500/35'
                : 'border border-white/10 bg-slate-900/80 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Filter className="h-3.5 w-3.5" aria-hidden />
            {alertsOnly ? 'Ver todo el ledger' : 'Solo filas con alerta'}
          </button>
        </div>
      </div>

      {totalFlagged > 0 && !compact ? (
        <ul className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-slate-400">
          {Object.entries(byRule).map(([key, c]) => (
            <li key={key} className="rounded-md bg-slate-900/60 px-2 py-1 font-mono">
              {(ruleLabels[key] ?? key) + `: ${c}`}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export const WalletAlertPanel = memo(WalletAlertPanelInner);
WalletAlertPanel.displayName = 'WalletAlertPanel';
