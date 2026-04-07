import { memo } from 'react';
import { Crosshair, TrendingUp } from 'lucide-react';
import { asCounterRecord, sortedCounterEntries } from './counterHelpers.js';

const TYPE_COLORS = {
  DIRECT_ENTRY: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-200',
  RECOVERY: 'border-amber-400/25 bg-amber-500/5 text-amber-100',
  HIGH_RISK: 'border-rose-500/25 bg-rose-500/5 text-rose-100',
  sin_señal: 'border-slate-500/20 bg-slate-900/50 text-slate-400',
};

/**
 * @param {{ latestCounters: Record<string, unknown> | null }}
 */
function SignalTypesSectionInner({ latestCounters }) {
  const signalTipos = asCounterRecord(latestCounters?.signalTipos);
  const entries = sortedCounterEntries(signalTipos);

  return (
    <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-b from-slate-950/90 to-slate-950/40 p-4 shadow-[0_0_24px_rgba(139,92,246,0.07)]">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/35 bg-violet-500/10">
          <Crosshair className="h-5 w-5 text-violet-300" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold tracking-tight text-white">SEÑALES</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Clasificación por decisión / martingala (<span className="text-violet-200/80">motor relay</span>).
          </p>
        </div>
        <TrendingUp className="mt-1 hidden h-4 w-4 shrink-0 text-violet-500/50 sm:block" aria-hidden />
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-600">Sin tipos acumulados. Llegan con <code className="text-slate-500">NEW_SIGNAL</code> relay.</p>
      ) : (
        <div className="max-h-40 overflow-y-auto overscroll-contain scroll-smooth pr-1">
          <ul className="grid gap-2 sm:grid-cols-2">
            {entries.map(([tipo, count]) => (
              <li
                key={tipo}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${TYPE_COLORS[tipo] ?? 'border-white/10 bg-slate-900/40 text-slate-300'}`}
              >
                <span className="truncate text-[11px] font-medium">{tipo}</span>
                <span className="shrink-0 rounded-md bg-black/25 px-2 py-0.5 text-xs font-semibold tabular-nums">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export const SignalTypesSection = memo(SignalTypesSectionInner);
SignalTypesSection.displayName = 'SignalTypesSection';
