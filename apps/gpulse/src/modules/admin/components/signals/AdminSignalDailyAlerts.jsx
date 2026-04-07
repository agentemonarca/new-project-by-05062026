import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Info,
  Loader2,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { useAdminSignalsPollingStore } from '@/ui-genesis/stores/adminSignalsPollingStore.js';
import { fadeUpBlur } from '@/ui-genesis/motion/variants.js';

/** @param {string} severity */
function severityStyle(severity) {
  switch (severity) {
    case 'critical':
      return {
        border: 'border-rose-500/50',
        bg: 'bg-rose-500/[0.12]',
        text: 'text-rose-50',
        badge: 'bg-rose-600/40 text-rose-50',
        Icon: AlertTriangle,
      };
    case 'high':
      return {
        border: 'border-red-500/35',
        bg: 'bg-red-500/[0.08]',
        text: 'text-red-50',
        badge: 'bg-red-500/30 text-red-100',
        Icon: TrendingDown,
      };
    case 'warning':
      return {
        border: 'border-amber-500/35',
        bg: 'bg-amber-500/[0.09]',
        text: 'text-amber-50',
        badge: 'bg-amber-500/25 text-amber-100',
        Icon: Zap,
      };
    case 'info':
    default:
      return {
        border: 'border-sky-500/35',
        bg: 'bg-sky-500/[0.08]',
        text: 'text-sky-50',
        badge: 'bg-sky-500/25 text-sky-100',
        Icon: Info,
      };
  }
}

function formatValue(type, value) {
  if (value == null) return '—';
  if (type === 'LATENCY_SPIKE') return `${value} ms`;
  if (type === 'LOW_VOLUME') return `${value} señales`;
  if (type === 'WINRATE_DROP' || type === 'WINRATE_CRITICAL') return `${value}%`;
  return String(value);
}

/**
 * Alertas históricas multi-día — datos desde `useAdminSignalsPolling` (GET …/alerts-daily, sin setInterval).
 */
export function AdminSignalDailyAlerts({ className = '' }) {
  const requestPollKick = useAdminSignalsPollingStore((s) => s.requestPollKick);
  const loading = useAdminSignalsPollingStore((s) => s.loading);
  const err = useAdminSignalsPollingStore((s) => s.alertsDailyError);
  const mongoReady = useAdminSignalsPollingStore((s) => s.alertsDailyMongoReady);
  const fromDate = useAdminSignalsPollingStore((s) => s.alertsDailyFromDate);
  const toDate = useAdminSignalsPollingStore((s) => s.alertsDailyToDate);
  const alerts = useAdminSignalsPollingStore((s) => s.alertsDaily);
  const snapshotAt = useAdminSignalsPollingStore((s) => s.alertsDailySnapshotAt);

  const [collapsedDates, setCollapsedDates] = useState(() => new Set());

  const showInitialSpinner = snapshotAt == null && !err;

  const byDate = useMemo(() => {
    /** @type {Record<string, object[]>} */
    const m = {};
    for (const a of alerts) {
      const k = a.date || '—';
      if (!m[k]) m[k] = [];
      m[k].push(a);
    }
    const keys = Object.keys(m).sort((a, b) => b.localeCompare(a));
    return keys.map((date) => ({ date, items: m[date] }));
  }, [alerts]);

  const toggleDate = (date) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const empty = !loading && !err && mongoReady && alerts.length === 0 && snapshotAt != null;

  return (
    <motion.div
      variants={fadeUpBlur}
      className={`rounded-2xl border border-cyan-500/15 bg-slate-950/75 p-4 ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-cyan-300/90" strokeWidth={2} />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/90">
              Alertas históricas (7 días)
            </h3>
            <p className="text-[10px] text-slate-500">
              {fromDate && toDate ? (
                <>
                  <span className="font-mono text-slate-400">{fromDate}</span>
                  {' → '}
                  <span className="font-mono text-slate-400">{toDate}</span>
                </>
              ) : (
                'signal_metrics_daily · polling unificado'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!mongoReady ? (
            <span className="rounded-md border border-slate-600/50 px-2 py-0.5 font-mono text-[9px] text-slate-500">
              Mongo off
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => requestPollKick()}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-slate-300 hover:bg-white/[0.08]"
          >
            Refrescar
          </button>
        </div>
      </div>

      {loading && showInitialSpinner ? (
        <div className="flex items-center gap-2 py-8 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Analizando serie diaria…</span>
        </div>
      ) : null}

      {err ? (
        <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
          {err}
        </p>
      ) : null}

      {empty ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-3">
          <Activity className="h-4 w-4 text-emerald-400" strokeWidth={2} />
          <p className="text-[12px] text-emerald-100/90">
            Sin anomalías detectadas en la ventana. Métricas diarias dentro de rangos esperados.
          </p>
        </div>
      ) : null}

      {!loading && !err && byDate.length > 0 ? (
        <div className="space-y-3">
          {byDate.map(({ date, items }) => {
            const collapsed = collapsedDates.has(date);
            return (
              <div key={date} className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/25">
                <button
                  type="button"
                  onClick={() => toggleDate(date)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/[0.03]"
                >
                  <span className="font-mono text-[11px] font-semibold text-slate-200">{date}</span>
                  <span className="flex items-center gap-2 text-[10px] text-slate-500">
                    {items.length} alerta{items.length !== 1 ? 's' : ''}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`}
                    />
                  </span>
                </button>
                {!collapsed ? (
                  <ul className="space-y-2 border-t border-white/[0.05] p-2">
                    {items.map((a, idx) => {
                      const st = severityStyle(a.severity);
                      const Icon = st.Icon;
                      return (
                        <li
                          key={`${a.type}-${date}-${idx}`}
                          className={`flex gap-2 rounded-lg border px-2.5 py-2 ${st.border} ${st.bg}`}
                        >
                          <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${st.text}`} strokeWidth={2} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide ${st.badge}`}
                              >
                                {a.type?.replace(/_/g, ' ') || 'ALERT'}
                              </span>
                              <span className={`font-mono text-[11px] tabular-nums ${st.text}`}>
                                {formatValue(a.type, a.value)}
                              </span>
                            </div>
                            <p className={`mt-0.5 text-[11px] leading-snug ${st.text} opacity-90`}>
                              {a.message}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </motion.div>
  );
}
