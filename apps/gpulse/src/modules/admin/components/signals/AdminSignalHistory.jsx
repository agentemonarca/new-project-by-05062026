import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History } from 'lucide-react';
import { useAdminSignalsPollingStore } from '@/ui-genesis/stores/adminSignalsPollingStore.js';

function rowTone(row) {
  if (row.correlationMiss) return 'border-slate-500/30 bg-slate-500/10 text-slate-200';
  if (row.pending) return 'border-white/10 bg-white/[0.04] text-slate-300';
  if (row.result === 'win') return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100';
  if (row.result === 'loss') return 'border-rose-500/40 bg-rose-500/10 text-rose-100';
  return 'border-white/10 bg-white/[0.04] text-slate-300';
}

function statusLabel(row) {
  if (row.correlationMiss) return 'correlación';
  if (row.pending) return 'pendiente';
  if (row.result === 'win') return 'win';
  if (row.result === 'loss') return 'loss';
  return '—';
}

/**
 * Últimas señales desde analytics Mongo (`lastSignals`).
 */
export function AdminSignalHistory({ className = '' }) {
  const analytics = useAdminSignalsPollingStore((s) => s.analytics);
  const loading = useAdminSignalsPollingStore((s) => s.loading);
  const fetchError = useAdminSignalsPollingStore(
    (s) => s.analyticsError || s.pollError,
  );
  const rows = Array.isArray(analytics?.lastSignals) ? analytics.lastSignals : [];

  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-slate-950/65 p-4 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-cyan-300/80" strokeWidth={2} />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Historial (50)
            </h3>
            <p className="text-[10px] text-slate-600">Mongo · audit trail</p>
          </div>
        </div>
        {loading ? (
          <span className="animate-pulse font-mono text-[10px] text-slate-500">sync…</span>
        ) : null}
      </div>

      {fetchError ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100/90">
          {fetchError}
        </p>
      ) : null}

      {!analytics?.mongoReady ? (
        <p className="text-center text-[11px] text-slate-500">Mongo no conectado · sin historial persistido</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-[11px] text-slate-500">Sin eventos aún</p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-auto pr-1">
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <motion.li
                key={row.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className={`rounded-xl border px-3 py-2 text-[11px] ${rowTone(row)}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-slate-400">
                    {row.mesa || '—'}
                    <span className="text-slate-600"> · mg </span>
                    {row.martingale ?? 0}
                  </span>
                  <span className="rounded-md border border-white/10 bg-black/25 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide">
                    {statusLabel(row)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-slate-500">
                  <span>{row.recommendation ?? '—'}</span>
                  <span>
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : ''}
                  </span>
                  {row.latencyMs != null ? <span>{row.latencyMs} ms</span> : null}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
