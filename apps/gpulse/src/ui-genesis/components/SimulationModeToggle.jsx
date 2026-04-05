import React from 'react';
import { FlaskConical } from 'lucide-react';
import { useSimulationModeStore } from '../stores/simulationModeStore.js';

/**
 * Enables mock wallet · network · ledger for QA (not real on-chain or API truth).
 * @param {{ className?: string }} props
 */
export function SimulationModeToggle({ className = '' }) {
  const isSimulationMode = useSimulationModeStore((s) => s.isSimulationMode);
  const setSimulationMode = useSimulationModeStore((s) => s.setSimulationMode);

  return (
    <button
      type="button"
      onClick={() => setSimulationMode(!isSimulationMode)}
      aria-pressed={isSimulationMode}
      title={isSimulationMode ? 'Desactivar modo simulación' : 'Activar modo simulación (datos ficticios)'}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition sm:px-3 sm:text-[11px] ${
        isSimulationMode
          ? 'border-amber-400/55 bg-amber-500/20 text-amber-50 shadow-[0_0_18px_-4px_rgba(251,191,36,0.45)]'
          : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/15 hover:text-slate-200'
      } ${className}`}
    >
      <FlaskConical className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span className="hidden sm:inline">Sim</span>
    </button>
  );
}
