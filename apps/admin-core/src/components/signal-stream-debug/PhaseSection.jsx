import { memo } from 'react';
import { Orbit, Zap } from 'lucide-react';
import { asCounterRecord, sortedCounterEntries } from './counterHelpers.js';

const FASE_COLORS = {
  OBSERVE: 'border-slate-500/25 bg-slate-800/40 text-slate-200',
  PREPARE: 'border-indigo-500/25 bg-indigo-500/5 text-indigo-100',
  EXECUTE: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-100',
  RECOVER: 'border-orange-500/25 bg-orange-500/5 text-orange-100',
  STABILIZE: 'border-teal-500/25 bg-teal-500/5 text-teal-100',
  ALERT: 'border-rose-500/35 bg-rose-500/10 text-rose-100',
};

/**
 * @param {{ latestCounters: Record<string, unknown> | null }}
 */
function PhaseSectionInner({ latestCounters }) {
  const fases = asCounterRecord(latestCounters?.fases);
  const entries = sortedCounterEntries(fases);

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-slate-950/90 to-slate-950/40 p-4 shadow-[0_0_24px_rgba(52,211,153,0.06)]">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/10">
          <Orbit className="h-5 w-5 text-emerald-300" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold tracking-tight text-white">FASE</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Lógica GPulse priorizada (<span className="text-emerald-200/80">ALERT &gt; STABILIZE &gt; RECOVER…</span>).
          </p>
        </div>
        <Zap className="mt-1 hidden h-4 w-4 shrink-0 text-emerald-500/45 sm:block" aria-hidden />
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-600">Sin fases acumuladas todavía.</p>
      ) : (
        <div className="max-h-40 overflow-y-auto overscroll-contain scroll-smooth pr-1">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map(([fase, count]) => (
              <li
                key={fase}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${FASE_COLORS[fase] ?? 'border-white/10 bg-slate-900/40 text-slate-300'}`}
              >
                <span className="truncate text-[11px] font-semibold tracking-wide">{fase}</span>
                <span className="shrink-0 rounded-md bg-black/20 px-2 py-0.5 text-xs font-semibold tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export const PhaseSection = memo(PhaseSectionInner);
PhaseSection.displayName = 'PhaseSection';
