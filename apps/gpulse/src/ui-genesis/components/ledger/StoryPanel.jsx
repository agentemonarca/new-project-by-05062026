import React, { memo, useMemo } from 'react';
import { useCore } from '../../core/CoreContext.jsx';
import { useLedger } from '../../ledger/LedgerContext.jsx';
import { buildUserStory } from '../../ledger/storyEngine.js';
import { calculateLiveDelta } from '../../ledger/liveDeltaEngine.js';
import { calculateUserScore } from '../../ledger/userScoreEngine.js';

function StoryPanelInner() {
  const core = useCore();
  const { events } = useLedger();

  const story = useMemo(() => buildUserStory(core, events), [core, events]);
  const delta = useMemo(() => calculateLiveDelta(events), [events]);
  const { score, level } = useMemo(() => calculateUserScore(core), [core]);

  const trendColor =
    delta.trend7d === 'up' ? 'text-emerald-300' : delta.trend7d === 'down' ? 'text-amber-300' : 'text-slate-400';

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-violet-950/20 to-cyan-950/20 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">User intelligence</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-white">Your protocol story</h3>
        </div>
        <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200/90">Score</p>
          <p className="font-display text-2xl font-bold tabular-nums text-white">{score}</p>
          <p className="text-[10px] font-medium text-fuchsia-200/80">{level}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/25 p-4 lg:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Summary</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{story.summary}</p>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Highlight</p>
          <p className="mt-1 text-xs leading-relaxed text-cyan-100/90">{story.highlight}</p>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase text-slate-500">24h vs prior</p>
            <p className="mt-1 font-mono text-xs text-emerald-100/95">
              USDT Δ {delta.delta24h.usdt >= 0 ? '+' : ''}
              {delta.delta24h.usdt.toFixed(2)}
              {delta.delta24h.usdtPercent != null ? ` (${delta.delta24h.usdtPercent >= 0 ? '+' : ''}${delta.delta24h.usdtPercent.toFixed(0)}%)` : ''}
            </p>
            <p className="mt-0.5 font-mono text-xs text-emerald-200/80">
              AIG Δ {delta.delta24h.aig >= 0 ? '+' : ''}
              {delta.delta24h.aig.toFixed(1)}
              {delta.delta24h.aigPercent != null ? ` (${delta.delta24h.aigPercent >= 0 ? '+' : ''}${delta.delta24h.aigPercent.toFixed(0)}%)` : ''}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] font-semibold uppercase text-slate-500">7d trend</p>
            <p className={`mt-1 text-sm font-semibold capitalize ${trendColor}`}>{delta.trend7d}</p>
          </div>
          {story.warning ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100/95">
              <span className="font-semibold">Warning · </span>
              {story.warning}
            </div>
          ) : null}
          {story.opportunity ? (
            <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-xs text-cyan-100/95">
              <span className="font-semibold">Opportunity · </span>
              {story.opportunity}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const StoryPanel = memo(StoryPanelInner);
