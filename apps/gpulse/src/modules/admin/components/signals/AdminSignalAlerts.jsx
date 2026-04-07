import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Bell, CircleCheck, Info, Loader2, Zap } from 'lucide-react';
import { useAdminSignalsPollingStore } from '@/ui-genesis/stores/adminSignalsPollingStore.js';
import { fadeUpBlur } from '@/ui-genesis/motion/variants.js';

/** @param {string} s */
function severityStyles(s) {
  switch (s) {
    case 'critical':
      return {
        border: 'border-rose-500/45',
        bg: 'bg-rose-500/[0.1]',
        text: 'text-rose-100',
        label: 'text-rose-400',
        Icon: AlertTriangle,
      };
    case 'high':
      return {
        border: 'border-rose-500/40',
        bg: 'bg-rose-500/[0.08]',
        text: 'text-rose-100',
        label: 'text-rose-400',
        Icon: AlertTriangle,
      };
    case 'medium':
    case 'warning':
      return {
        border: 'border-amber-500/35',
        bg: 'bg-amber-500/[0.08]',
        text: 'text-amber-50',
        label: 'text-amber-400',
        Icon: Zap,
      };
    case 'info':
    default:
      return {
        border: 'border-sky-500/35',
        bg: 'bg-sky-500/[0.08]',
        text: 'text-sky-50',
        label: 'text-sky-400',
        Icon: Info,
      };
  }
}

function formatValue(type, value) {
  if (value == null) return '—';
  if (type === 'HIGH_LATENCY') return `${value} ms`;
  if (
    type === 'CORRELATION_ERROR' ||
    type === 'LOW_PERFORMANCE'
  )
    return `${value}%`;
  return String(value);
}

/**
 * Alertas activas (datos desde `useAdminSignalsPolling` → store).
 */
export function AdminSignalAlerts({ className = '' }) {
  const loading = useAdminSignalsPollingStore((s) => s.loading);
  const pollingStopped = useAdminSignalsPollingStore((s) => s.pollingStopped);
  const err = useAdminSignalsPollingStore((s) => s.alertsError || s.pollError);
  const mongoReady = useAdminSignalsPollingStore((s) => s.alertsMongoReady);
  const alerts = useAdminSignalsPollingStore((s) => s.alerts);

  const healthy = useMemo(
    () => !loading && !err && mongoReady && alerts.length === 0 && !pollingStopped,
    [loading, err, mongoReady, alerts.length, pollingStopped],
  );

  return (
    <motion.div
      variants={fadeUpBlur}
      className={`rounded-2xl border border-white/[0.08] bg-slate-950/75 p-4 ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-violet-300/90" strokeWidth={2} />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200/90">
              Alertas inteligentes
            </h3>
            <p className="text-[10px] text-slate-500">
              Último día (alerts-daily) · polling unificado ~10–15s
            </p>
          </div>
        </div>
        {!mongoReady ? (
          <span className="rounded-md border border-slate-600/50 bg-slate-500/10 px-2 py-0.5 font-mono text-[9px] text-slate-400">
            Mongo off
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Evaluando métricas…</span>
        </div>
      ) : null}

      {err ? (
        <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
          {err}
        </p>
      ) : null}

      {healthy ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-3">
          <CircleCheck className="h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2} />
          <p className="text-[12px] text-emerald-100/95">
            Ninguna alerta activa. Métricas dentro de umbrales.
          </p>
        </div>
      ) : null}

      {!loading && !err && alerts.length > 0 ? (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {alerts.map((a, idx) => {
              const sev = severityStyles(a.severity);
              const Icon = sev.Icon;
              return (
                <motion.li
                  key={`${a.type}-${a.timestamp}-${idx}`}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex gap-3 rounded-xl border px-3 py-2.5 ${sev.border} ${sev.bg}`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${sev.label}`} strokeWidth={2} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className={`font-mono text-[10px] font-bold uppercase tracking-wide ${sev.label}`}>
                        {a.type?.replace(/_/g, ' ') || 'ALERT'}
                      </span>
                      <span className={`font-mono text-[11px] tabular-nums ${sev.text}`}>
                        {formatValue(a.type, a.value)}
                      </span>
                    </div>
                    <p className={`mt-0.5 text-[11px] leading-snug ${sev.text} opacity-95`}>
                      {a.message}
                    </p>
                    {a.timestamp ? (
                      <p className="mt-1 font-mono text-[9px] text-white/35">
                        {new Date(a.timestamp).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : null}
    </motion.div>
  );
}
