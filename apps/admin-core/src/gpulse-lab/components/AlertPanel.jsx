import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, AlertTriangle, Ban, Bell, ChevronDown, ChevronRight, Copy, Info, RefreshCw, TimerOff, Trash2, XCircle } from 'lucide-react';
import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';
import { ALERT_TYPES, clearAlerts, useAlertStore } from '../store/useAlertStore.js';
import { buildAlertCopyText, fallbackCopy, normalizePorqueItems } from '../utils/buildAlertCopyText.js';
import { generateAlertAnalysis, isForensicsDataComplete } from '../utils/alertAnalysisEngine.js';
import { ALERT_SECTION_ICONS, ALERT_SECTION_SEP } from '../utils/alertAnalysisPresentation.js';

const VITE_GPULSE_LAB_DEBUG = import.meta.env.VITE_GPULSE_LAB_DEBUG === '1';

function iconForType(type) {
  const t = String(type);
  if (t === ALERT_TYPES.STREAM_DELAY_EXPECTED) return Info;
  if (t === ALERT_TYPES.STREAM_INTERRUPTED) return Activity;
  if (t === ALERT_TYPES.CICLO_RECUPERADO) return RefreshCw;
  if (t.includes('RESULTADO SIN')) return XCircle;
  if (t.includes('BLOQUEADA')) return Ban;
  if (t.includes('ROUND')) return RefreshCw;
  if (t.includes('DELAY')) return TimerOff;
  if (t.includes('INCOMPLETO')) return AlertTriangle;
  if (t.includes('STREAM_TIMEOUT') || t.includes('LAB_TIMEOUT') || t.includes('TIMEOUT')) return TimerOff;
  return Bell;
}

function severityStyles(sev) {
  switch (sev) {
    case 'error':
      return 'border-red-500/40 bg-red-950/35 text-red-100';
    case 'warning':
      return 'border-amber-500/40 bg-amber-950/30 text-amber-100';
    default:
      return 'border-emerald-500/35 bg-emerald-950/25 text-emerald-100';
  }
}

/** STREAM_DELAY_EXPECTED / STREAM_INTERRUPTED: tono informativo (no pánico). */
function rowStylesForAlert(alert) {
  if (alert.type === ALERT_TYPES.STREAM_DELAY_EXPECTED) {
    return 'border-sky-500/40 bg-sky-950/30 text-sky-50';
  }
  if (alert.type === ALERT_TYPES.STREAM_INTERRUPTED) {
    return 'border-slate-500/35 bg-slate-950/40 text-slate-100';
  }
  return severityStyles(alert.severity);
}

function severityLabel(sev) {
  switch (sev) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

function formatTime(ts) {
  if (ts == null) return '—';
  return new Date(ts).toLocaleTimeString();
}

const I = ALERT_SECTION_ICONS;

const SectionSep = memo(function SectionSep() {
  return (
    <div
      className="overflow-x-auto break-all font-mono text-[7px] leading-none tracking-tight text-slate-600/85"
      aria-hidden
    >
      {ALERT_SECTION_SEP}
    </div>
  );
});

const AnalysisBlock = memo(function AnalysisBlock({ icon, label, children, tone = 'default' }) {
  const labelClass =
    tone === 'calm' ? 'font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-300/95' : 'font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-300/80';
  return (
    <div className="rounded border border-white/[0.06] bg-black/30 p-2">
      <p className={labelClass}>
        <span className="mr-1" aria-hidden>
          {icon}
        </span>
        [{label}]
      </p>
      <div className="mt-1.5 font-mono text-[10px] leading-relaxed text-slate-300">{children}</div>
    </div>
  );
});

const AlertAnalysisBody = memo(
  function AlertAnalysisBody({ analysis, rawPayload, debugMode, alertType }) {
    const isStreamDelayExpected = alertType === ALERT_TYPES.STREAM_DELAY_EXPECTED;
    const sectionTone = isStreamDelayExpected ? 'calm' : 'default';
    const porqueItems = normalizePorqueItems(analysis);
    const trace = Array.isArray(analysis.rutaTecnica) ? analysis.rutaTecnica : [];
    const f = analysis.data?.forensics ?? {};
    const dataComplete = isForensicsDataComplete(f);
    const mg = f?.martingala != null && typeof f.martingala === 'object' && !Array.isArray(f.martingala) ? f.martingala : null;
    const pasos = Array.isArray(analysis.recomendacionPasos) ? analysis.recomendacionPasos : [];
    const ea = analysis.estadoActual != null && typeof analysis.estadoActual === 'object' ? analysis.estadoActual : null;

    return (
      <div className="space-y-2 border-t border-white/[0.08] pt-3">
        <SectionSep />
        <AnalysisBlock icon={I.que} label="QUE" tone={sectionTone}>
          <p>{analysis.que}</p>
        </AnalysisBlock>
        {analysis.calidadRecuperacion != null && typeof analysis.calidadRecuperacion === 'object' ? (
          <>
            <SectionSep />
            <AnalysisBlock icon={I.calidadRecuperacion} label="CALIDAD DE RECUPERACION" tone={sectionTone}>
              <p>
                <span className="text-base leading-none">{String(analysis.calidadRecuperacion.emoji ?? '')}</span>{' '}
                <span className="font-semibold text-slate-200">{String(analysis.calidadRecuperacion.nivel ?? '—')}</span>
                <span className="text-slate-500"> — </span>
                {String(analysis.calidadRecuperacion.texto ?? '—')}
              </p>
              {analysis.calidadRecuperacion.investigar ? (
                <p className="mt-2 text-[12px] text-amber-200/95">{String(analysis.calidadRecuperacion.investigar)}</p>
              ) : null}
            </AnalysisBlock>
          </>
        ) : null}
        <SectionSep />
        <AnalysisBlock icon={I.cuando} label="CUANDO" tone={sectionTone}>
          <p>{analysis.cuando}</p>
        </AnalysisBlock>
        <SectionSep />
        <AnalysisBlock icon={I.donde} label="DONDE" tone={sectionTone}>
          <p>
            {typeof analysis.donde === 'string'
              ? analysis.donde
              : analysis.donde?.summary ??
                `Mesa ${analysis.donde?.mesa ?? '—'} · Round ${analysis.donde?.round ?? '—'}`}
          </p>
        </AnalysisBlock>
        <SectionSep />
        <AnalysisBlock icon={I.impacto} label="IMPACTO" tone={sectionTone}>
          {analysis.impacto != null &&
          typeof analysis.impacto === 'object' &&
          analysis.impacto.variant === 'reassurance' &&
          Array.isArray(analysis.impacto.lines) ? (
            <ul className="list-none space-y-1.5 text-slate-300/95">
              {analysis.impacto.lines.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          ) : analysis.impacto != null && typeof analysis.impacto === 'object' ? (
            <ul className="list-none space-y-1.5 text-slate-400">
              <li>
                <span className="text-slate-500">Ciclo: </span>
                {analysis.impacto.ciclo}
              </li>
              <li>
                <span className="text-slate-500">Datos: </span>
                {analysis.impacto.datos}
              </li>
              <li>
                <span className="text-slate-500">Martingala / forecast: </span>
                {analysis.impacto.martingalaForecast}
              </li>
            </ul>
          ) : (
            <p className="text-slate-500">—</p>
          )}
        </AnalysisBlock>
        {ea ? (
          <>
            <SectionSep />
            <AnalysisBlock icon={I.estadoActual} label="ESTADO ACTUAL" tone={sectionTone}>
              <ul className="list-none space-y-1 text-slate-300/95">
                <li>
                  <span className="text-slate-500">Fase: </span>
                  {String(ea.fase ?? '—')}
                </li>
                <li>
                  <span className="text-slate-500">Tiempo transcurrido: </span>
                  {ea.tiempoTranscurridoS === '—' || ea.tiempoTranscurridoS == null ? '—' : `${ea.tiempoTranscurridoS}s`}
                </li>
                <li>
                  <span className="text-slate-500">Tiempo promedio de mesa: </span>
                  {ea.tiempoPromedioMesaS === '—' || ea.tiempoPromedioMesaS == null ? '—' : `${ea.tiempoPromedioMesaS}s`}
                </li>
                <li>
                  <span className="text-slate-500">Clasificación: </span>
                  {String(ea.clasificacion ?? '—')}
                </li>
              </ul>
            </AnalysisBlock>
          </>
        ) : null}
        <SectionSep />
        <AnalysisBlock icon={isStreamDelayExpected ? I.porqueInfo : I.porque} label="POR QUE" tone={sectionTone}>
          {porqueItems.length === 0 ? (
            <p className="text-slate-500">—</p>
          ) : (
            <ol className="list-decimal space-y-2 pl-4 text-slate-400">
              {porqueItems.map((item, i) => {
                const isObj = item != null && typeof item === 'object';
                const causa = isObj ? String(item.causa ?? '—') : String(item ?? '—');
                const explicacion = isObj ? String(item.explicacion ?? '').trim() : '';
                return (
                  <li key={i} className="pl-0.5">
                    <span className="text-slate-200/90">{causa}</span>
                    {explicacion ? <p className="mt-0.5 text-[9px] leading-snug text-slate-500">{explicacion}</p> : null}
                  </li>
                );
              })}
            </ol>
          )}
        </AnalysisBlock>
        <SectionSep />
        <AnalysisBlock icon={I.como} label="COMO" tone={sectionTone}>
          <p>{analysis.como}</p>
        </AnalysisBlock>
        <SectionSep />
        <AnalysisBlock icon={I.data} label="DATA" tone={sectionTone}>
          {isStreamDelayExpected ? (
            <p className="mb-2 rounded border border-sky-500/30 bg-sky-950/40 px-2 py-1.5 text-[9px] leading-snug text-sky-100/95">
              Datos aún no disponibles (esperando resultado)
            </p>
          ) : !dataComplete ? (
            <p className="mb-2 rounded border border-amber-500/30 bg-amber-950/35 px-2 py-1.5 text-[9px] leading-snug text-amber-100/95">
              Proveedor no envió datos completos
            </p>
          ) : null}
          <ul className="space-y-1 text-[9px] text-slate-400">
            <li>
              <span className="text-slate-500">Ganador: </span>
              {f.ganador != null ? String(f.ganador) : '—'}
            </li>
            <li>
              <span className="text-slate-500">Player: </span>
              {Array.isArray(f.cartas_player) && f.cartas_player.length ? `[${f.cartas_player.join(' ')}]` : '—'} (
              {f.puntaje_player != null ? String(f.puntaje_player) : '—'})
            </li>
            <li>
              <span className="text-slate-500">Banker: </span>
              {Array.isArray(f.cartas_banker) && f.cartas_banker.length ? `[${f.cartas_banker.join(' ')}]` : '—'} (
              {f.puntaje_banker != null ? String(f.puntaje_banker) : '—'})
            </li>
          </ul>
          {mg ? (
            <ul className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-2 text-[8px] text-slate-500">
              <li>activa: {String(mg.active ?? '—')}</li>
              <li>paso: {String(mg.contador_martingala ?? '—')}</li>
            </ul>
          ) : null}
          <details className="mt-2 rounded border border-white/[0.05] bg-black/20 p-1.5">
            <summary className="cursor-pointer font-mono text-[8px] text-slate-500">Detalle técnico (contexto + forensics)</summary>
            <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all text-[8px] text-slate-600">
              {JSON.stringify(analysis.data, null, 2)}
            </pre>
          </details>
        </AnalysisBlock>
        <SectionSep />
        <AnalysisBlock icon={I.rutaTecnica} label="RUTA TECNICA" tone={sectionTone}>
          <ol className="list-decimal space-y-0.5 pl-4 text-slate-400">
            {trace.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </AnalysisBlock>
        <SectionSep />
        <AnalysisBlock icon={I.dondeBuscar} label="DONDE BUSCAR" tone={sectionTone}>
          <ul className="list-disc space-y-0.5 pl-4 text-slate-500">
            {(analysis.dondeBuscar ?? []).map((p, i) => (
              <li key={i} className="break-all">
                {p}
              </li>
            ))}
          </ul>
        </AnalysisBlock>
        <SectionSep />
        <AnalysisBlock icon={I.recomendacion} label="RECOMENDACION" tone={sectionTone}>
          <p className={isStreamDelayExpected ? 'text-sky-100/95' : 'text-amber-100/90'}>{analysis.recomendacion}</p>
          {pasos.length > 0 ? (
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[9px] leading-snug text-slate-300">
              {pasos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          ) : null}
        </AnalysisBlock>
        {debugMode && rawPayload != null ? (
          <>
            <SectionSep />
            <details className="rounded border border-violet-500/20 bg-violet-950/20 p-2">
              <summary className="cursor-pointer font-mono text-[9px] text-violet-300/90">Payload completo (debug)</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[8px] text-slate-500">
                {JSON.stringify(rawPayload, null, 2)}
              </pre>
            </details>
          </>
        ) : null}
      </div>
    );
  },
  (prev, next) =>
    prev.analysis === next.analysis &&
    prev.rawPayload === next.rawPayload &&
    prev.debugMode === next.debugMode &&
    prev.alertType === next.alertType,
);

const AlertExpandableRow = memo(function AlertExpandableRow({ alert, onDismiss, debugMode }) {
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const copiedTimerRef = useRef(null);

  const analysis = useMemo(() => generateAlertAnalysis(alert), [alert]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current != null) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(
    async (alertArg, analysisArg) => {
      const includeRaw =
        useGpulseLabUiStore.getState().debugLogging || import.meta.env.VITE_GPULSE_LAB_DEBUG === '1';
      const text = buildAlertCopyText(alertArg, analysisArg, { includeRaw });
      let ok = false;
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          ok = true;
        } else {
          ok = fallbackCopy(text);
        }
      } catch {
        ok = fallbackCopy(text);
      }
      if (copiedTimerRef.current != null) clearTimeout(copiedTimerRef.current);
      if (ok) {
        setCopiedId(alertArg.id);
        copiedTimerRef.current = window.setTimeout(() => {
          setCopiedId(null);
          copiedTimerRef.current = null;
        }, 1200);
      }
    },
    [],
  );

  const Icon = iconForType(alert.type);
  const ts = alert.timestamp ?? alert.ts;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-lg border ${rowStylesForAlert(alert)}`}
    >
      <div className="flex gap-2 p-3">
        <Icon
          className={`mt-0.5 h-4 w-4 shrink-0 opacity-90 ${alert.type === ALERT_TYPES.STREAM_DELAY_EXPECTED ? 'text-sky-300' : ''}`}
          strokeWidth={2}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-start gap-2 text-left"
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-white/50" aria-hidden />
            ) : (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-white/50" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-white/90">{alert.type}</span>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                    alert.type === ALERT_TYPES.STREAM_DELAY_EXPECTED
                      ? 'bg-sky-900/55 text-sky-100'
                      : alert.severity === 'error'
                        ? 'bg-red-900/50 text-red-200'
                        : alert.severity === 'warning'
                          ? 'bg-amber-900/40 text-amber-200'
                          : 'bg-emerald-900/40 text-emerald-200'
                  }`}
                >
                  {severityLabel(alert.severity)}
                </span>
                <span className="font-mono text-[9px] text-white/50">{formatTime(ts)}</span>
              </div>
              <p className="mt-1 font-mono text-[11px] leading-snug text-white/85">{alert.message}</p>
              <p className="mt-1 font-mono text-[9px] text-white/45">
                mesa {alert.mesa != null ? String(alert.mesa) : '—'} · round {alert.round != null ? String(alert.round) : '—'}
              </p>
            </div>
          </button>

          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                key="analysis"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="pb-1 pr-1 pt-3">
                  <AlertAnalysisBody analysis={analysis} rawPayload={alert.rawPayload} debugMode={debugMode} alertType={alert.type} />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 self-start">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                useGpulseLabUiStore.getState().openCycleReplay({
                  mesaId: alert.mesa != null ? String(alert.mesa) : null,
                });
              }}
              className="rounded p-1 text-white/40 hover:bg-amber-500/15 hover:text-amber-200/95"
              aria-label="Replay de ciclo"
              title="Replay de ciclo"
            >
              <span className="font-mono text-[11px] leading-none" aria-hidden>
                🎥
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                useGpulseLabUiStore.getState().openCycleXRay({
                  correlationKey: alert.context?.correlationKey != null ? String(alert.context.correlationKey) : null,
                  mesaId: alert.mesa != null ? String(alert.mesa) : null,
                  alertId: alert.id,
                });
              }}
              className="rounded p-1 text-white/40 hover:bg-cyan-500/15 hover:text-cyan-200/95"
              aria-label="Abrir Cycle X-Ray"
              title="Cycle X-Ray"
            >
              <span className="font-mono text-[11px] leading-none" aria-hidden>
                🔬
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleCopy(alert, analysis);
              }}
              className="ml-2 rounded p-1 text-white/40 hover:bg-white/10 hover:text-cyan-200/95"
              aria-label="Copiar análisis completo"
              title="Copiar análisis completo"
            >
              <Copy size={14} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(alert.id);
              }}
              className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/90"
              aria-label="Descartar alerta"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
          {copiedId === alert.id ? (
            <span className="max-w-[11rem] text-right font-mono text-[9px] leading-tight text-emerald-300/95" role="status">
              Copiado ✅
            </span>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
});

/**
 * @param {{ embedded?: boolean }} p
 */
export default function AlertPanel({ embedded = false }) {
  const alerts = useAlertStore((s) => s.alerts);
  const dismissAlert = useAlertStore((s) => s.dismissAlert);
  const debugLogging = useGpulseLabUiStore((s) => s.debugLogging);
  const labDebugUi = debugLogging || VITE_GPULSE_LAB_DEBUG;

  const [mesaFilter, setMesaFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [expanded, setExpanded] = useState(true);

  const scrollRef = useRef(null);

  const mesaOptions = useMemo(() => {
    const s = new Set();
    alerts.forEach((a) => {
      if (a.mesa != null && String(a.mesa).trim() !== '') s.add(String(a.mesa));
    });
    return [...s].sort();
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
      if (mesaFilter.trim() === '') return true;
      return String(a.mesa ?? '').toLowerCase() === mesaFilter.trim().toLowerCase();
    });
  }, [alerts, mesaFilter, severityFilter]);

  const latestId = alerts[0]?.id;

  useEffect(() => {
    if (!expanded || latestId == null) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [latestId, expanded, filtered.length]);

  const shell = embedded
    ? 'rounded-xl border border-rose-500/25 bg-gradient-to-br from-zinc-950/90 via-black/85 to-rose-950/15 ring-1 ring-white/[0.06]'
    : 'mb-4 rounded-xl border border-rose-500/20 bg-gradient-to-br from-zinc-950/95 via-black/85 to-rose-950/15 shadow-lg shadow-black/35 ring-1 ring-white/[0.05] sm:p-5';

  return (
    <section className={shell} aria-label="Alertas inteligentes">
      <div
        className={`flex flex-col gap-3 border-b border-white/[0.08] pb-3 sm:flex-row sm:items-center sm:justify-between ${embedded ? 'p-3' : 'p-4'}`}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex flex-wrap items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-rose-300/90 transition-transform ${expanded ? '' : '-rotate-90'}`}
            aria-hidden
          />
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200/95">Alertas</h2>
          <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full border border-rose-500/40 bg-rose-950/50 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-rose-200">
            {alerts.length}
          </span>
          <span className="font-mono text-[9px] text-slate-500">
            mostrando {filtered.length}
            {(mesaFilter || severityFilter !== 'all') && ` (filtro)`}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2 pl-7 sm:pl-0">
          <select
            value={mesaFilter}
            onChange={(e) => setMesaFilter(e.target.value)}
            className="rounded-lg border border-white/[0.12] bg-black/40 px-2 py-1.5 font-mono text-[10px] text-slate-300"
            aria-label="Filtrar por mesa"
          >
            <option value="">Todas las mesas</option>
            {mesaOptions.map((m) => (
              <option key={m} value={m}>
                Mesa {m}
              </option>
            ))}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-white/[0.12] bg-black/40 px-2 py-1.5 font-mono text-[10px] text-slate-300"
            aria-label="Filtrar por severidad"
          >
            <option value="all">Todas severidades</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="error">error</option>
          </select>
          <button
            type="button"
            onClick={() => clearAlerts()}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 font-mono text-[10px] font-medium text-slate-300 hover:bg-white/[0.1]"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Clear
          </button>
        </div>
      </div>

      {expanded ? (
        <div
          ref={scrollRef}
          className={`space-y-2 overflow-y-auto pr-1 pt-1 ${embedded ? 'max-h-[min(40vh,360px)] px-3 pb-3' : 'max-h-[min(52vh,480px)] px-4 pb-4'}`}
        >
          {filtered.length === 0 ? (
            <p className="py-6 text-center font-mono text-xs text-slate-600">Sin alertas en este filtro.</p>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((a) => (
                <AlertExpandableRow key={a.id} alert={a} onDismiss={dismissAlert} debugMode={labDebugUi} />
              ))}
            </AnimatePresence>
          )}
        </div>
      ) : null}
    </section>
  );
}
