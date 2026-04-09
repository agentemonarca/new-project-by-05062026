import React, { useMemo } from 'react';
import { useLabStore } from '../store/useLabStore.js';
import { useControlCenterStore } from '../store/useControlCenterStore.js';
import HeatmapPanel from './HeatmapPanel.jsx';
import ProviderScoreCard from './ProviderScoreCard.jsx';

/**
 * @param {{ variant?: 'default' | 'dock' }} p
 */
export default function ControlCenterPanel({ variant = 'default' }) {
  const mesas = useLabStore((s) => s.mesas);
  const perMesa = useControlCenterStore((s) => s.perMesa);

  const ids = useMemo(() => {
    const u = new Set([...Object.keys(mesas), ...Object.keys(perMesa)]);
    return [...u].sort();
  }, [mesas, perMesa]);

  const shell =
    variant === 'dock'
      ? 'mt-0 rounded-xl border border-cyan-500/15 bg-gradient-to-br from-zinc-950/80 via-black/70 to-violet-950/15 p-3 ring-1 ring-cyan-500/10 sm:p-4'
      : 'mt-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-zinc-950/90 via-black/80 to-violet-950/20 p-4 shadow-[0_0_40px_rgba(34,211,238,0.06)] sm:p-5';

  return (
    <section className={shell} aria-label="Control Center Elite">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200/95">
          🧠 Control Center Elite
        </h2>
        <p className="max-w-xl font-mono text-[9px] text-slate-500">
          Replay de verdad, heatmap por mesa y puntuación de proveedor (sesión actual). Actualiza en cada ciclo.
        </p>
      </header>
      <HeatmapPanel />
      <div className="mt-4">
        <h3 className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          📊 Provider quality
        </h3>
        {ids.length === 0 ? (
          <p className="font-mono text-[10px] text-slate-600">Sin datos de mesa.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ids.map((id) => (
              <ProviderScoreCard key={id} mesaId={id} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
