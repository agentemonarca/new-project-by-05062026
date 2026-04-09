import React, { useMemo } from 'react';
import { classifyProviderLabel, useControlCenterStore } from '../store/useControlCenterStore.js';

function TrendArrow({ trend }) {
  if (trend === 'up') return <span className="text-emerald-400">↑</span>;
  if (trend === 'down') return <span className="text-rose-400">↓</span>;
  return <span className="text-slate-600">→</span>;
}

/**
 * @param {{ mesaId: string }} p
 */
export default function ProviderScoreCard({ mesaId }) {
  const st = useControlCenterStore((s) => s.perMesa[mesaId]);

  const { score, label, completeness, last10 } = useMemo(() => {
    const total = st?.totalCycles ?? 0;
    const inc = st?.incompleteCycles ?? 0;
    const completeness = total > 0 ? Math.round(100 * (1 - inc / total)) : 100;
    return {
      score: typeof st?.score === 'number' ? st.score : 100,
      label: classifyProviderLabel(typeof st?.score === 'number' ? st.score : 100),
      completeness,
      last10: Array.isArray(st?.last10) ? st.last10 : [],
    };
  }, [st]);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/35 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">Mesa</p>
          <p className="font-mono text-sm font-bold text-white">{mesaId}</p>
        </div>
        <div className="text-right">
          <span className="font-mono text-2xl font-bold tabular-nums text-white">{score}</span>
          <span className="ml-1 font-mono text-[10px] text-slate-500">/100</span>
          <div className="mt-0.5 flex items-center justify-end gap-1 font-mono text-[10px] text-slate-400">
            <TrendArrow trend={st?.trend} />
            <span>
              {label.emoji} {label.label}
            </span>
          </div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[9px] text-slate-400">
        <dt className="text-slate-600">Data OK</dt>
        <dd className="text-right text-slate-300">{completeness}%</dd>
        <dt className="text-slate-600">Avg delay</dt>
        <dd className="text-right text-slate-300">
          {st?.avgDelayMs != null ? `${(st.avgDelayMs / 1000).toFixed(1)}s` : '—'}
        </dd>
        <dt className="text-slate-600">Resync / TO</dt>
        <dd className="text-right text-slate-300">
          {st?.resyncCount ?? 0} / {st?.timeoutCount ?? 0}
        </dd>
      </dl>
      <div className="mt-3 border-t border-white/[0.06] pt-2">
        <p className="font-mono text-[8px] uppercase tracking-wider text-slate-600">Últimos 10 ciclos</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {last10.length === 0 ? (
            <span className="font-mono text-[9px] text-slate-600">—</span>
          ) : (
            last10.map((c, i) => {
              const ok = c.uiStatus === 'COMPLETE' || c.uiStatus === 'COMPLETE_RESYNC';
              return (
                <span
                  key={`${c.at}-${i}`}
                  title={`${c.uiStatus} · ${c.delayMsLab != null ? `${c.delayMsLab}ms` : '—'}`}
                  className={`rounded px-1.5 py-0.5 font-mono text-[8px] ${
                    ok
                      ? 'bg-emerald-900/40 text-emerald-200'
                      : c.labTimeout
                        ? 'bg-amber-900/45 text-amber-200'
                        : 'bg-rose-900/40 text-rose-200'
                  }`}
                >
                  {ok ? '✓' : c.labTimeout ? '⏱' : '!'}
                </span>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
