import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Brain, Trash2 } from 'lucide-react';
import { clearRawEvents, getRawStats, subscribe } from '@/ui-genesis/stores/rawEventsStore.js';

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

function RawEventsPanelInner() {
  const [stats, setStats] = useState(() => getRawStats());
  const listRef = useRef(/** @type {HTMLDivElement | null} */ (null));

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
        Todos los eventos del socket BFF/directo (sin filtrar). Últimos {EVENT_ROWS} en lista; buffer 50.
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
              {recent.map((row, idx) => {
                const a = typeAccent(row.type);
                return (
                  <li
                    key={`${row.eventName}-${idx}-${row.type}`}
                    className="flex gap-3 px-3 py-2.5 text-[11px]"
                    style={{ borderLeft: `3px solid ${a.border}` }}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-white">{row.eventName}</span>
                        <span
                          className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                          style={{ color: a.text, backgroundColor: a.bg }}
                        >
                          {row.type}
                        </span>
                      </div>
                      <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-black/30 p-2 font-mono text-[10px] text-slate-300">
                        {previewJson(row.payload)}
                      </pre>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export const RawEventsPanel = memo(RawEventsPanelInner);
RawEventsPanel.displayName = 'RawEventsPanel';
