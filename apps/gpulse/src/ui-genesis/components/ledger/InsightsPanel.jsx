import React, { memo, useMemo } from 'react';
import { useCore } from '../../core/CoreContext.jsx';
import { useLedger } from '../../ledger/LedgerContext.jsx';
import { buildLedgerInsights } from '../../ledger/insightsEngine.js';

function toneClass(severity) {
  if (severity === 'warn') return 'border-amber-500/30 bg-amber-500/10 text-amber-100/95';
  if (severity === 'positive') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100/95';
  return 'border-white/10 bg-white/[0.04] text-slate-200';
}

function InsightsPanelInner() {
  const core = useCore();
  const { events } = useLedger();

  const insights = useMemo(() => buildLedgerInsights(core, events), [core, events]);

  return (
    <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/20 to-slate-950/60 p-5">
      <h3 className="font-display text-sm font-semibold text-white">Insights</h3>
      <p className="mt-1 text-[11px] text-slate-500">Derived from CoreContext + recent ledger rows (no duplicate rate math).</p>
      <ul className="mt-4 space-y-2">
        {insights.map((row) => (
          <li
            key={row.id}
            className={`rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${toneClass(row.severity)}`}
          >
            {row.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const InsightsPanel = memo(InsightsPanelInner);
