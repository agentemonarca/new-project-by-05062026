import { memo } from 'react';
import { Eye, ShieldAlert } from 'lucide-react';
import { asCounterRecord, sortedCounterEntries } from './counterHelpers.js';

const VIG_COLORS = {
  PENDING: 'border-sky-500/25 bg-sky-500/5 text-sky-200',
  ACTIVE: 'border-blue-500/25 bg-blue-500/5 text-blue-200',
  WON: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  LOST: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
  TIE: 'border-amber-500/25 bg-amber-500/5 text-amber-100',
  N_A: 'border-slate-500/20 bg-slate-900/50 text-slate-400',
};

/**
 * @param {{ latestCounters: Record<string, unknown> | null }}
 */
function VigilanceSectionInner({ latestCounters }) {
  const vigilancia = asCounterRecord(latestCounters?.vigilancia);
  const entries = sortedCounterEntries(vigilancia);

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-slate-950/90 to-slate-950/40 p-4 shadow-[0_0_24px_rgba(245,158,11,0.06)]">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10">
          <Eye className="h-5 w-5 text-amber-200" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold tracking-tight text-white">ESTADO · VIGILANCIA</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Estado de la señal respecto al resultado (<span className="text-amber-200/80">PENDING → ACTIVE → WON | LOST | TIE</span>).
          </p>
        </div>
        <ShieldAlert className="mt-1 hidden h-4 w-4 shrink-0 text-amber-500/45 sm:block" aria-hidden />
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-600">Sin estados acumulados todavía.</p>
      ) : (
        <div className="max-h-40 overflow-y-auto overscroll-contain scroll-smooth pr-1">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map(([estado, count]) => (
              <li
                key={estado}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${VIG_COLORS[estado] ?? 'border-white/10 bg-slate-900/40 text-slate-300'}`}
              >
                <span className="truncate text-[11px] font-medium">{estado}</span>
                <span className="shrink-0 rounded-md bg-black/20 px-2 py-0.5 text-xs font-semibold tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export const VigilanceSection = memo(VigilanceSectionInner);
VigilanceSection.displayName = 'VigilanceSection';
