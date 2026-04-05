import React from 'react';

/**
 * Activa/desactiva si la sincronización puede bloquear la ejecución (IA Real).
 * No detiene el HUD ni el cálculo de syncPercent.
 */
export default function GpulseSyncToggle({ syncMode, setSyncMode, setSyncModeManuallyChanged }) {
  return (
    <button
      type="button"
      onClick={() => {
        setSyncMode((prev) => !prev);
        setSyncModeManuallyChanged(true);
      }}
      className={`
        px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-widest transition-all
        ${syncMode
          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30'
          : 'bg-gray-500/20 text-white/40 border-white/10'
        }
      `}
    >
      {syncMode ? 'SYNC ON' : 'SYNC OFF'}
    </button>
  );
}
