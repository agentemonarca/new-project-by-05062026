import React from 'react';
import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';
import { useLabStore } from '../store/useLabStore.js';

export default function MesaSelector() {
  const mesas = useLabStore((s) => s.mesas);
  const selectedMesaId = useLabStore((s) => s.selectedMesaId);
  const setSelectedMesaId = useLabStore((s) => s.setSelectedMesaId);

  const keys = Object.keys(mesas).sort();

  if (keys.length === 0) {
    return (
      <div className="relative z-panel rounded-lg border border-dashed border-white/[0.12] bg-black/20 px-3 py-2 font-mono text-[10px] text-slate-600">
        Sin mesas activas — llegará una al recibir la primera señal.
      </div>
    );
  }

  return (
    <div className="relative z-panel flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Mesas activas</span>
      <div className="flex flex-wrap gap-2">
        {keys.map((k) => {
          const on = selectedMesaId === k;
          return (
            <span key={k} className="inline-flex items-stretch overflow-hidden rounded-lg">
              <button
                type="button"
                onClick={() => setSelectedMesaId(k)}
                className={`border px-3 py-2 font-mono text-xs font-medium transition ${
                  on
                    ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200'
                    : 'border-white/[0.1] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
                }`}
              >
                Mesa {k}
              </button>
              <button
                type="button"
                title="Cycle X-Ray"
                aria-label={`Cycle X-Ray mesa ${k}`}
                onClick={() =>
                  useGpulseLabUiStore.getState().openCycleXRay({
                    mesaId: k,
                  })
                }
                className={`border border-l-0 px-2 py-2 font-mono text-xs transition ${
                  on
                    ? 'border-cyan-500/50 bg-cyan-950/30 text-cyan-300/90 hover:bg-cyan-900/40'
                    : 'border-white/[0.1] bg-black/30 text-slate-500 hover:bg-white/[0.08] hover:text-cyan-300'
                }`}
              >
                🔬
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
