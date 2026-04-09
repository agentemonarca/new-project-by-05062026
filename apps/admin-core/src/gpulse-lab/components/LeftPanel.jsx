import React, { useMemo } from 'react';
import { useGpulseLabDebugLive } from '../hooks/useGpulseLabDebugLive.js';
import { createEmptyMesaState, getEffectiveMesaId, useLabStore } from '../store/useLabStore.js';
import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';
import { getMartingaleAccentClass, getMartingaleLabel } from '../utils/martingaleUi.js';

function FieldRow({ label, value }) {
  const title =
    typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] py-2.5 last:border-b-0">
      <span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span
        className="max-w-[58%] truncate text-right font-mono text-[11px] tabular-nums text-slate-300"
        title={title}
      >
        {value}
      </span>
    </div>
  );
}

function formatEstado(estado) {
  switch (estado) {
    case 'WAITING':
      return 'ESPERA';
    case 'SIGNAL':
      return 'SEÑAL';
    case 'RESULT':
      return 'RESULTADO';
    default:
      return '—';
  }
}

export default function LeftPanel() {
  const debugData = useGpulseLabDebugLive();
  const mesas = useLabStore((s) => s.mesas);
  const selectedMesaId = useLabStore((s) => s.selectedMesaId);

  const effectiveId = useMemo(() => getEffectiveMesaId(mesas, selectedMesaId), [mesas, selectedMesaId]);
  const row = useMemo(
    () => (effectiveId ? mesas[effectiveId] : createEmptyMesaState()),
    [mesas, effectiveId],
  );

  const mesaStr = effectiveId ?? '—';
  const roundStr = row.round == null ? '—' : String(row.round);
  const señalStr =
    row.recommendation == null
      ? '—'
      : typeof row.recommendation === 'object'
        ? JSON.stringify(row.recommendation)
        : String(row.recommendation);

  const mgLevel = row.signalMartingaleLevel;
  const martingaleDisplay =
    mgLevel != null ? (
      <span className={getMartingaleAccentClass(mgLevel)}>
        {row.martingaleType ?? getMartingaleLabel(mgLevel)} ({mgLevel})
      </span>
    ) : (
      '—'
    );

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="Live Monitor">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-400/95">LIVE MONITOR</h2>
        {effectiveId ? (
          <button
            type="button"
            onClick={() => useGpulseLabUiStore.getState().openCycleReplay({ mesaId: effectiveId })}
            className="rounded-md border border-amber-500/35 bg-amber-950/30 px-2 py-0.5 font-mono text-[9px] text-amber-200/95 hover:bg-amber-900/40"
          >
            🎥 Replay
          </button>
        ) : null}
      </div>

      <div
        className="mb-3 rounded-md border border-indigo-500/30 bg-black/70 p-2.5 font-mono text-[9px] leading-snug text-slate-200 shadow-inner shadow-black/40"
        aria-label="DEBUG LIVE"
      >
        <div className="mb-1 font-bold text-indigo-400">DEBUG LIVE</div>
        <div>STATE: {debugData.lifecycleState}</div>
        <div>MESA: {debugData.mesaId}</div>
        <div>ROUND: {debugData.round}</div>
        <div>SIGNAL: {debugData.signalTs ?? '—'}</div>
        <div>CLOSE TS: {debugData.providerCloseTs ?? '—'}</div>
        <div>NOW: {debugData.now}</div>
        <div>REMAIN: {debugData.remainingMs ?? '—'}</div>
        <div>WAIT: {debugData.elapsedMs ?? '—'}</div>
        <div>WINNER: {debugData.winner ?? '—'}</div>
      </div>

      {effectiveId ? (
        <p className="mb-2 font-mono text-[9px] text-slate-600">
          Vista: <span className="text-cyan-400/90">mesa {effectiveId}</span>
        </p>
      ) : null}
      <div className="flex flex-col">
        <FieldRow label="Mesa" value={mesaStr} />
        <FieldRow label="Ronda" value={roundStr} />
        <FieldRow label="Señal" value={señalStr} />
        <FieldRow label="Martingala" value={martingaleDisplay} />
        <FieldRow label="Estado" value={formatEstado(row.estado)} />
      </div>
    </div>
  );
}
