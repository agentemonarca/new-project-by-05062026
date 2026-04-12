import React, { useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  ChevronRight,
  CircleDot,
  Hash,
  Loader2,
  Radio,
  RefreshCw,
  Table2,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { buildPresentedSignalView, useExternalSignalsStore } from '../../stores/externalSignalsStore.js';
import { isExternalSignalsTransportActive } from '../../lib/externalSignalsConfig.js';
import { fadeUpBlur } from '../../motion/variants.js';
import { formatPredictionSideLabel, predictionSideFromRawSignal } from '../../../utils/providerMartingaleRead.js';

const springSignal = { type: 'spring', stiffness: 440, damping: 32, mass: 0.85 };
const springSoft = { type: 'spring', stiffness: 280, damping: 26 };

function pillRecommendation(side, large = false) {
  const base =
    side === 'PLAYER'
      ? 'border-emerald-400/40 bg-emerald-500/[0.14] text-emerald-100 shadow-[0_0_24px_-6px_rgba(16,185,129,0.45)]'
      : side === 'BANKER'
        ? 'border-amber-400/45 bg-amber-500/[0.14] text-amber-100 shadow-[0_0_24px_-6px_rgba(245,158,11,0.4)]'
        : side === 'TIE'
          ? 'border-violet-400/40 bg-violet-500/[0.14] text-violet-100 shadow-[0_0_24px_-6px_rgba(139,92,246,0.35)]'
          : 'border-slate-500/40 bg-slate-800/60 text-slate-300';
  const sz = large ? 'px-5 py-2.5 text-lg md:text-xl font-black tracking-tight' : 'px-3 py-1 text-xs font-bold';
  return `${base} rounded-xl border ${sz}`;
}

/** Vector + contador (proveedor); no usar `row.recommendation` como fuente. */
function sidePillFromRow(row) {
  if (!row?.rawSignal || typeof row.rawSignal !== 'object') return { side: null, label: '—' };
  const side = predictionSideFromRawSignal(row.rawSignal);
  return { side, label: formatPredictionSideLabel(side) };
}

function connectionBarClass(status) {
  if (status === 'connected') return 'from-emerald-500/80 via-teal-400/50 to-transparent';
  if (status === 'connecting' || status === 'reconnecting') return 'from-amber-500/70 via-amber-400/40 to-transparent';
  if (status === 'error') return 'from-rose-500/80 via-rose-400/40 to-transparent';
  if (status === 'disabled') return 'from-slate-600/50 to-transparent';
  return 'from-slate-500/40 to-transparent';
}

function ConnectionRibbon({ status, reconnectAttempt, lastError }) {
  const icon =
    status === 'connected' ? (
      <Wifi className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2} />
    ) : status === 'connecting' ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-200" strokeWidth={2} />
    ) : status === 'reconnecting' ? (
      <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-200" strokeWidth={2} />
    ) : status === 'error' ? (
      <WifiOff className="h-3.5 w-3.5 text-rose-300" strokeWidth={2} />
    ) : (
      <Radio className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
    );

  let label = 'Inicializando…';
  if (status === 'connected') label = 'En vivo';
  if (status === 'connecting') label = 'Conectando…';
  if (status === 'reconnecting') label = `Reconectando${reconnectAttempt > 0 ? ` · intento ${reconnectAttempt}` : ''}`;
  if (status === 'error') label = 'Sin conexión';
  if (status === 'disabled') label = 'Stream desactivado';
  if (status === 'idle') label = 'Listo';

  return (
    <div className="relative overflow-hidden rounded-t-2xl border-b border-white/[0.08]">
      <div className={`h-0.5 bg-gradient-to-r ${connectionBarClass(status)}`} />
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/30">
            {icon}
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Feed externo</p>
            <p className="text-xs font-semibold text-white">{label}</p>
          </div>
        </div>
        <span className="rounded-md border border-white/[0.08] bg-black/25 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-400">
          {status}
        </span>
      </div>
      {status === 'error' && lastError ? (
        <p className="border-t border-rose-500/20 bg-rose-500/[0.08] px-4 py-2 text-[11px] leading-relaxed text-rose-100/95 md:px-5">
          {lastError}
        </p>
      ) : null}
    </div>
  );
}

function StatTile({ label, value, sub, accent }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-black/25 px-3 py-3 md:px-4 md:py-3.5 ${accent}`}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-br from-white/[0.07] to-transparent" />
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-white md:text-2xl">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

function statusBadge(status) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/35 bg-slate-800/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400 opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-300" />
        </span>
        Pendiente
      </span>
    );
  }
  if (status === 'won') {
    return (
      <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
        Win
      </span>
    );
  }
  return (
    <span className="rounded-full border border-rose-400/35 bg-rose-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-200">
      Loss
    </span>
  );
}

function HistoryRow({ row, isLatestSettled, reduceMotion }) {
  const { side: pillSide, label: pillLabel } = sidePillFromRow(row);
  const settled = row.status === 'won' || row.status === 'lost';
  const pending = row.status === 'pending';
  const bar =
    settled && row.winStatus
      ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
      : settled && !row.winStatus
        ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.45)]'
        : 'bg-slate-500';
  const rowBg =
    settled && row.winStatus
      ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
      : settled && !row.winStatus
        ? 'border-rose-500/20 bg-rose-500/[0.06]'
        : 'border-slate-500/25 bg-slate-800/40';

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion || !isLatestSettled ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={springSoft}
      className={`flex items-center gap-3 border px-3 py-2.5 ${rowBg}`}
    >
      <span className={`h-9 w-1 shrink-0 rounded-full ${bar}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={pillRecommendation(pillSide, false)}>{pillLabel}</span>
          {statusBadge(row.status)}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1 font-mono">
            <Table2 className="h-3 w-3 opacity-70" strokeWidth={2} />
            {row.mesa || '—'}
          </span>
          <span className="inline-flex items-center gap-1 font-mono">
            <Hash className="h-3 w-3 opacity-70" strokeWidth={2} />
            {row.round || '—'}
          </span>
          {pending ? (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <CircleDot className="h-3 w-3" strokeWidth={2} /> MG {row.martingale}
            </span>
          ) : (
            <span className="text-slate-600">{new Date(row.settledAt || row.receivedAt).toLocaleTimeString()}</span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={2} aria-hidden />
    </motion.li>
  );
}

/**
 * Panel premium de señales en tiempo real (Baccarat / proveedor externo).
 * Datos: `useExternalSignalsStore` · conexión: `useExternalSignals` en `GenesisDashboardPage`.
 */
export function ExternalSignalBoard({ compact = false, adminPreview = false }) {
  const reduceMotion = useReducedMotion();
  const envOn = isExternalSignalsTransportActive();

  const connectionStatus = useExternalSignalsStore((s) => s.connectionStatus);
  const lastError = useExternalSignalsStore((s) => s.lastError);
  const reconnectAttempt = useExternalSignalsStore((s) => s.reconnectAttempt);
  const activeSignalsRaw = useExternalSignalsStore((s) => s.activeSignals);
  const historyRaw = useExternalSignalsStore((s) => s.history);
  const signalIntelControls = useExternalSignalsStore((s) => s.signalIntelControls);
  const showSignalsToUsers = signalIntelControls.showSignalsToUsers;
  const recentEvents = useExternalSignalsStore((s) => s.recentEvents);
  const streamTick = useExternalSignalsStore((s) => s.streamTick);

  const { activeSignals, history, stats } = useMemo(
    () =>
      buildPresentedSignalView({
        activeSignals: activeSignalsRaw,
        history: historyRaw,
        signalIntelControls,
      }),
    [activeSignalsRaw, historyRaw, signalIntelControls],
  );

  const current = activeSignals.length ? activeSignals[activeSignals.length - 1] : null;
  const queueOthers = activeSignals.length > 1 ? activeSignals.slice(0, -1) : [];

  const winRate = useMemo(() => {
    const t = stats.wins + stats.losses;
    if (t <= 0) return null;
    return Math.round((stats.wins / t) * 1000) / 10;
  }, [stats.wins, stats.losses]);

  const feedRows = useMemo(() => {
    const pending = [...activeSignals].reverse();
    const hist = history.map((h) => ({ ...h, status: h.status }));
    return [...pending, ...hist].slice(0, compact ? 6 : 14);
  }, [activeSignals, history, compact]);

  const isLoadingStream =
    connectionStatus === 'connecting' ||
    (connectionStatus === 'idle' &&
      !lastError &&
      connectionStatus !== 'disabled' &&
      activeSignals.length === 0 &&
      history.length === 0);

  const degradedConnection = connectionStatus === 'error';

  if (!envOn && !adminPreview) return null;
  if (!adminPreview && !showSignalsToUsers) return null;

  return (
    <motion.section
      variants={fadeUpBlur}
      className={`overflow-hidden rounded-2xl border border-cyan-500/15 bg-[#070b10] shadow-[0_0_0_1px_rgba(15,23,42,0.9),0_24px_80px_-24px_rgba(6,182,212,0.18),0_0_60px_-20px_rgba(139,92,246,0.12)] ${compact ? 'text-sm' : ''}`}
    >
      <ConnectionRibbon status={connectionStatus} reconnectAttempt={reconnectAttempt} lastError={lastError} />

      <div className={`space-y-4 ${compact ? 'p-4' : 'p-5 md:p-6'}`}>
        {/* Stats strip — Binance / TV density */}
        <div className={`grid gap-2 sm:gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 lg:grid-cols-4'}`}>
          <StatTile
            label="Wins"
            value={stats.wins}
            sub="Acumulado"
            accent="border-emerald-500/20"
          />
          <StatTile
            label="Losses"
            value={stats.losses}
            sub="Acumulado"
            accent="border-rose-500/20"
          />
          <StatTile
            label="Win rate"
            value={winRate != null ? `${winRate}%` : '—'}
            sub={winRate != null ? `${stats.wins + stats.losses} rondas` : 'Sin muestra'}
            accent="border-violet-500/20"
          />
          <StatTile
            label="Activas"
            value={stats.pending}
            sub="Señales pendientes"
            accent="border-amber-500/20"
          />
        </div>

        {/* Hero: señal actual */}
        <div
          className={`relative overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-slate-900/90 to-black/80 ${degradedConnection ? 'opacity-95' : ''}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(34,211,238,0.12),transparent_55%)]" />
          {isLoadingStream ? (
            <div className="relative space-y-3 p-5">
              <div className="h-4 w-32 animate-pulse rounded-md bg-slate-800" />
              <div className="h-14 w-full max-w-xs animate-pulse rounded-xl bg-slate-800/80" />
              <div className="h-3 w-48 animate-pulse rounded bg-slate-800/60" />
            </div>
          ) : (
            <div className="relative p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/90">
            Señal actual
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Actualización en tiempo real
                    {import.meta.env.DEV ? (
                      <span className="font-mono text-slate-600"> · #{streamTick}</span>
                    ) : null}
                  </p>
                </div>
                {current ? statusBadge(current.status) : (
                  <span className="rounded-full border border-slate-600/40 bg-slate-800/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Sin señal
                  </span>
                )}
              </div>

              <AnimatePresence mode="wait">
                {current ? (
                  <motion.div
                    key={current.id}
                    initial={reduceMotion ? false : { opacity: 0.75, scale: 0.97, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    transition={springSignal}
                    className="mt-5"
                  >
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                      {(() => {
                        const ps = sidePillFromRow(current);
                        return (
                          <span className={pillRecommendation(ps.side, !compact)}>{ps.label}</span>
                        );
                      })()}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono">
                          <TrendingUp className="h-4 w-4 text-slate-500" strokeWidth={2} />
                          Martingale <span className="text-white">{current.martingale}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono">
                          <Table2 className="h-4 w-4 text-slate-500" strokeWidth={2} />
                          {current.mesa || '—'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono">
                          <Hash className="h-4 w-4 text-slate-500" strokeWidth={2} />
                          {current.round || '—'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-6 text-sm text-slate-500"
                  >
                    Esperando <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-cyan-300/90">NEW_SIGNAL</code>
                    … Conexión estable, a la espera del proveedor.
                  </motion.p>
                )}
              </AnimatePresence>

              {queueOthers.length > 0 ? (
                <div className="mt-5 border-t border-white/5 pt-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Cola pendiente</p>
                  <div className="flex flex-wrap gap-2">
                    {queueOthers.map((q) => (
                      <span
                        key={q.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-600/40 bg-slate-900/60 px-2.5 py-1.5 text-[10px] font-mono text-slate-300"
                      >
                        {sidePillFromRow(q).label} · MG{q.martingale}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {connectionStatus === 'reconnecting' ? (
            <div className="flex items-center gap-2 border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[11px] text-amber-100/95">
              <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" strokeWidth={2} />
              Reconectando al feed… Los datos pueden retrasarse unos segundos.
            </div>
          ) : null}
        </div>

        {/* Historial + pendientes unificados */}
        {!compact || feedRows.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Historial & pendientes
              </h4>
              <span className="text-[10px] text-slate-600">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle" /> win ·{' '}
                <span className="inline-block h-2 w-2 rounded-full bg-rose-400 align-middle" /> loss ·{' '}
                <span className="inline-block h-2 w-2 rounded-full bg-slate-500 align-middle" /> pending
              </span>
            </div>
            <motion.ul
              layout
              className={`custom-scrollbar max-h-[min(320px,42vh)] space-y-1.5 overflow-y-auto rounded-xl border border-white/[0.06] bg-black/20 p-1.5`}
            >
              <AnimatePresence initial={false}>
                {feedRows.length === 0 ? (
                  <li className="px-3 py-8 text-center text-xs text-slate-600">Aún no hay entradas en el feed.</li>
                ) : (
                  feedRows.map((row, idx) => (
                    <HistoryRow
                      key={row.id}
                      row={row}
                      isLatestSettled={idx === 0 && row.status !== 'pending'}
                      reduceMotion={reduceMotion}
                    />
                  ))
                )}
              </AnimatePresence>
            </motion.ul>
          </div>
        ) : null}

        {recentEvents[0] ? (
          <motion.div
            key={recentEvents[0].ts}
            initial={reduceMotion ? false : { opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2.5"
          >
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/80" strokeWidth={2} />
            <div className="min-w-0 text-[11px] leading-relaxed text-slate-400">
              <span className="font-mono text-[10px] text-slate-600">
                {new Date(recentEvents[0].ts).toLocaleTimeString()}
              </span>{' '}
              <span className="text-slate-300">{recentEvents[0].summary}</span>
            </div>
          </motion.div>
        ) : null}

        {/* Footer perf / trust cue */}
        <p className="text-center text-[10px] leading-relaxed text-slate-600">
          Las señales son informativas. GPulse no ejecuta órdenes en mesas externas. Mercados con riesgo.
        </p>
      </div>
    </motion.section>
  );
}
