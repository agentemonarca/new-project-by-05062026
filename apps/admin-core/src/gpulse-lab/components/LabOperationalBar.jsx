import React from 'react';
import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';
import { useLabStore } from '../store/useLabStore.js';
import { useMetricsStore } from '../store/useMetricsStore.js';
import { useSocketHealthStore } from '../store/useSocketHealthStore.js';

function HealthPill() {
  const status = useSocketHealthStore((s) => s.status);
  const attempt = useSocketHealthStore((s) => s.reconnectAttempt);

  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-2.5 py-1 font-mono text-[10px] text-emerald-200">
        <span aria-hidden>🟢</span> Connected
      </span>
    );
  }
  if (status === 'reconnecting') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/35 px-2.5 py-1 font-mono text-[10px] text-amber-100"
        title={attempt ? `Attempt ${attempt}` : undefined}
      >
        <span aria-hidden>🟡</span> Reconnecting{attempt ? ` (${attempt})` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/35 px-2.5 py-1 font-mono text-[10px] text-red-100">
      <span aria-hidden>🔴</span> Disconnected
    </span>
  );
}

export default function LabOperationalBar() {
  const totalSignals = useMetricsStore((s) => s.totalSignalsReceived);
  const totalResults = useMetricsStore((s) => s.totalResultsReceived);
  const cycles = useMetricsStore((s) => s.cyclesCompleted);
  const errors = useMetricsStore((s) => s.errorsDetected);
  const avgDelay = useMetricsStore((s) => s.avgDelayMsLab);

  const debugLogging = useGpulseLabUiStore((s) => s.debugLogging);
  const setDebugLogging = useGpulseLabUiStore((s) => s.setDebugLogging);
  const openCycleXRay = useGpulseLabUiStore((s) => s.openCycleXRay);
  const selectedMesaId = useLabStore((s) => s.selectedMesaId);
  const labDebug = debugLogging || import.meta.env.VITE_GPULSE_LAB_DEBUG === '1';

  return (
    <div className="relative z-hud flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-zinc-900/55 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Ops</span>
        <HealthPill />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] tabular-nums text-slate-400">
        <span title="NEW_SIGNAL count">sig {totalSignals}</span>
        <span title="NEW_RESULT count">res {totalResults}</span>
        <span title="Lab cycles with COMPLETE status">cycles ✓ {cycles}</span>
        <span title="Error-severity alerts">err {errors}</span>
        <span title="Avg signal→result delay (lab, COMPLETE)">avg {avgDelay != null ? `${avgDelay}ms` : '—'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {labDebug ? (
          <>
            <button
              type="button"
              onClick={() =>
                useGpulseLabUiStore.getState().openCycleReplay({
                  mesaId:
                    selectedMesaId != null && String(selectedMesaId).trim() !== '' ? String(selectedMesaId) : null,
                })
              }
              className="rounded-lg border border-amber-500/40 bg-amber-950/35 px-2.5 py-1 font-mono text-[10px] font-medium text-amber-200 hover:bg-amber-900/45"
            >
              🎥 Replay
            </button>
            <button
              type="button"
              onClick={() =>
                openCycleXRay({
                  mesaId: selectedMesaId != null && String(selectedMesaId).trim() !== '' ? String(selectedMesaId) : null,
                })
              }
              className="rounded-lg border border-cyan-500/40 bg-cyan-950/35 px-2.5 py-1 font-mono text-[10px] font-medium text-cyan-200 hover:bg-cyan-900/45"
            >
              🔬 Cycle X-Ray
            </button>
          </>
        ) : null}
        <label className="flex cursor-pointer items-center gap-2 font-mono text-[10px] text-slate-500">
          <input
            type="checkbox"
            checked={debugLogging}
            onChange={(e) => setDebugLogging(e.target.checked)}
            className="rounded border-white/20 bg-black/40"
          />
          Debug logs
        </label>
      </div>
    </div>
  );
}
