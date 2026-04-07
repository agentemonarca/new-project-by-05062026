import React, { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useExternalSignalsStore } from '@/ui-genesis/stores/externalSignalsStore.js';

function typeStyle(type) {
  if (type === 'NEW_SIGNAL') return 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10';
  if (type === 'NEW_RESULT') return 'text-violet-300 border-violet-500/25 bg-violet-500/10';
  return 'text-slate-300 border-white/10 bg-white/[0.04]';
}

/**
 * Stream crudo de eventos socket (admin).
 */
export function AdminSignalLiveFeed({ className = '' }) {
  const adminRawFeed = useExternalSignalsStore((s) => s.adminRawFeed);
  const clearAdminRawFeed = useExternalSignalsStore((s) => s.clearAdminRawFeed);
  const [openId, setOpenId] = useState(/** @type {string | null} */ (null));

  const onToggle = useCallback((id) => {
    setOpenId((cur) => (cur === id ? null : id));
  }, []);

  const rows = useMemo(() => adminRawFeed.slice(0, 80), [adminRawFeed]);

  return (
    <div
      className={`flex flex-col rounded-2xl border border-sky-500/20 bg-[#05080f]/95 font-mono shadow-[inset_0_0_0_1px_rgba(56,189,248,0.06)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Live signal stream</h3>
          <p className="text-[11px] text-slate-500">NEW_SIGNAL / NEW_RESULT · payload crudo · llegada socket</p>
        </div>
        <button
          type="button"
          onClick={() => clearAdminRawFeed()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:border-rose-500/30 hover:text-rose-200"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          Limpiar feed
        </button>
      </div>
      <ul className="custom-scrollbar max-h-[min(420px,50vh)] divide-y divide-sky-500/10 overflow-y-auto text-[12px] leading-snug">
        {rows.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-slate-500">
            Sin eventos aún. Conecta el socket o espera tráfico del proveedor.
          </li>
        ) : (
          rows.map((row) => {
            const isOpen = openId === row.id;
            return (
              <li key={row.id} className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onToggle(row.id)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="mt-0.5 text-slate-500">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" strokeWidth={2} />
                    ) : (
                      <ChevronRight className="h-4 w-4" strokeWidth={2} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${typeStyle(row.type)}`}
                      >
                        {row.type}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {new Date(row.ts).toLocaleTimeString()} · {row.mesa || '—'}
                      </span>
                    </div>
                    {isOpen ? (
                      <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-sky-500/15 bg-black/70 p-3 text-[10px] leading-relaxed text-sky-100/90">
                        {JSON.stringify(row.raw, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
