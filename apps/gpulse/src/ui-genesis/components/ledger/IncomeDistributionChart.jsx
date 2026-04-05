import React, { memo, useMemo } from 'react';

/**
 * @param {{ rows: Array<{ category: string, usdt: number, aig: number }> }} props
 */
function IncomeDistributionChartInner({ rows }) {
  const maxVal = useMemo(() => {
    let m = 1e-9;
    for (const r of rows) {
      m = Math.max(m, r.usdt + r.aig * 0.12);
    }
    return m;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40 text-xs text-slate-500">
        No amount data for distribution.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-slate-950/50 p-4">
      <h4 className="font-display text-xs font-semibold text-white">Income by category</h4>
      <p className="mt-0.5 text-[10px] text-slate-500">USDT + AIG (AIG scaled for bar width)</p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => {
          const total = r.usdt + r.aig * 0.12;
          const w = Math.min(100, (total / maxVal) * 100);
          const uPct = total > 1e-12 ? (r.usdt / total) * 100 : 50;
          return (
            <li key={r.category}>
              <div className="mb-1 flex justify-between text-[10px] uppercase text-slate-400">
                <span>{r.category}</span>
                <span className="font-mono text-slate-500">
                  {r.usdt.toFixed(2)} USDT · {r.aig.toFixed(1)} AIG
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${w}%`,
                    background: `linear-gradient(to right, rgb(34,211,238) 0%, rgb(34,211,238) ${uPct}%, rgb(192,38,211) ${uPct}%, rgb(192,38,211) 100%)`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[9px] text-slate-600">Bars reflect ledger-recorded flows, not live yield.</p>
    </div>
  );
}

export const IncomeDistributionChart = memo(IncomeDistributionChartInner);
