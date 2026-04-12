import React from 'react';
import { ChevronLeft, ChevronRight, FastForward } from 'lucide-react';
import { useExecutionReplayStore } from '../store/useExecutionReplayStore.js';

/**
 * Step through recorded reduce events for the active correlation key (Phase 10).
 * @param {{ correlationKey: string | null }} props
 */
export default function ExecutionReplayBar({ correlationKey }) {
  const ck = correlationKey != null && String(correlationKey).trim() !== '' ? String(correlationKey).trim() : null;

  const row = useExecutionReplayStore((s) => (ck ? s.byCk[ck] : undefined));
  const stepPrev = useExecutionReplayStore((s) => s.stepPrev);
  const stepNext = useExecutionReplayStore((s) => s.stepNext);
  const seekLive = useExecutionReplayStore((s) => s.seekLive);

  if (ck == null || row == null || row.events.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-900/60 px-3 py-2 font-mono text-[10px] text-slate-500">
        <span>Replay</span>
        <span className="text-slate-600">— sin historial de motor para esta mesa</span>
      </div>
    );
  }

  const n = row.events.length;
  const pos = row.cursor + 1;
  const atLive = row.cursor >= n - 1;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-500/20 bg-zinc-900/70 px-3 py-2 font-mono text-[10px] text-cyan-100/90">
      <span className="font-bold uppercase tracking-wider text-cyan-400/90">Replay motor</span>
      <span className="text-slate-400">
        evento {pos}/{n}
        {!atLive ? <span className="ml-2 text-amber-400/90">· vista histórica</span> : null}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          title="Paso anterior"
          disabled={row.cursor < 0}
          onClick={() => stepPrev(ck)}
          className="rounded border border-white/10 bg-zinc-800/80 p-1.5 text-cyan-300 hover:bg-zinc-700 disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Paso siguiente"
          disabled={row.cursor >= n - 1}
          onClick={() => stepNext(ck)}
          className="rounded border border-white/10 bg-zinc-800/80 p-1.5 text-cyan-300 hover:bg-zinc-700 disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Ir al final (vivo)"
          onClick={() => seekLive(ck)}
          className="flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-950/40 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-cyan-300 hover:bg-cyan-900/40"
        >
          <FastForward className="h-3 w-3" /> Live
        </button>
      </div>
    </div>
  );
}
