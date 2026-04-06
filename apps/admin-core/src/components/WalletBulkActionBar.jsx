import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Download, Snowflake, Loader2 } from 'lucide-react';

/**
 * Barra tipo exchange para acciones sobre selección del ledger.
 * @param {{
 *   visible: boolean,
 *   totalSelected: number,
 *   pendingWithdrawCount: number,
 *   uniqueUsersForFreeze: number,
 *   busy: boolean,
 *   onApproveMultiple: () => void,
 *   onRejectMultiple: () => void,
 *   onFreezeMultiple: () => void,
 *   onExport: () => void,
 *   onClearSelection: () => void,
 * }} props
 */
function WalletBulkActionBarInner({
  visible,
  totalSelected,
  pendingWithdrawCount,
  uniqueUsersForFreeze,
  busy,
  onApproveMultiple,
  onRejectMultiple,
  onFreezeMultiple,
  onExport,
  onClearSelection,
}) {
  const canApproveReject = pendingWithdrawCount > 0 && !busy;
  const canFreeze = uniqueUsersForFreeze > 0 && !busy;
  const canExport = totalSelected > 0 && !busy;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="sticky bottom-0 z-10 mt-4 rounded-xl border border-cyan-500/25 bg-[#070a12]/95 px-4 py-3 shadow-[0_-8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          role="region"
          aria-label="Acciones masivas en tesorería"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-200">
                <CheckSquare className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">
                  {totalSelected} seleccionado{totalSelected !== 1 ? 's' : ''}
                </p>
                <p className="text-[11px] text-slate-500">
                  {pendingWithdrawCount > 0
                    ? `${pendingWithdrawCount} retiro(s) pendiente(s) listos para aprobar/rechazar`
                    : 'Sin retiros pendientes en la selección'}
                  {uniqueUsersForFreeze > 0
                    ? ` · ${uniqueUsersForFreeze} usuario(s) distinto(s) para congelar`
                    : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {busy ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" aria-hidden />
                  Procesando…
                </span>
              ) : null}
              <button
                type="button"
                disabled={!canApproveReject}
                onClick={onApproveMultiple}
                className="rounded-lg bg-emerald-600/90 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                title="Aprobar todos los retiros pendientes seleccionados"
              >
                Aprobar ({pendingWithdrawCount})
              </button>
              <button
                type="button"
                disabled={!canApproveReject}
                onClick={onRejectMultiple}
                className="rounded-lg bg-rose-600/90 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                title="Rechazar todos los retiros pendientes seleccionados"
              >
                Rechazar ({pendingWithdrawCount})
              </button>
              <button
                type="button"
                disabled={!canFreeze}
                onClick={onFreezeMultiple}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/35 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                title="Congelar fondos de usuarios involucrados en la selección"
              >
                <Snowflake className="h-3.5 w-3.5" aria-hidden />
                Congelar ({uniqueUsersForFreeze})
              </button>
              <button
                type="button"
                disabled={!canExport}
                onClick={onExport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                disabled={busy}
                className="rounded-lg px-3 py-2 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40"
              >
                Limpiar
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export const WalletBulkActionBar = memo(WalletBulkActionBarInner);
WalletBulkActionBar.displayName = 'WalletBulkActionBar';
