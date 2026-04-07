import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Bug,
  ChevronDown,
  ChevronUp,
  Flame,
  Layers,
  Radio,
  Sparkles,
  Table2,
  Target,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  adminSignalsPushDebugLog,
  getAdminSignalsLiveServerSnapshot,
  getAdminSignalsLiveSnapshot,
  subscribeAdminSignalsLive,
} from '../realtime/adminSignalsLiveStore.js';
import { soundEnabled } from '../utils/adminSignalsSounds.js';
import { normSide } from '../utils/signalFormatter.js';
import { classifySignal } from '../utils/signalClassifier.js';
import AdminSignalsHero from './AdminSignalsHero.jsx';

const MAX_DEBUG_UI_LOGS = 100;
const SCROLL_TOP_THRESHOLD_PX = 48;
const MINI_SAMPLE = 20;
const DEFAULT_COMPACT_MAX = 8;

/** @param {'green' | 'yellow' | 'red' | 'slate'} color */
function classificationChipClass(color) {
  switch (color) {
    case 'green':
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100';
    case 'yellow':
      return 'border-amber-400/35 bg-amber-500/10 text-amber-100';
    case 'red':
      return 'border-rose-500/35 bg-rose-500/10 text-rose-100';
    default:
      return 'border-white/10 bg-slate-900/60 text-slate-400';
  }
}

/**
 * @param {{ cells?: unknown[], max?: number }} props
 */
function HistoryBeads({ cells = [], max = 20 }) {
  if (!cells.length) {
    return <span className="text-[10px] text-slate-600">—</span>;
  }
  const slice = cells.slice(-max);
  return (
    <div className="flex flex-wrap items-center gap-px" title={slice.map(String).join(', ')}>
      {slice.map((cell, i) => {
        const side = normSide(cell);
        const emoji =
          side === 'PLAYER' ? '🔵' : side === 'BANKER' ? '🔴' : side === 'TIE' ? '🤝' : '·';
        return (
          <span key={i} className="text-[11px] leading-none">
            {emoji}
          </span>
        );
      })}
    </div>
  );
}

/**
 * @param {{ verdict?: string, outcome?: { type?: string, label?: string, icon?: string, color?: string } }} props
 */
function VerdictBadge({ verdict, outcome }) {
  if (outcome && outcome.type && outcome.type !== 'UNKNOWN' && outcome.label && outcome.label !== '—') {
    const c =
      outcome.color === 'green'
        ? 'text-emerald-300'
        : outcome.color === 'red'
          ? 'text-rose-300'
          : outcome.color === 'amber'
            ? 'text-amber-200'
            : 'text-slate-400';
    return (
      <span className={`font-bold ${c}`}>
        {outcome.icon} {outcome.label}
      </span>
    );
  }
  if (verdict === 'WIN') return <span className="font-bold text-emerald-300">✅ Ganada</span>;
  if (verdict === 'LOSS') return <span className="font-bold text-rose-300">❌ Perdida</span>;
  if (verdict === 'TIE') return <span className="font-bold text-amber-200">🤝 Empate</span>;
  return <span className="font-medium text-slate-500">—</span>;
}

/**
 * Win streak desde el primer resultado (más reciente).
 * @param {{ verdict?: string }[]} resultsNewestFirst
 */
function winStreakFrom(resultsNewestFirst) {
  let n = 0;
  for (const r of resultsNewestFirst) {
    if (r.verdict === 'WIN') n += 1;
    else break;
  }
  return n;
}

/**
 * Pérdidas consecutivas desde el más reciente.
 * @param {{ verdict?: string }[]} resultsNewestFirst
 */
function lossStreakFrom(resultsNewestFirst) {
  let n = 0;
  for (const r of resultsNewestFirst) {
    if (r.verdict === 'LOSS') n += 1;
    else break;
  }
  return n;
}

/**
 * @param {{ winStatus?: boolean }[]} results
 */
function miniStatsLast20(results) {
  const slice = results.slice(0, MINI_SAMPLE);
  const settled = slice.filter((r) => r.verdict === 'WIN' || r.verdict === 'LOSS');
  const wins = settled.filter((r) => r.verdict === 'WIN').length;
  const winRatePct = settled.length > 0 ? Math.round((wins / settled.length) * 1000) / 10 : 0;
  return {
    winRatePct,
    sampleCount: settled.length,
    winStreak: winStreakFrom(results),
    lossStreak: lossStreakFrom(results),
  };
}

/**
 * @param {{ compact?: boolean, compactMaxSignals?: number }} props
 */
export default function AdminSignalsProPanel({ compact = false, compactMaxSignals = DEFAULT_COMPACT_MAX }) {
  const live = useSyncExternalStore(subscribeAdminSignalsLive, getAdminSignalsLiveSnapshot, getAdminSignalsLiveServerSnapshot);
  const { signals, results, connected, debugLastSignal, debugLastResult, debugLogs } = live;

  const [debugOpen, setDebugOpen] = useState(false);
  const [debugPayloadMode, setDebugPayloadMode] = useState(/** @type {'raw' | 'formatted' | 'both'} */ ('both'));
  const [showLiveLogs, setShowLiveLogs] = useState(true);
  const [livePayloadDebug, setLivePayloadDebug] = useState(false);

  const signalsVisible = compact ? signals.slice(0, Math.max(5, compactMaxSignals)) : signals;

  const feedScrollRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const userNearTopRef = useRef(true);
  const prevSignalsHeadRef = useRef(/** @type {string | null} */ (null));
  const prevConnectedRef = useRef(connected);

  const onFeedScroll = useCallback((e) => {
    const el = e.currentTarget;
    userNearTopRef.current = el.scrollTop <= SCROLL_TOP_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    const el = feedScrollRef.current;
    if (!el || signals.length === 0 || compact) return;
    const headId = signals[0]?.recvId ?? null;
    const headChanged = headId !== prevSignalsHeadRef.current;
    prevSignalsHeadRef.current = headId;
    if (headChanged && userNearTopRef.current) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [signals, compact]);

  useEffect(() => {
    if (!debugOpen || !showLiveLogs) {
      prevConnectedRef.current = connected;
      return;
    }
    if (prevConnectedRef.current !== connected) {
      adminSignalsPushDebugLog(connected ? 'connect' : 'disconnect');
      prevConnectedRef.current = connected;
    }
  }, [connected, debugOpen, showLiveLogs]);

  const groupedSignals = useMemo(() => {
    /** @type {Record<string, any[]>} */
    const buckets = {};
    const order = [];
    const src = compact ? signalsVisible : signals;
    for (const s of src) {
      const k = String(s.mesa);
      if (!buckets[k]) {
        buckets[k] = [];
        order.push(k);
      }
      buckets[k].push(s);
    }
    return { order, buckets };
  }, [signals, signalsVisible, compact]);

  const heroSignal = signals[0] ?? null;
  const latestRecvId = heroSignal?.recvId ?? null;

  const mini = useMemo(() => miniStatsLast20(results), [results]);

  const insights = useMemo(() => {
    const totalSignals = signals.length;
    const mVals = signals.map((s) => Number(s.martingaleLevel)).filter((n) => !Number.isNaN(n));
    const avgMartin =
      mVals.length > 0 ? Math.round((mVals.reduce((a, b) => a + b, 0) / mVals.length) * 10) / 10 : 0;
    return { totalSignals, avgMartin };
  }, [signals]);

  const classificationStats = useMemo(() => {
    const counts = { DIRECT_ENTRY: 0, RECOVERY: 0, HIGH_RISK: 0, UNKNOWN: 0 };
    for (const s of signals) {
      const t = (s.classification ?? classifySignal(s))?.type ?? 'UNKNOWN';
      if (t in counts) counts[t] += 1;
      else counts.UNKNOWN += 1;
    }
    return counts;
  }, [signals]);

  const findLinkedResult = useMemo(() => {
    return (/** @type {any} */ s) => {
      if (s.correlationKey) {
        const byCk = results.find(
          (r) => r.correlationKey && String(r.correlationKey) === String(s.correlationKey),
        );
        if (byCk) return byCk;
      }
      if (s.id) {
        const byId = results.find((r) => r.signalId && String(r.signalId) === String(s.id));
        if (byId) return byId;
      }
      return results.find((r) => r.mesa === s.mesa && String(r.round) === String(s.round));
    };
  }, [results]);

  const renderSignalCard = (s, /** @type {{ isLatestGlobal: boolean }} */ { isLatestGlobal }) => {
    const colorCls = s.predictionColor === 'blue' ? 'blue' : s.predictionColor === 'red' ? 'red' : 'neutral';
    const martin = Number(s.martingaleLevel) || 0;
    const highRisk = martin >= 3;
    const linked = findLinkedResult(s);
    const predEmoji = s.predictionLabel === 'PLAYER' ? '🔵' : s.predictionLabel === 'BANKER' ? '🔴' : '🎯';
    const cls = s.classification ?? classifySignal(s);

    return (
      <motion.div
        key={s.recvId}
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{
          opacity: 1,
          scale: [0.98, 1.015, 1],
        }}
        exit={{ opacity: 0, height: 0 }}
        transition={{
          opacity: { duration: 0.22 },
          scale: { duration: 0.4, times: [0, 0.42, 1] },
          layout: { type: 'spring', stiffness: 380, damping: 30 },
        }}
        className={`signal-card relative ${isLatestGlobal ? 'signal-card-latest' : ''}`}
      >
        <div className="absolute left-0 top-0 h-full w-1 rounded-full bg-gradient-to-b from-white/10 to-transparent" />
        {highRisk ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-md border border-amber-500/45 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
            ⚠️ RIESGO ALTO
          </span>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-2 pr-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="mesa">
              🎯 Mesa <span className="text-white">{s.mesa}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={`signal-type inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classificationChipClass(cls.color)}`}
              >
                <span aria-hidden>{cls.icon}</span>
                <span>{cls.label}</span>
              </div>
              <div className="signal-direction text-[11px] font-semibold tracking-tight text-slate-200">
                {cls.direction}
              </div>
            </div>
            <div className={`prediction flex flex-wrap items-center gap-1.5 ${colorCls}`}>
              <span aria-hidden>{predEmoji}</span>
              <span>{s.predictionLabel}</span>
              <span className="text-[10px] font-normal text-slate-500">({s.recommendation})</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
              <span title="Martingala">
                🔁 <span className="martingale font-mono text-slate-200">{s.martingale}</span>
              </span>
              <span title="Ronda">
                ⏱ Round <span className="round font-mono text-slate-200">R{s.round}</span>
              </span>
              <span title="Hora">
                <span className="time font-mono text-slate-500">{s.timestamp}</span>
              </span>
            </div>
            {s.id ? (
              <p className="font-mono text-[9px] text-slate-600">
                🆔 ID <span className="text-slate-500">{s.id}</span>
                {s.correlationKey ? (
                  <span className="ml-2 text-slate-600" title="Correlación">
                    · {String(s.correlationKey).slice(0, 48)}
                    {String(s.correlationKey).length > 48 ? '…' : ''}
                  </span>
                ) : null}
              </p>
            ) : s.correlationKey ? (
              <p className="font-mono text-[9px] text-slate-600" title="Correlación">
                🔗 {String(s.correlationKey).slice(0, 56)}
                {String(s.correlationKey).length > 56 ? '…' : ''}
              </p>
            ) : null}
            {linked ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 rounded-lg border border-white/[0.07] bg-slate-900/50 px-2.5 py-2"
              >
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Resultado de la señal (correlación)
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-slate-400">
                    Predicción <span className="font-semibold text-slate-200">{linked.predictionLabel}</span>
                    <span className="text-slate-600"> · Ganador </span>
                    <span
                      className={
                        linked.ganador === 'PLAYER' || linked.winnerLabel === 'PLAYER'
                          ? 'text-sky-300'
                          : linked.ganador === 'BANKER' || linked.winnerLabel === 'BANKER'
                            ? 'text-rose-300'
                            : 'text-slate-200'
                      }
                    >
                      {String(linked.ganador ?? linked.winnerLabel ?? '—')}
                    </span>
                  </span>
                  <VerdictBadge verdict={linked.verdict} outcome={linked.outcome} />
                </div>
                {linked.historial?.length ? (
                  <div className="mt-1.5">
                    <HistoryBeads cells={linked.historial} />
                  </div>
                ) : null}
              </motion.div>
            ) : null}
            {livePayloadDebug && s.providerRawPreview ? (
              <details className="mt-2 rounded border border-white/10 bg-black/40 p-2">
                <summary className="cursor-pointer text-[10px] text-slate-400">Payloads (recortados)</summary>
                <p className="mt-2 text-[9px] font-bold uppercase text-slate-500">Original</p>
                <pre className="custom-scrollbar mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[9px] text-amber-100/85">
                  {s.providerRawPreview}
                </pre>
                <p className="mt-2 text-[9px] font-bold uppercase text-slate-500">Normalizado (UI)</p>
                <pre className="custom-scrollbar mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-[9px] text-cyan-100/85">
                  {s.normalizedPreview}
                </pre>
              </details>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100/95">
              <Zap className="h-3 w-3 shrink-0" aria-hidden />
              ENTRAR AHORA
            </span>
            {isLatestGlobal ? (
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300/90">Última señal</span>
            ) : null}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderDebugPayload = (label, entry) => {
    if (!entry) {
      return (
        <p className="text-[10px] text-slate-600">
          Sin datos <span className="text-slate-500">({label})</span>
        </p>
      );
    }
    const showRaw = debugPayloadMode === 'raw' || debugPayloadMode === 'both';
    const showFmt = debugPayloadMode === 'formatted' || debugPayloadMode === 'both';
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <div className={`grid gap-2 ${debugPayloadMode === 'both' ? 'sm:grid-cols-2' : ''}`}>
          {showRaw ? (
            <pre className="custom-scrollbar max-h-40 overflow-auto rounded-lg border border-white/[0.06] bg-black/50 p-2 font-mono text-[10px] leading-relaxed text-amber-100/90">
              {(() => {
                try {
                  const s = JSON.stringify(entry.raw, null, 2);
                  return s.length > 2400 ? `${s.slice(0, 2400)}\n… [truncated]` : s;
                } catch {
                  return String(entry.raw).slice(0, 2400);
                }
              })()}
            </pre>
          ) : null}
          {showFmt ? (
            <pre className="custom-scrollbar max-h-40 overflow-auto rounded-lg border border-white/[0.06] bg-black/50 p-2 font-mono text-[10px] leading-relaxed text-cyan-100/90">
              {(() => {
                try {
                  const s = JSON.stringify(entry.formatted, null, 2);
                  return s.length > 2400 ? `${s.slice(0, 2400)}\n… [truncated]` : s;
                } catch {
                  return String(entry.formatted).slice(0, 2400);
                }
              })()}
            </pre>
          ) : null}
        </div>
      </div>
    );
  };

  const logsUi = debugLogs.slice(0, MAX_DEBUG_UI_LOGS);

  if (compact) {
    return (
      <div className="space-y-4 text-slate-100">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 py-2.5"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10">
              <Sparkles className="h-4 w-4 text-amber-300" aria-hidden />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-400/90">Tiempo real</p>
              <p className="text-xs font-semibold text-white">Desk compacto</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                connected
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
              }`}
            >
              {connected ? <Wifi className="h-3.5 w-3.5" aria-hidden /> : <WifiOff className="h-3.5 w-3.5" aria-hidden />}
              {connected ? 'En vivo' : 'Off'}
            </div>
            <button
              type="button"
              onClick={() => setLivePayloadDebug((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ${
                livePayloadDebug
                  ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                  : 'border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/20'
              }`}
            >
              {livePayloadDebug ? <EyeOff className="h-3 w-3" aria-hidden /> : <Eye className="h-3 w-3" aria-hidden />}
              Payloads
            </button>
            <Link
              to="/admin/signals"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400/55 hover:bg-cyan-500/15"
            >
              Ver panel completo
            </Link>
          </div>
        </motion.div>

        <AdminSignalsHero signal={heroSignal} compact />

        <div className="rounded-xl border border-sky-500/15 bg-[#070b14]/90 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-sky-300">
              <Layers className="h-3.5 w-3.5" aria-hidden />
              Últimas señales
            </h3>
            <span className="text-[10px] text-slate-500">{signalsVisible.length} visibles</span>
          </div>
          <div className="custom-scrollbar max-h-[280px] space-y-2 overflow-y-auto pr-0.5">
            <AnimatePresence initial={false} mode="popLayout">
              {signalsVisible.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">Esperando señales…</p>
              ) : (
                signalsVisible.map((s) => renderSignalCard(s, { isLatestGlobal: s.recvId === latestRecvId }))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-slate-950/90 via-slate-900/80 to-indigo-950/40 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <Sparkles className="h-5 w-5 text-amber-300" aria-hidden />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/90">Live desk</p>
            <h1 className="text-lg font-bold tracking-tight text-white">Señales · Pro</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="hidden rounded-full border border-white/[0.08] bg-slate-900/60 px-2.5 py-1 text-[10px] font-medium text-slate-400 sm:inline"
            title="Sonidos del panel"
          >
            Audio {soundEnabled ? 'ON' : 'OFF'}
          </span>
          <button
            type="button"
            onClick={() => setLivePayloadDebug((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
              livePayloadDebug
                ? 'border-cyan-500/45 bg-cyan-500/10 text-cyan-100'
                : 'border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/18'
            }`}
          >
            {livePayloadDebug ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            Payloads en tarjetas
          </button>
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              connected
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
            }`}
          >
            {connected ? <Wifi className="h-4 w-4" aria-hidden /> : <WifiOff className="h-4 w-4" aria-hidden />}
            {connected ? 'Canal en vivo' : 'Desconectado'}
          </div>
        </div>
      </div>

      <AdminSignalsHero signal={heroSignal} />

      {signals.length > 0 ? (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-teal-200/90">
            Clasificación · buffer actual
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <motion.div
              initial={false}
              whileHover={{ y: -1 }}
              className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
            >
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400/90">
                🟢 Directas
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums text-emerald-100">{classificationStats.DIRECT_ENTRY}</p>
              <p className="mt-1 text-[10px] text-slate-500">M0 · entrada directa</p>
            </motion.div>
            <motion.div
              initial={false}
              whileHover={{ y: -1 }}
              className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
            >
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-300/90">
                🟡 Recuperación
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums text-amber-100">{classificationStats.RECOVERY}</p>
              <p className="mt-1 text-[10px] text-slate-500">M1–M2</p>
            </motion.div>
            <motion.div
              initial={false}
              whileHover={{ y: -1 }}
              className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
            >
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-rose-300/90">
                🔴 Alto riesgo
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums text-rose-100">{classificationStats.HIGH_RISK}</p>
              <p className="mt-1 text-[10px] text-slate-500">M≥3</p>
            </motion.div>
          </div>
        </section>
      ) : null}

      {results.length > 0 ? (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-200/95">
            📊 Resultados en tiempo real
          </h2>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {results.slice(0, 12).map((r) => (
                <motion.div
                  key={r.recvId}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  className={`min-w-[140px] rounded-xl border px-3 py-2 shadow-inner ${
                    r.verdictTone === 'win'
                      ? 'border-emerald-500/30 bg-emerald-950/25'
                      : r.verdictTone === 'loss'
                        ? 'border-rose-500/30 bg-rose-950/25'
                        : r.verdictTone === 'tie'
                          ? 'border-amber-500/25 bg-amber-950/20'
                          : 'border-white/[0.08] bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-white">{r.mesa}</span>
                    <VerdictBadge verdict={r.verdict} outcome={r.outcome} />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Pred. <span className="text-slate-300">{r.predictionLabel}</span> · Gan.{' '}
                    <span
                      className={
                        r.ganador === 'PLAYER'
                          ? 'text-sky-300'
                          : r.ganador === 'BANKER'
                            ? 'text-rose-300'
                            : 'text-slate-300'
                      }
                    >
                      {String(r.ganador ?? r.winnerLabel ?? '—')}
                    </span>
                  </p>
                  {r.historial?.length ? (
                    <div className="mt-1.5 border-t border-white/[0.06] pt-1">
                      <HistoryBeads cells={r.historial} max={10} />
                    </div>
                  ) : null}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-indigo-200">
          <Flame className="h-4 w-4 text-orange-400" aria-hidden />
          Mini stats · operativa
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <motion.div
            initial={false}
            whileHover={{ y: -1 }}
            className="rounded-xl border border-emerald-500/25 bg-slate-950/75 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-shadow hover:shadow-[0_12px_40px_-18px_rgba(16,185,129,0.35)]"
          >
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400/85">
              <Target className="h-3.5 w-3.5" aria-hidden />
              Win rate (últ. {MINI_SAMPLE})
            </p>
            <p className="mt-2 text-3xl font-black tabular-nums text-emerald-200">{mini.winRatePct}%</p>
            <p className="mt-1 text-[10px] text-slate-500">
              Muestra: {mini.sampleCount} resultados con veredicto
            </p>
          </motion.div>
          <motion.div
            initial={false}
            whileHover={{ y: -1 }}
            className="rounded-xl border border-violet-500/25 bg-slate-950/75 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-shadow hover:shadow-[0_12px_40px_-18px_rgba(139,92,246,0.35)]"
          >
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-violet-400/85">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              R · ganadas seguidas
            </p>
            <p className="mt-2 text-3xl font-black tabular-nums text-violet-100">{mini.winStreak}</p>
            <p className="mt-1 text-[10px] text-slate-500">Desde el último resultado registrado</p>
          </motion.div>
          <motion.div
            initial={false}
            whileHover={{ y: -1 }}
            className="rounded-xl border border-rose-500/25 bg-slate-950/75 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-shadow hover:shadow-[0_12px_40px_-18px_rgba(244,63,94,0.3)]"
          >
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-rose-400/85">
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
              Pérdidas consecutivas
            </p>
            <p className="mt-2 text-3xl font-black tabular-nums text-rose-100">{mini.lossStreak}</p>
            <p className="mt-1 text-[10px] text-slate-500">Racha negativa actual</p>
          </motion.div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400">
          <BarChart3 className="h-4 w-4" aria-hidden />
          Buffer & martingala
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <motion.div className="rounded-xl border border-cyan-500/20 bg-slate-950/70 p-4">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-400/80">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              Total señales en buffer
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">{insights.totalSignals}</p>
          </motion.div>
          <motion.div className="rounded-xl border border-amber-500/20 bg-slate-950/70 p-4">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
              <Radio className="h-3.5 w-3.5" aria-hidden />
              Mart. promedio (buffer)
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-amber-100">{insights.avgMartin}</p>
          </motion.div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="flex min-h-[360px] flex-col rounded-2xl border border-sky-500/15 bg-[#070b14]/95 p-4 shadow-lg shadow-sky-950/20">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-sky-300">
              <Layers className="h-4 w-4" aria-hidden />
              Feed por mesa
            </h2>
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
              {signals.length} · {groupedSignals.order.length} mesas
            </span>
          </div>
          <div
            ref={feedScrollRef}
            onScroll={onFeedScroll}
            className="custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto pr-1"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {signals.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Esperando señales…</p>
              ) : (
                groupedSignals.order.map((mesa) => {
                  const list = groupedSignals.buckets[mesa] ?? [];
                  return (
                    <motion.div
                      key={mesa}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28 }}
                      className="space-y-2"
                    >
                      <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-white/[0.07] bg-[#070b14]/95 py-1.5 pl-0.5 backdrop-blur-sm">
                        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-200/95">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
                          {mesa}
                        </h3>
                        <span className="text-[10px] font-mono text-slate-500">{list.length}</span>
                      </div>
                      <div className="space-y-2 pl-0.5">
                        {list.map((s) =>
                          renderSignalCard(s, { isLatestGlobal: s.recvId === latestRecvId }),
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
          <p className="mt-2 text-[10px] text-slate-600">
            Scroll automático al llegar señal solo si estás arriba del feed (≤{SCROLL_TOP_THRESHOLD_PX}px).
          </p>
        </section>

        <section className="flex min-h-[360px] flex-col rounded-2xl border border-emerald-500/15 bg-[#070b14]/95 p-4 shadow-lg shadow-emerald-950/15">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-300">
              <Table2 className="h-4 w-4" aria-hidden />
              Results table
            </h2>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
              {results.length} filas
            </span>
          </div>
          <div className="custom-scrollbar min-h-0 flex-1 overflow-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-950/95 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Mesa</th>
                  <th className="px-3 py-2">Predicción</th>
                  <th className="px-3 py-2">Ganador</th>
                  <th className="px-3 py-2">Vs pred.</th>
                  <th className="px-3 py-2">Veredicto</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Corr.</th>
                  <th className="px-3 py-2">Historial</th>
                  <th className="px-3 py-2">Hora</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                      Sin resultados aún
                    </td>
                  </tr>
                ) : (
                  results.map((r) => {
                    const v = r.verdict;
                    const tone = r.verdictTone;
                    const vs = r.versus;
                    const winColor = '#34d399';
                    const lossColor = '#f87171';

                    return (
                      <motion.tr
                        key={r.recvId}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`border-t border-white/[0.05] ${
                          tone === 'win'
                            ? 'bg-emerald-950/35'
                            : tone === 'loss'
                              ? 'bg-rose-950/35'
                              : tone === 'tie'
                                ? 'bg-amber-950/20'
                                : 'bg-slate-900/40'
                        }`}
                      >
                        <td className="px-3 py-2 font-mono font-semibold text-white">{String(r.mesa)}</td>
                        <td
                          className="px-3 py-2 font-bold"
                          style={{
                            color: r.predictionLabel === 'PLAYER' ? '#3b82f6' : r.predictionLabel === 'BANKER' ? '#ef4444' : undefined,
                          }}
                        >
                          {String(r.predictionLabel)}
                        </td>
                        <td
                          className={`px-3 py-2 font-semibold ${
                            r.ganador === 'PLAYER' || r.winnerLabel === 'PLAYER'
                              ? 'text-sky-300'
                              : r.ganador === 'BANKER' || r.winnerLabel === 'BANKER'
                                ? 'text-rose-300'
                                : 'text-slate-100'
                          }`}
                        >
                          {String(r.ganador ?? r.winnerLabel ?? '—')}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                            style={{
                              color: vs === 'WIN' ? winColor : vs === 'LOSS' ? lossColor : undefined,
                              backgroundColor:
                                vs === 'WIN' ? 'rgba(52,211,153,0.12)' : vs === 'LOSS' ? 'rgba(248,113,113,0.12)' : 'rgba(148,163,184,0.1)',
                            }}
                          >
                            {String(vs)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="scale-95 origin-left">
                            <VerdictBadge verdict={v} outcome={r.outcome} />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[10px] font-semibold">
                          <span
                            className={
                              r.outcome?.color === 'green'
                                ? 'text-emerald-300'
                                : r.outcome?.color === 'red'
                                  ? 'text-rose-300'
                                  : r.outcome?.color === 'amber'
                                    ? 'text-amber-200'
                                    : 'text-slate-500'
                            }
                          >
                            {r.outcome?.icon ? `${r.outcome.icon} ` : ''}
                            {r.outcome?.label ?? '—'}
                          </span>
                        </td>
                        <td className="max-w-[72px] px-3 py-2 font-mono text-[9px] text-slate-500" title={r.correlationKey ?? ''}>
                          {r.correlationKey
                            ? `${String(r.correlationKey).slice(0, 10)}${String(r.correlationKey).length > 10 ? '…' : ''}`
                            : '—'}
                        </td>
                        <td className="max-w-[140px] px-3 py-2">
                          <HistoryBeads cells={r.historial} max={14} />
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-slate-500">{r.tiempo}</td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/80">
        <button
          type="button"
          onClick={() => setDebugOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-white/[0.03]"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Bug className="h-4 w-4 text-amber-400" aria-hidden />
            Debug panel
          </span>
          {debugOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </button>
        <AnimatePresence>
          {debugOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="border-t border-white/[0.06]"
            >
              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payload view</span>
                  {['raw', 'formatted', 'both'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDebugPayloadMode(/** @type {'raw'|'formatted'|'both'} */ (m))}
                      className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                        debugPayloadMode === m
                          ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                          : 'border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      {m === 'raw' ? 'Raw' : m === 'formatted' ? 'Formatted' : 'Ambos'}
                    </button>
                  ))}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={showLiveLogs}
                    onChange={(e) => setShowLiveLogs(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900"
                  />
                  Logs en vivo
                </label>
                <div className="grid gap-4 border-t border-white/[0.04] pt-4 md:grid-cols-2">
                  {renderDebugPayload('Último NEW_SIGNAL', debugLastSignal)}
                  {renderDebugPayload('Último NEW_RESULT', debugLastResult)}
                </div>
              </div>
              {showLiveLogs ? (
                <div className="custom-scrollbar max-h-40 overflow-auto border-t border-white/[0.04] p-3 font-mono text-[10px] text-slate-400">
                  {logsUi.length === 0 ? (
                    <span className="text-slate-600">Sin logs</span>
                  ) : (
                    logsUi.map((line, i) => (
                      <div key={i} className="border-b border-white/[0.03] py-1 last:border-0">
                        {line}
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
    </div>
  );
}
