import React, { useCallback, useMemo, useState } from 'react';
import { Download, Filter, RefreshCw } from 'lucide-react';
import { GlassCard } from '../GlassCard.jsx';
import { NeonInput } from '../NeonInput.jsx';
import { GradientButton } from '../GradientButton.jsx';
import { LEDGER_CATEGORIES } from '../../ledger/ledgerModel.js';

const PAGE = 25;

function formatTs(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '—';
  }
}

function eventsToCsv(events) {
  const headers = ['timestamp', 'category', 'kind', 'title', 'summary', 'amountUsdt', 'amountAig', 'txHash'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...events.map((e) =>
      [
        e.ts,
        e.category,
        e.kind,
        e.title,
        e.summary,
        e.amountUsdt ?? '',
        e.amountAig ?? '',
        e.txHash ?? '',
      ]
        .map(esc)
        .join(','),
    ),
  ];
  return lines.join('\n');
}

/**
 * Administrative ledger: tabular view, category filter, search, CSV export.
 * Extends the user ledger data model without replacing `OperativeLedgerExplorer`.
 *
 * @param {{
 *   events: import('../../ledger/ledgerModel.js').LedgerEvent[],
 *   loading?: boolean,
 *   onRefresh?: () => void,
 * }} props
 */
export function AdminLedgerConsole({ events, loading = false, onRefresh }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(/** @type {string} */ ('all'));
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = Array.isArray(events) ? [...events] : [];
    if (cat !== 'all') list = list.filter((e) => e.category === cat);
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(s) ||
          e.summary.toLowerCase().includes(s) ||
          e.kind.toLowerCase().includes(s) ||
          (e.txHash && e.txHash.toLowerCase().includes(s)),
      );
    }
    return list.sort((a, b) => b.ts - a.ts);
  }, [events, cat, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pages);
  const slice = useMemo(() => {
    const start = (safePage - 1) * PAGE;
    return filtered.slice(start, start + PAGE);
  }, [filtered, safePage]);

  const exportCsv = useCallback(() => {
    const csv = eventsToCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aigenesis-admin-ledger-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <GlassCard className="p-4 md:p-5" hover={false} contentClassName="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-cyan-400/90" />
          <div>
            <h3 className="font-display text-sm font-semibold text-white">Libro · consola admin</h3>
            <p className="text-[11px] text-slate-500">{filtered.length} filas · vista tabla</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GradientButton type="button" variant="ghost" className="!text-xs" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-1.5 inline h-3.5 w-3.5" />
            Exportar CSV
          </GradientButton>
          {onRefresh ? (
            <GradientButton type="button" variant="ghost" className="!text-xs" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`mr-1.5 inline h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sync
            </GradientButton>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="min-w-[200px] flex-1">
          <NeonInput label="Buscar" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Título, hash, tipo…" />
        </div>
        <div className="w-full min-w-[160px] sm:w-48">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Categoría</label>
          <select
            value={cat}
            onChange={(e) => {
              setPage(1);
              setCat(e.target.value);
            }}
            className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-500/40"
          >
            <option value="all">Todas</option>
            {LEDGER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04] text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 font-semibold">Fecha</th>
              <th className="px-3 py-2 font-semibold">Categoría</th>
              <th className="px-3 py-2 font-semibold">Tipo</th>
              <th className="px-3 py-2 font-semibold">Título</th>
              <th className="px-3 py-2 font-semibold text-right">USDT</th>
              <th className="px-3 py-2 font-semibold">Tx</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((e) => (
              <tr
                key={e.id}
                className="border-b border-white/5 text-slate-300 hover:bg-white/[0.02]"
              >
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-slate-500">{formatTs(e.ts)}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px]">{e.category}</span>
                </td>
                <td className="px-3 py-2 text-violet-200/90">{e.kind}</td>
                <td className="max-w-[220px] truncate px-3 py-2 text-slate-200" title={e.summary}>
                  {e.title}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-cyan-200/90">
                  {e.amountUsdt != null ? Number(e.amountUsdt).toFixed(4) : '—'}
                </td>
                <td className="max-w-[100px] truncate px-3 py-2 font-mono text-[10px] text-slate-500" title={e.txHash ?? ''}>
                  {e.txHash ? `${e.txHash.slice(0, 8)}…` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Sin movimientos con los filtros actuales.</p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          Página {safePage} / {pages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-slate-300 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={safePage >= pages}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-slate-300 disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            Siguiente
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
