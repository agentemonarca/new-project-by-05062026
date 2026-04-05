import React, { memo, useMemo } from 'react';
import { useCore } from '../../core/CoreContext.jsx';
import { compareMiningCores, compareModules } from '../../ledger/compareEngine.js';

function ComparePanelInner() {
  const { cores } = useCore();

  const mining = useMemo(() => compareMiningCores(cores), [cores]);
  const modules = useMemo(() => compareModules(cores), [cores]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/50 p-5">
        <h3 className="font-display text-sm font-semibold text-white">Module rate mix</h3>
        <p className="mt-1 text-[11px] text-slate-500">Share of active USDT/s by engine type (from cores).</p>
        <ul className="mt-4 space-y-3">
          {(['mining', 'booster', 'staking']).map((key) => (
            <li key={key} className="flex items-center justify-between gap-2 text-xs">
              <span className="capitalize text-slate-400">{key}</span>
              <span className="font-mono text-cyan-200">
                {modules[key].contributionPercent.toFixed(1)}% · {modules[key].rate.toExponential(2)} /s
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-violet-500/20 bg-slate-950/50 p-5">
        <h3 className="font-display text-sm font-semibold text-white">Mining cores</h3>
        <p className="mt-1 text-[11px] text-slate-500">Contribution % within mining lane only.</p>
        {mining.items.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">No active mining cores.</p>
        ) : (
          <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto pr-1">
            {mining.items.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px]"
              >
                <span className="truncate font-mono text-slate-400">{row.id}</span>
                <span className="shrink-0 font-mono text-fuchsia-200">{row.contributionPercent.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export const ComparePanel = memo(ComparePanelInner);
