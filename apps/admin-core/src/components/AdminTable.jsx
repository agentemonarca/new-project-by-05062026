import React, { memo } from 'react';

/**
 * Tabla genérica memoizada — columnas declarativas.
 * @template T
 * @param {{
 *   columns: { key: string, header: string, className?: string, render?: (row: T) => React.ReactNode }[],
 *   rows: T[],
 *   rowKey: (row: T) => string,
 *   emptyLabel?: string,
 * }} props
 */
function AdminTableInner({ columns, rows, rowKey, emptyLabel = 'Sin datos' }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-white/[0.06] bg-slate-900/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2.5 ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="bg-slate-950/20 hover:bg-white/[0.02]">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2.5 text-slate-300 ${c.className ?? ''}`}>
                  {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const AdminTable = memo(AdminTableInner);
AdminTable.displayName = 'AdminTable';
