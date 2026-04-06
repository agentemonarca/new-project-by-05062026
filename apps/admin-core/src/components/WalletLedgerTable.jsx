import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

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

/** @param {'high' | 'medium' | 'low' | undefined} severity */
function alertRowChrome(severity) {
  if (severity === 'high') {
    return 'bg-rose-500/[0.09] ring-1 ring-inset ring-rose-500/25 !border-l-2 !border-l-rose-400/80';
  }
  if (severity === 'medium') {
    return 'bg-amber-500/[0.07] ring-1 ring-inset ring-amber-500/20 !border-l-2 !border-l-amber-400/60';
  }
  return '';
}

const CHECK =
  'h-4 w-4 rounded border-white/25 bg-slate-900/90 text-cyan-500 focus:ring-cyan-500/40 focus:ring-offset-0';

const SelectAllTh = memo(function SelectAllTh({ allSelected, someSelected, disabled, onChange }) {
  const ref = useRef(/** @type {HTMLInputElement | null} */ (null));
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  return (
    <th className="w-10 px-2 py-2.5">
      <input
        ref={ref}
        type="checkbox"
        className={CHECK}
        checked={allSelected}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label="Seleccionar todas las filas visibles"
      />
    </th>
  );
});
SelectAllTh.displayName = 'SelectAllTh';

const LedgerRow = memo(
  function LedgerRow({
    row,
    primary,
    sub,
    selected,
    onToggleRow,
    onApproveWithdrawal,
    onRejectWithdrawal,
    bulkDisabled,
    alertFingerprint,
    alertSeverity,
    alertTooltip,
  }) {
    const stop = useCallback((e) => e.stopPropagation(), []);
    const canWithdrawActions = row.type === 'withdrawal' && row.status === 'pending';
    const chrome = alertRowChrome(alertSeverity);

    return (
      <tr
        title={alertTooltip || undefined}
        className={`border-l-2 border-transparent bg-slate-950/20 hover:bg-white/[0.02] ${
          selected ? 'ring-1 ring-inset ring-cyan-500/25' : ''
        } ${chrome}`}
      >
        <td className="px-2 py-2.5 align-middle">
          <input
            type="checkbox"
            className={CHECK}
            checked={selected}
            disabled={bulkDisabled}
            onChange={() => onToggleRow(row.id)}
            aria-label={`Seleccionar ${row.id}`}
          />
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-cyan-200/85">
          <span className="inline-flex items-center gap-1.5">
            {alertSeverity ? (
              <AlertTriangle
                className={`h-3.5 w-3.5 shrink-0 ${alertSeverity === 'high' ? 'text-rose-300' : 'text-amber-300'}`}
                aria-hidden
              />
            ) : null}
            {row.id}
          </span>
        </td>
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
        <td className="px-3 py-2.5 text-right" onClick={stop}>
          {canWithdrawActions ? (
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
    );
  },
  (prev, next) =>
    prev.row === next.row &&
    prev.primary === next.primary &&
    prev.sub === next.sub &&
    prev.selected === next.selected &&
    prev.bulkDisabled === next.bulkDisabled &&
    prev.alertFingerprint === next.alertFingerprint &&
    prev.onToggleRow === next.onToggleRow &&
    prev.onApproveWithdrawal === next.onApproveWithdrawal &&
    prev.onRejectWithdrawal === next.onRejectWithdrawal,
);

/**
 * @param {{
 *   rows: object[],
 *   userById: Map<string, object>,
 *   onApproveWithdrawal: (id: string) => void,
 *   onRejectWithdrawal: (id: string) => void,
 *   selectionSet: ReadonlySet<string>,
 *   onToggleRow: (id: string) => void,
 *   onBulkSelectAll: (selectAll: boolean) => void,
 *   bulkDisabled?: boolean,
 *   alertsByRowId?: Record<string, { severity: string, reasons: { type: string, label: string }[] }>,
 * }} props
 */
function WalletLedgerTableInner({
  rows,
  userById,
  onApproveWithdrawal,
  onRejectWithdrawal,
  selectionSet,
  onToggleRow,
  onBulkSelectAll,
  bulkDisabled = false,
  alertsByRowId,
}) {
  const enriched = useMemo(
    () =>
      rows.map((row) => {
        const u = userById.get(row.userId);
        const primary = u?.username || u?.email || row.userId;
        const sub = u?.email && u?.username ? u.email : u?.wallet ? String(u.wallet).slice(0, 10) + '…' : '';
        const am = alertsByRowId?.[row.id];
        const alertFingerprint = am
          ? `${am.severity}:${am.reasons
              .map((r) => r.type)
              .sort()
              .join(',')}`
          : '';
        const alertTooltip = am ? am.reasons.map((r) => r.label).join(' · ') : '';
        return {
          row,
          primary,
          sub,
          alertFingerprint,
          alertSeverity: am?.severity,
          alertTooltip,
        };
      }),
    [rows, userById, alertsByRowId],
  );

  const visibleRowIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const { allSelected, someSelected } = useMemo(() => {
    if (!visibleRowIds.length) return { allSelected: false, someSelected: false };
    let hit = 0;
    for (const id of visibleRowIds) {
      if (selectionSet.has(id)) hit++;
    }
    return {
      allSelected: hit === visibleRowIds.length,
      someSelected: hit > 0 && hit < visibleRowIds.length,
    };
  }, [visibleRowIds, selectionSet]);

  const onHeaderChange = useCallback(
    (checked) => {
      onBulkSelectAll(checked);
    },
    [onBulkSelectAll],
  );

  const alertCountInView = useMemo(() => {
    if (!alertsByRowId) return 0;
    let n = 0;
    for (const id of visibleRowIds) {
      if (alertsByRowId[id]) n++;
    }
    return n;
  }, [visibleRowIds, alertsByRowId]);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
      {alertsByRowId && alertCountInView > 0 ? (
        <p className="border-b border-white/[0.06] bg-slate-900/40 px-3 py-2 text-[11px] text-slate-400">
          <span className="font-mono text-amber-200/90">{alertCountInView}</span> fila(s) con alerta en esta vista
        </p>
      ) : null}
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-white/[0.06] bg-slate-900/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <tr>
            <SelectAllTh
              allSelected={allSelected}
              someSelected={someSelected}
              disabled={bulkDisabled || !visibleRowIds.length}
              onChange={onHeaderChange}
            />
            <th className="px-3 py-2.5">ID / alerta</th>
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
            enriched.map(
              ({ row, primary, sub, alertFingerprint, alertSeverity, alertTooltip }) => (
                <LedgerRow
                  key={row.id}
                  row={row}
                  primary={primary}
                  sub={sub}
                  selected={selectionSet.has(row.id)}
                  onToggleRow={onToggleRow}
                  onApproveWithdrawal={onApproveWithdrawal}
                  onRejectWithdrawal={onRejectWithdrawal}
                  bulkDisabled={bulkDisabled}
                  alertFingerprint={alertFingerprint}
                  alertSeverity={alertSeverity}
                  alertTooltip={alertTooltip}
                />
              ),
            )
          ) : (
            <tr>
              <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
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
