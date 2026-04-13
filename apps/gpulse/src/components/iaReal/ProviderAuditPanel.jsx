import React, { useMemo } from 'react';
import { useExternalSignalsStore } from '@/ui-genesis/stores/externalSignalsStore.js';
import { extractMesaInfoFlexible } from '@/utils/iaRealEngineUi.js';

/**
 * Panel de depuración: fuente relay + store + motor + UI (solo con `VITE_DEBUG_AUDIT_PANEL=1`).
 */
export function ProviderAuditPanel({
  gamePhaseLabel,
  currentStepLabel,
  iaRealEngineState,
  adminRawFeed = [],
}) {
  const activeSignals = useExternalSignalsStore((s) => s.activeSignals);
  const history = useExternalSignalsStore((s) => s.history);

  const lastNewSignal = useMemo(() => {
    const hit = [...adminRawFeed].reverse().find((e) => e?.type === 'NEW_SIGNAL');
    return hit?.raw ?? null;
  }, [adminRawFeed]);

  const lastNewResult = useMemo(() => {
    const hit = [...adminRawFeed].reverse().find((e) => e?.type === 'NEW_RESULT');
    return hit?.raw ?? null;
  }, [adminRawFeed]);

  const mesaInfo = useMemo(() => {
    const rr = iaRealEngineState?.outcomeRow?.rawResult ?? iaRealEngineState?.activeRow?.rawResult;
    try {
      return rr ? extractMesaInfoFlexible(rr) : null;
    } catch {
      return null;
    }
  }, [iaRealEngineState?.outcomeRow?.rawResult, iaRealEngineState?.activeRow?.rawResult]);

  return (
    <div
      className="pointer-events-auto fixed bottom-3 left-3 z-[9999] max-h-[min(70vh,520px)] w-[min(96vw,420px)] overflow-auto rounded-xl border border-cyan-500/35 bg-slate-950/95 p-3 text-left font-mono text-[10px] text-cyan-100/90 shadow-2xl backdrop-blur-md"
      data-layer="provider-audit"
    >
      <div className="mb-2 border-b border-white/10 pb-2 text-[11px] font-black uppercase tracking-wide text-cyan-300">
        Provider audit
      </div>

      <section className="mb-3 space-y-1">
        <div className="text-[9px] font-bold uppercase text-slate-500">A) Raw provider</div>
        <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all text-slate-300">
          {lastNewSignal != null ? JSON.stringify(lastNewSignal, null, 0) : '—'}
        </pre>
        <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all text-slate-300">
          {lastNewResult != null ? JSON.stringify(lastNewResult, null, 0) : '—'}
        </pre>
      </section>

      <section className="mb-3 space-y-1">
        <div className="text-[9px] font-bold uppercase text-slate-500">B) Store</div>
        <pre className="max-h-28 overflow-auto text-slate-300">
          {JSON.stringify({ activeSignals, history }, null, 2)}
        </pre>
      </section>

      <section className="mb-3 space-y-1">
        <div className="text-[9px] font-bold uppercase text-slate-500">C) Engine (iaRealEngineState)</div>
        <pre className="max-h-28 overflow-auto text-slate-300">{JSON.stringify(iaRealEngineState, null, 2)}</pre>
      </section>

      <section className="space-y-1">
        <div className="text-[9px] font-bold uppercase text-slate-500">D) UI</div>
        <p className="text-slate-200">
          <span className="text-slate-500">gamePhase:</span> {String(gamePhaseLabel ?? '—')}
        </p>
        <p className="text-slate-200">
          <span className="text-slate-500">currentStep:</span> {String(currentStepLabel ?? '—')}
        </p>
        <pre className="max-h-20 overflow-auto text-slate-300">{JSON.stringify(mesaInfo, null, 2)}</pre>
      </section>
    </div>
  );
}
