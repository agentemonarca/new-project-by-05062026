import React, { memo, useMemo } from 'react';

const TYPE_LABEL = {
  deposit: 'Depósito',
  withdrawal: 'Retiro',
  bonus: 'Bono',
  adjustment: 'Ajuste',
};

const STATUS_LABEL = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

function statusClass(s) {
  if (s === 'pending') return 'bg-amber-500/15 text-amber-200/95';
  if (s === 'approved') return 'bg-emerald-500/15 text-emerald-200/95';
  if (s === 'rejected') return 'bg-rose-500/15 text-rose-200/95';
  return 'bg-white/10 text-slate-300';
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

/**
 * @param {{
 *   rows: object[],
 *   userById: Map<string, object>,
 *   onApproveWithdrawal: (id: string) => void,
 *   onRejectWithdrawal: (id: string) => void,
 * }} props
 */
function WalletLedgerTableInner({ rows, userById, onApproveWithdrawal, onRejectWithdrawal }) {
  const enriched = useMemo(
    () =>
      rows.map((row) => {
        const u = userById.get(row.userId);
        const primary = u?.username || u?.email || row.userId;
        const sub = u?.email && u?.username ? u.email : u?.wallet ? String(u.wallet).slice(0, 10) + '…' : '';
        return { row, u, primary, sub };
      }),
    [rows, userById],
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="border-b border-white/[0.06] bg-slate-900/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2.5">ID</th>
            <th className="px-3 py-2.5">Tipo</th>
            <th className="px-3 py-2.5">Usuario</th>
            <th className="px-3 py-2.5">Activo</th>
            <th className="px-3 py-2.5 text-right">Monto</th>
            <th className="px-3 py-2.5">Estado</th>
            <th className="px-3 py-2.5">Fecha</th>
            <th className="px-3 py-2.5 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {enriched.length ? (
            enriched.map(({ row, primary, sub }) => (
              <tr key={row.id} className="bg-slate-950/20 hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-cyan-200/85">{row.id}</td>
                <td className="px-3 py-2.5 text-slate-200">{TYPE_LABEL[row.type] ?? row.type}</td>
                <td className="max-w-[200px] px-3 py-2.5">
                  <p className="truncate font-medium text-white" title={primary}>
                    {primary}
                  </p>
                  {sub ? (
                    <p className="truncate text-[11px] text-slate-500" title={sub}>
                      {sub}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-slate-400">{row.asset ?? '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-200">
                  {Number(row.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusClass(row.status)}`}>
                    {STATUS_LABEL[row.status] ?? row.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-slate-500">
                  {formatDate(row.createdAt)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {row.type === 'withdrawal' && row.status === 'pending' ? (
                    <span className="inline-flex flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onApproveWithdrawal(row.id)}
                        className="rounded-md bg-emerald-600/85 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectWithdrawal(row.id)}
                        className="rounded-md bg-rose-600/85 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-500"
                      >
                        Rechazar
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                Ningún movimiento coincide con los filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const WalletLedgerTable = memo(WalletLedgerTableInner);
WalletLedgerTable.displayName = 'WalletLedgerTable';
