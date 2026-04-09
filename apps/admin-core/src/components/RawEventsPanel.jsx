import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Copy, Trash2, XCircle } from 'lucide-react';
import { subscribeAdminSignalsLive } from '../realtime/adminSignalsLiveStore.js';
import { clearRawEvents, getRawStats, subscribe } from '../store/rawEventsStore.js';
import { useGpulseLabUiStore } from '../gpulse-lab/store/useGpulseLabUiStore.js';
import { buildAnalysisCopyText, fallbackCopy } from '../gpulse-lab/utils/buildAlertCopyText.js';
import { ALERT_SECTION_ICONS } from '../gpulse-lab/utils/alertAnalysisPresentation.js';
import { generateEventAnalysis } from '../gpulse-lab/utils/generateEventAnalysis.js';

const PREVIEW_MAX = 520;
const EVENT_ROWS = 20;

/** @param {unknown} obj */
function previewJson(obj) {
  try {
    const s = JSON.stringify(obj);
    return s.length > PREVIEW_MAX ? `${s.slice(0, PREVIEW_MAX)}…` : s;
  } catch {
    return String(obj).slice(0, PREVIEW_MAX);
  }
}

/** @param {string} type */
function typeAccent(type) {
  let h = 0;
  for (let i = 0; i < type.length; i += 1) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return {
    border: `hsl(${hue} 65% 42% / 0.85)`,
    bg: `hsl(${hue} 45% 12% / 0.35)`,
    text: `hsl(${hue} 80% 78%)`,
  };
}

const RawEventRow = memo(function RawEventRow({
  row,
  idx,
  openKey,
  selectedKey,
  copiedKey,
  setOpenKey,
  setSelectedKey,
  onCopy,
  debugMode,
}) {
  const a = typeAccent(row.type);
  const I = ALERT_SECTION_ICONS;
  const key = `${row.receivedAt ?? 0}-${row.eventName}-${idx}-${row.type}`;
  const isOpen = openKey === key;
  const isSelected = selectedKey === key;

  const analysis = useMemo(() => generateEventAnalysis(row), [row]);

  return (
    <li key={key}>
      <motion.div
        layout
        className={`px-3 py-2.5 text-[11px] ${isSelected ? 'bg-white/[0.03]' : ''}`}
        style={{ borderLeft: `3px solid ${a.border}` }}
      >
        <button
          type="button"
          onClick={() => {
            setSelectedKey(key);
            setOpenKey((prev) => (prev === key ? null : key));
          }}
          className="flex w-full gap-3 text-left"
          aria-expanded={isOpen}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-white">{row.eventName}</span>
              <span className="rounded px-1.5 py-0.5 font-mono text-[10px]" style={{ color: a.text, backgroundColor: a.bg }}>
                {row.type}
              </span>
              {copiedKey === key ? <span className="ml-2 font-mono text-[9px] text-emerald-300/95">Copiado ✅</span> : null}
            </div>
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-black/30 p-2 font-mono text-[10px] text-slate-300">
              {previewJson(row.payload)}
            </pre>
          </div>

          <div className="flex shrink-0 items-start gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void onCopy(row, analysis, key);
              }}
              className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-cyan-200/95"
              title="Copiar análisis completo"
              aria-label="Copiar análisis completo"
            >
              <Copy size={14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedKey(key);
                setOpenKey((prev) => (prev === key ? null : key));
              }}
              className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/90"
              title={isOpen ? 'Colapsar' : 'Expandir'}
              aria-label={isOpen ? 'Colapsar' : 'Expandir'}
            >
              <XCircle className="h-4 w-4 opacity-60" aria-hidden />
            </button>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.div
              key="detail"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2 rounded-lg border border-white/[0.06] bg-black/25 p-3">
                <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  {I.que} [QUE]
                </p>
                <p className="font-mono text-[11px] text-slate-200">{analysis.que}</p>

                <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  {I.cuando} [CUANDO]
                </p>
                <p className="font-mono text-[10px] text-slate-300">{analysis.cuando}</p>

                <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  {I.donde} [DONDE]
                </p>
                <p className="font-mono text-[10px] text-slate-300">
                  {analysis.donde?.summary ?? `Mesa ${analysis.donde?.mesa ?? '—'} · Round ${analysis.donde?.round ?? '—'}`}
                </p>

                <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">👤 [QUIEN]</p>
                <p className="font-mono text-[10px] text-slate-300">{analysis.quien ?? '—'}</p>

                <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  {I.porque} [POR QUE]
                </p>
                <ol className="list-decimal space-y-1 pl-4 font-mono text-[10px] text-slate-300">
                  {(analysis.porqueItems ?? analysis.porque ?? []).slice(0, 6).map((x, i2) => (
                    <li key={i2}>
                      {typeof x === 'string' ? x : `${x.causa ?? '—'}${x.explicacion ? ` — ${x.explicacion}` : ''}`}
                    </li>
                  ))}
                </ol>

                <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  {I.como} [COMO]
                </p>
                <p className="font-mono text-[10px] text-slate-300">{analysis.como}</p>

                <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  {I.data} [DATA]
                </p>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-black/30 p-2 font-mono text-[9px] text-slate-400">
                  {JSON.stringify(analysis.data, null, 2)}
                </pre>

                <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  {I.rutaTecnica} [RUTA TECNICA]
                </p>
                <p className="font-mono text-[10px] text-slate-300">{(analysis.rutaTecnica ?? []).join(' → ') || '—'}</p>

                <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  {I.recomendacion} [RECOMENDACION]
                </p>
                <p className="font-mono text-[10px] text-amber-100/90">{analysis.recomendacion}</p>

                {debugMode ? (
                  <details className="mt-2 rounded border border-violet-500/20 bg-violet-950/20 p-2">
                    <summary className="cursor-pointer font-mono text-[9px] text-violet-300/90">Raw JSON (debug)</summary>
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all font-mono text-[8px] text-slate-500">
                      {JSON.stringify(row.payload, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </li>
  );
});

function RawEventsPanelInner() {
  const [stats, setStats] = useState(() => getRawStats());
  const listRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const debugLogging = useGpulseLabUiStore((s) => s.debugLogging);
  const debugMode = debugLogging || import.meta.env.VITE_GPULSE_LAB_DEBUG === '1';

  const [openKey, setOpenKey] = useState(/** @type {string | null} */ (null));
  const [selectedKey, setSelectedKey] = useState(/** @type {string | null} */ (null));
  const [copiedKey, setCopiedKey] = useState(/** @type {string | null} */ (null));
  const copiedTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  useEffect(() => {
    return subscribeAdminSignalsLive(() => {});
  }, []);

  useEffect(() => {
    return subscribe(() => setStats(getRawStats()));
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [stats.events]);

  const onClear = useCallback(() => {
    clearRawEvents();
  }, []);

  const { counters, events } = stats;
  const recent = events.slice(0, EVENT_ROWS);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current != null) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(
    async (row, analysis, key) => {
      const text = buildAnalysisCopyText(
        {
          type: row?.eventName ?? row?.type ?? 'UNKNOWN',
          mesa: analysis?.donde?.mesa ?? null,
          round: analysis?.donde?.round ?? null,
          severity: 'info',
          timestamp: row?.receivedAt,
          rawPayload: row?.payload,
        },
        analysis,
        { includeRaw: debugMode },
      );
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
      if (!ok) return;
      if (copiedTimerRef.current != null) clearTimeout(copiedTimerRef.current);
      setCopiedKey(key);
      copiedTimerRef.current = setTimeout(() => {
        copiedTimerRef.current = null;
        setCopiedKey(null);
      }, 1200);
    },
    [debugMode],
  );

  return (
    <div className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-slate-950/90 to-cyan-950/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-cyan-400" aria-hidden />
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/90">
            🧠 Monitor de eventos
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-rose-400/40 hover:bg-rose-950/30 hover:text-rose-100"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Limpiar
        </button>
      </div>

      <p className="mt-1 text-[11px] text-slate-500">
        Todos los eventos del socket (sin filtrar). Últimos {EVENT_ROWS} en lista; buffer interno 100.
      </p>

      <div className="mt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Contadores</p>
        <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
          {Object.entries(counters).length === 0 ? (
            <span className="text-xs text-slate-600">Sin eventos aún.</span>
          ) : (
            Object.entries(counters).map(([key, value]) => {
              const a = typeAccent(key);
              return (
                <div
                  key={key}
                  className="counter flex min-w-[7rem] items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px]"
                  style={{ borderColor: a.border, backgroundColor: a.bg }}
                >
                  <span className="truncate font-mono text-slate-200" title={key}>
                    {key}
                  </span>
                  <strong className="shrink-0 tabular-nums" style={{ color: a.text }}>
                    {value}
                  </strong>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Eventos recientes
        </p>
        <div
          ref={listRef}
          className="mt-2 max-h-80 overflow-y-auto overflow-x-hidden rounded-xl border border-white/5 bg-slate-950/50"
        >
          {recent.length === 0 ? (
            <p className="p-4 text-xs text-slate-600">Esperando tráfico…</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {recent.map((row, idx) => (
                <RawEventRow
                  key={`${row.receivedAt ?? 0}-${row.eventName}-${idx}-${row.type}`}
                  row={row}
                  idx={idx}
                  openKey={openKey}
                  selectedKey={selectedKey}
                  copiedKey={copiedKey}
                  setOpenKey={setOpenKey}
                  setSelectedKey={setSelectedKey}
                  onCopy={handleCopy}
                  debugMode={debugMode}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export const RawEventsPanel = memo(RawEventsPanelInner);
RawEventsPanel.displayName = 'RawEventsPanel';
