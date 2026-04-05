import React from 'react';
import { SlidersHorizontal, Sparkles } from 'lucide-react';
import { useUiModeStore } from '../stores/uiModeStore.js';

/**
 * Lite / Pro switch — compact control for top bar.
 * @param {{ className?: string }} props
 */
export function UiModeToggle({ className = '' }) {
  const uiMode = useUiModeStore((s) => s.uiMode);
  const setUiMode = useUiModeStore((s) => s.setUiMode);

  return (
    <div
      className={`inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-0.5 shadow-inner ${className}`}
      role="group"
      aria-label="Modo de interfaz"
    >
      <button
        type="button"
        onClick={() => setUiMode('lite')}
        aria-pressed={uiMode === 'lite'}
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition sm:px-3 sm:text-[11px] ${
          uiMode === 'lite'
            ? 'bg-gradient-to-r from-cyan-500/25 to-violet-500/20 text-white shadow-[0_0_16px_-4px_rgba(34,211,238,0.35)]'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} />
        <span>Lite</span>
      </button>
      <button
        type="button"
        onClick={() => setUiMode('pro')}
        aria-pressed={uiMode === 'pro'}
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition sm:px-3 sm:text-[11px] ${
          uiMode === 'pro'
            ? 'bg-gradient-to-r from-violet-500/25 to-fuchsia-500/20 text-white shadow-[0_0_16px_-4px_rgba(139,92,246,0.35)]'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} />
        <span>Pro</span>
      </button>
    </div>
  );
}
