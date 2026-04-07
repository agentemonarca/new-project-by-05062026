import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Database,
  Gauge,
  Percent,
  Radio,
  Server,
  Timer,
} from 'lucide-react';
import { useExternalSignalsStore } from '@/ui-genesis/stores/externalSignalsStore.js';
import { useAdminSignalsPollingStore } from '@/ui-genesis/stores/adminSignalsPollingStore.js';

function MetricCard({ icon: Icon, label, value, hint, borderAccent, emphasize }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-xl border bg-black/35 px-4 py-3 ${
        emphasize ? 'ring-1 ring-cyan-500/25' : ''
      } ${borderAccent ?? 'border-white/[0.08]'}`}
    >
      <div className="pointer-events-none absolute -right-4 -top-4 h-14 w-14 rounded-full bg-gradient-to-br from-white/[0.06] to-transparent" />
      <div className="relative flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-200/90">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white md:text-xl">{value}</p>
          {hint ? <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p> : null}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Stats cliente (Zustand) + procesador en vivo + métricas persistidas Mongo.
 */
export function AdminSignalStats({ className = '' }) {
  const stats = useExternalSignalsStore((s) => s.stats);
  const signalIntelMetrics = useExternalSignalsStore((s) => s.signalIntelMetrics);
  const adminRawFeed = useExternalSignalsStore((s) => s.adminRawFeed);
  const connectionStatus = useExternalSignalsStore((s) => s.connectionStatus);

  const serverSnap = useAdminSignalsPollingStore((s) => s.serverStats);
  const mongoSnap = useAdminSignalsPollingStore((s) => s.serverMetrics);
  const serverErr = useAdminSignalsPollingStore((s) => s.serverPairError);
  const analytics = useAdminSignalsPollingStore((s) => s.analytics);
  const analyticsLoading = useAdminSignalsPollingStore((s) => s.loading);
  const analyticsErr = useAdminSignalsPollingStore((s) => s.analyticsError);

  const winRate = useMemo(() => {
    const t = stats.wins + stats.losses;
    if (t <= 0) return null;
    return Math.round((stats.wins / t) * 1000) / 10;
  }, [stats.wins, stats.losses]);

  const avgLatency = useMemo(() => {
    const arr = signalIntelMetrics.settlementLatenciesMs;
    if (!arr.length) return null;
    const sum = arr.reduce((a, b) => a + b, 0);
    return Math.round(sum / arr.length);
  }, [signalIntelMetrics.settlementLatenciesMs]);

  const signalsPerMinute = useMemo(() => {
    const now = Date.now();
    return adminRawFeed.filter((e) => e.type === 'NEW_SIGNAL' && now - e.ts <= 60_000).length;
  }, [adminRawFeed]);

  const offline = connectionStatus === 'error' || connectionStatus === 'disabled';

  const srvStats =
    serverSnap && typeof serverSnap.stats === 'object' && serverSnap.stats !== null
      ? /** @type {Record<string, unknown>} */ (serverSnap.stats)
      : null;

  const mongoWinRate = useMemo(() => {
    const w = Number(mongoSnap?.wins ?? 0);
    const l = Number(mongoSnap?.losses ?? 0);
    const t = w + l;
    if (t <= 0) return null;
    return Math.round((w / t) * 1000) / 10;
  }, [mongoSnap?.wins, mongoSnap?.losses]);

  const winRateByMesaEntries = useMemo(() => {
    const o = analytics?.winRateByMesa;
    if (!o || typeof o !== 'object') return [];
    return Object.entries(o)
      .filter(([, v]) => v != null)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .slice(0, 12);
  }, [analytics?.winRateByMesa]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/80">Cliente en vivo</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            icon={Percent}
            label="Win rate"
            value={winRate != null ? `${winRate}%` : '—'}
            hint={winRate != null ? `${stats.wins}W / ${stats.losses}L` : 'Sin muestras'}
            borderAccent="border-emerald-500/25"
          />
          <MetricCard
            icon={Timer}
            label="Latencia media"
            value={avgLatency != null ? `${avgLatency} ms` : '—'}
            hint="Browser · settledAt − receivedAt"
            borderAccent="border-sky-500/25"
          />
          <MetricCard
            icon={Gauge}
            label="Señales / min"
            value={String(signalsPerMinute)}
            hint="NEW_SIGNAL · ventana 60s"
            borderAccent="border-indigo-500/25"
          />
          <MetricCard
            icon={Radio}
            label="Activas"
            value={String(stats.pending)}
            hint="Pendientes store"
            borderAccent="border-amber-500/25"
          />
          <MetricCard
            icon={signalIntelMetrics.correlationErrors > 0 ? AlertTriangle : Activity}
            label="Errores correlación"
            value={String(signalIntelMetrics.correlationErrors)}
            hint="Result huérfano"
            borderAccent={
              signalIntelMetrics.correlationErrors > 0 ? 'border-rose-500/30' : 'border-slate-500/25'
            }
          />
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/80">
          <Server className="h-3.5 w-3.5" strokeWidth={2} />
          Procesador (memoria API)
          {serverErr ? (
            <span className="font-mono text-[9px] font-normal normal-case text-rose-400/90">{serverErr}</span>
          ) : null}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            icon={Percent}
            label="Win rate (core)"
            value={srvStats?.winRate != null ? `${srvStats.winRate}%` : '—'}
            hint={
              srvStats
                ? `${srvStats.wins ?? '—'}W / ${srvStats.losses ?? '—'}L`
                : 'GET /api/admin/signals/stats'
            }
            borderAccent="border-emerald-500/15"
            emphasize={Boolean(srvStats)}
          />
          <MetricCard
            icon={Timer}
            label="Latencia ∅ core"
            value={srvStats?.avgLatencyMs != null ? `${srvStats.avgLatencyMs} ms` : '—'}
            hint="Ventana sesión procesador"
            borderAccent="border-sky-500/15"
          />
          <MetricCard
            icon={Gauge}
            label="Total señales"
            value={String(srvStats?.totalSignals ?? '—')}
            hint="Acumulado memoria"
            borderAccent="border-indigo-500/15"
          />
          <MetricCard
            icon={Radio}
            label="Activas core"
            value={String(serverSnap?.activePending ?? '—')}
            hint="Pendientes procesador"
            borderAccent="border-amber-500/15"
          />
          <MetricCard
            icon={Number(serverSnap?.correlationErrors) > 0 ? AlertTriangle : Activity}
            label="Errores core"
            value={String(serverSnap?.correlationErrors ?? '—')}
            hint="Correlación memoria"
            borderAccent="border-rose-500/20"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200/85">
          <BarChart3 className="h-3.5 w-3.5" strokeWidth={2} />
          Analytics histórico
          {analyticsLoading ? (
            <span className="font-mono text-[9px] font-normal normal-case text-slate-500">actualizando…</span>
          ) : null}
          {analyticsErr ? (
            <span className="font-mono text-[9px] font-normal normal-case text-rose-400/90">
              {analyticsErr}
            </span>
          ) : null}
        </p>
        {!analytics?.mongoReady ? (
          <p className="mb-3 text-[11px] text-slate-500">
            Mongo no disponible en API — sin win rate histórico por mesa.
          </p>
        ) : (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MetricCard
              icon={Percent}
              label="Win rate (histórico)"
              value={analytics?.winRateGlobal != null ? `${analytics.winRateGlobal}%` : '—'}
              hint="signal_events · win/loss"
              borderAccent="border-fuchsia-500/25"
              emphasize
            />
            <MetricCard
              icon={Timer}
              label="Latencia ∅ histórica"
              value={analytics?.avgLatency != null ? `${analytics.avgLatency} ms` : '—'}
              hint="Mongo · settled"
              borderAccent="border-sky-500/25"
            />
            <MetricCard
              icon={Gauge}
              label="Señales / min (Mongo)"
              value={String(analytics?.signalsPerMinute ?? '—')}
              hint="Ingress últimos 60s"
              borderAccent="border-indigo-500/25"
            />
            <MetricCard
              icon={Number(analytics?.correlationMisses) > 0 ? AlertTriangle : Activity}
              label="Miss rate"
              value={
                analytics?.correlationMissRate != null ? `${analytics.correlationMissRate}%` : '—'
              }
              hint={`${analytics?.correlationMisses ?? 0} misses / ${
                (analytics?.settledTotal ?? 0) + (analytics?.correlationMisses ?? 0)
              } evt`}
              borderAccent="border-rose-500/25"
            />
            <MetricCard
              icon={Database}
              label="Muestras settled"
              value={String(analytics?.settledTotal ?? '—')}
              hint="Para win rate global"
              borderAccent="border-slate-500/25"
            />
          </div>
        )}

        {winRateByMesaEntries.length > 0 ? (
          <div className="mb-4 rounded-xl border border-white/[0.06] bg-black/25 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Win rate por mesa
            </p>
            <div className="flex flex-wrap gap-2">
              {winRateByMesaEntries.map(([mesa, pct]) => (
                <span
                  key={mesa}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-slate-200"
                >
                  <span className="text-slate-500">{mesa}</span>
                  <span className="text-cyan-200/90">{pct}%</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/85">
          <Database className="h-3.5 w-3.5" strokeWidth={2} />
          Persistido (Mongo · signal_metrics)
          {mongoSnap?.source === 'memory' ? (
            <span className="font-mono text-[9px] font-normal normal-case text-slate-500">sin mongo</span>
          ) : null}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            icon={Percent}
            label="Win rate"
            value={mongoWinRate != null ? `${mongoWinRate}%` : '—'}
            hint={
              mongoSnap
                ? `${mongoSnap.wins ?? 0}W / ${mongoSnap.losses ?? 0}L`
                : 'Mismo ciclo que /analytics'
            }
            borderAccent="border-amber-500/20"
            emphasize={mongoSnap?.source === 'mongo'}
          />
          <MetricCard
            icon={Timer}
            label="Latencia ∅"
            value={mongoSnap?.avgLatency != null ? `${mongoSnap.avgLatency} ms` : '—'}
            hint="Acumulado histórico"
            borderAccent="border-sky-500/20"
          />
          <MetricCard
            icon={Gauge}
            label="Total señales"
            value={String(mongoSnap?.totalSignals ?? '—')}
            hint="Contador persistido"
            borderAccent="border-indigo-500/20"
          />
          <MetricCard
            icon={Number(mongoSnap?.correlationMiss) > 0 ? AlertTriangle : Activity}
            label="Correlation miss"
            value={String(mongoSnap?.correlationMiss ?? '—')}
            hint="signal_events · orphan"
            borderAccent="border-rose-500/25"
          />
          <MetricCard
            icon={Radio}
            label="Ámbito"
            value={mongoSnap?.source === 'mongo' ? 'Mongo' : '—'}
            hint="Acumulado entre resets"
            borderAccent="border-slate-500/25"
          />
        </div>
      </div>

      {offline ? (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-center text-[11px] text-rose-100/90">
          Socket cliente: <span className="font-mono">{connectionStatus}</span>
        </p>
      ) : null}
    </div>
  );
}
