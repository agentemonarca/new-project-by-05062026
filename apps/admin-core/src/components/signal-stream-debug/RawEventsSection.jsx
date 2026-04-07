import { memo } from 'react';
import { Binary, Telescope } from 'lucide-react';
import { asCounterRecord, sortedCounterEntries } from './counterHelpers.js';

/**
 * @param {{ latestCounters: Record<string, unknown> | null }}
 */
function RawEventsSectionInner({ latestCounters }) {
  const eventos = asCounterRecord(latestCounters?.eventos);
  const entries = sortedCounterEntries(eventos);
  const total = entries.reduce((s, [, n]) => s + n, 0);

  return (
    <section className="rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-slate-950/90 to-slate-950/40 p-4 shadow-[0_0_24px_rgba(34,211,238,0.06)]">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/35 bg-cyan-500/10">
          <Telescope className="h-5 w-5 text-cyan-300" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold tracking-tight text-white">RAW</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Eventos tal cual entran del wire (<span className="text-cyan-200/80">provider · onAny</span>). Conteo
            acumulado.
          </p>
          {total > 0 ? (
            <p className="mt-1 text-[10px] font-medium text-cyan-200/70">Total contado: {total}</p>
          ) : null}
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-600">Aún no hay conteos de eventos. Esperando frames del stream.</p>
      ) : (
        <div className="max-h-40 overflow-y-auto overscroll-contain scroll-smooth pr-1">
          <ul className="grid gap-2 sm:grid-cols-2">
            {entries.map(([name, count]) => (
              <li
                key={name}
                className="flex items-center justify-between gap-2 rounded-lg border border-cyan-500/15 bg-slate-950/60 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-300">
                  <Binary className="h-3.5 w-3.5 shrink-0 text-cyan-500/70" aria-hidden />
                  <span className="truncate font-mono text-[10px] text-cyan-100/90" title={name}>
                    {name}
                  </span>
                </span>
                <span className="shrink-0 rounded-md bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-cyan-200">
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

export const RawEventsSection = memo(RawEventsSectionInner);
RawEventsSection.displayName = 'RawEventsSection';
