import React, { memo, useMemo } from 'react';

/** @param {{ series: Array<{ dayKey: string, dayLabel: string, usdt: number, aig: number }> }} props */
function GrowthChartInner({ series }) {
  const { maxUsdt, maxAig } = useMemo(() => {
    let u = 1e-9;
    let a = 1e-9;
    for (const d of series) {
      u = Math.max(u, d.usdt);
      a = Math.max(a, d.aig);
    }
    return { maxUsdt: u, maxAig: a };
  }, [series]);

  const h = 120;

  return (
    <div className="rounded-xl border border-violet-500/20 bg-slate-950/50 p-4">
      <h4 className="font-display text-xs font-semibold text-white">7-day growth</h4>
      <p className="mt-0.5 text-[10px] text-slate-500">Daily USDT vs AIG (normalized per axis)</p>
      <div className="mt-2 flex items-end justify-between gap-1" style={{ height: h }}>
        {series.map((d) => (
          <div key={d.dayKey} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end justify-center gap-0.5" style={{ height: h - 28 }}>
              <div
                className="w-[42%] max-w-[14px] rounded-t-sm bg-gradient-to-t from-cyan-600 to-cyan-400/90"
                style={{ height: `${Math.max(4, (d.usdt / maxUsdt) * (h - 36))}px` }}
                title={`${d.dayLabel} · ${d.usdt.toFixed(2)} USDT`}
              />
              <div
                className="w-[42%] max-w-[14px] rounded-t-sm bg-gradient-to-t from-fuchsia-700 to-fuchsia-400/90"
                style={{ height: `${Math.max(4, (d.aig / maxAig) * (h - 36))}px` }}
                title={`${d.dayLabel} · ${d.aig.toFixed(1)} AIG`}
              />
            </div>
            <span className="max-w-full truncate text-center font-mono text-[8px] text-slate-500">{d.dayLabel}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[9px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-cyan-500" /> USDT
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-fuchsia-500" /> AIG
        </span>
      </div>
    </div>
  );
}

export const GrowthChart = memo(GrowthChartInner);
