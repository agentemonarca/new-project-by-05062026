import React, { useMemo, useState } from 'react';
import { classifyHeatmapLevel, useControlCenterStore } from '../store/useControlCenterStore.js';
import { useLabStore } from '../store/useLabStore.js';

function heatmapTone(level) {
  if (level === 'LOW') return 'bg-emerald-500/35 border-emerald-400/50 ring-emerald-500/20';
  if (level === 'MEDIUM') return 'bg-amber-500/35 border-amber-400/50 ring-amber-500/25';
  return 'bg-rose-500/40 border-rose-400/55 ring-rose-500/25';
}

function Tooltip({ children, lines }) {
  const [on, setOn] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}
      onFocus={() => setOn(true)}
      onBlur={() => setOn(false)}
    >
      {children}
      {on ? (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-hud mb-2 w-[min(240px,70vw)] -translate-x-1/2 rounded-lg border border-white/15 bg-zinc-950/98 px-3 py-2 font-mono text-[9px] leading-relaxed text-slate-200 shadow-xl">
          {lines.map((l, i) => (
            <p key={i} className={i > 0 ? 'mt-1' : ''}>
              {l}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function HeatmapPanel() {
  const mesas = useLabStore((s) => s.mesas);
  const perMesa = useControlCenterStore((s) => s.perMesa);

  const ids = useMemo(() => {
    const u = new Set([...Object.keys(mesas), ...Object.keys(perMesa)]);
    return [...u].sort();
  }, [mesas, perMesa]);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-900/70 p-4">
      <h3 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-400/95">
        🌡️ Error heatmap · mesa
      </h3>
      {ids.length === 0 ? (
        <p className="font-mono text-[10px] text-slate-500">Sin mesas aún.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {ids.map((id) => {
            const st = perMesa[id];
            const total = st?.totalCycles ?? 0;
            const inc = st?.incompleteCycles ?? 0;
            const to = st?.timeoutCount ?? 0;
            const err = total > 0 ? (inc + to) / total : 0;
            const level = total > 0 ? classifyHeatmapLevel(err) : 'LOW';
            const avg = st?.avgDelayMs;
            const pct = total > 0 ? (err * 100).toFixed(1) : '0';
            const lines = [
              `Mesa ${id}`,
              `avg delay: ${avg != null ? `${(avg / 1000).toFixed(1)}s` : '—'}`,
              `error %: ${pct}% (incomplete+timeouts / total)`,
              `resyncs: ${st?.resyncCount ?? 0}`,
              `último: ${st?.lastIssue ?? '—'}`,
            ];
            return (
              <Tooltip key={id} lines={lines}>
                <div
                  className={`flex min-h-[72px] flex-col justify-center rounded-lg border px-2 py-2 text-center ring-1 transition hover:brightness-110 ${heatmapTone(level)}`}
                >
                  <span className="font-mono text-[10px] font-semibold text-white/95">{id}</span>
                  <span className="mt-1 font-mono text-[9px] text-white/75">{total} ciclos</span>
                  <span className="font-mono text-[9px] text-white/60">{pct}% err</span>
                </div>
              </Tooltip>
            );
          })}
        </div>
      )}
      <p className="mt-3 font-mono text-[8px] text-slate-600">
        &lt;5% estable · 5–15% atención · &gt;15% problemático
      </p>
    </div>
  );
}
