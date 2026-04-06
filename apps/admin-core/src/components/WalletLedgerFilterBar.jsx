import React, { memo } from 'react';
import { FilterX } from 'lucide-react';

const SELECT =
  'rounded-lg border border-white/[0.1] bg-slate-950/90 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40';
const INPUT =
  'rounded-lg border border-white/[0.1] bg-slate-950/90 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/40';

const DEFAULT_FILTERS = {
  type: '',
  status: '',
  userQuery: '',
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
};

export { DEFAULT_FILTERS };

/**
 * @param {{
 *   filters: typeof DEFAULT_FILTERS,
 *   onChange: (patch: Partial<typeof DEFAULT_FILTERS>) => void,
 *   onReset: () => void,
 *   resultCount: number,
 *   totalCount: number,
 * }} props
 */
function WalletLedgerFilterBarInner({ filters, onChange, onReset, resultCount, totalCount }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-slate-950/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filtros</p>
          <p className="text-xs text-slate-400">
            Mostrando{' '}
            <span className="font-mono text-cyan-200/90">{resultCount}</span>
            <span className="text-slate-600"> / </span>
            <span className="font-mono text-slate-500">{totalCount}</span> movimientos
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        >
          <FilterX className="h-3.5 w-3.5" aria-hidden />
          Reset
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tipo</span>
          <select
            className={`${SELECT} w-full`}
            value={filters.type}
            onChange={(e) => onChange({ type: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="deposit">Depósito</option>
            <option value="withdrawal">Retiro</option>
            <option value="bonus">Bono</option>
            <option value="adjustment">Ajuste</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Estado</span>
          <select
            className={`${SELECT} w-full`}
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="approved">Aprobado</option>
            <option value="rejected">Rechazado</option>
          </select>
        </label>

        <label className="space-y-1 sm:col-span-2 lg:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Usuario</span>
          <input
            type="search"
            className={`${INPUT} w-full`}
            value={filters.userQuery}
            onChange={(e) => onChange({ userQuery: e.target.value })}
            placeholder="Email, username, wallet o ID"
            autoComplete="off"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Desde</span>
          <input
            type="date"
            className={`${INPUT} w-full`}
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Hasta</span>
          <input
            type="date"
            className={`${INPUT} w-full`}
            value={filters.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Monto mín.</span>
          <input
            className={`${INPUT} w-full font-mono`}
            inputMode="decimal"
            value={filters.amountMin}
            onChange={(e) => onChange({ amountMin: e.target.value })}
            placeholder="0"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Monto máx.</span>
          <input
            className={`${INPUT} w-full font-mono`}
            inputMode="decimal"
            value={filters.amountMax}
            onChange={(e) => onChange({ amountMax: e.target.value })}
            placeholder="∞"
          />
        </label>
      </div>
    </div>
  );
}

export const WalletLedgerFilterBar = memo(WalletLedgerFilterBarInner);
WalletLedgerFilterBar.displayName = 'WalletLedgerFilterBar';
