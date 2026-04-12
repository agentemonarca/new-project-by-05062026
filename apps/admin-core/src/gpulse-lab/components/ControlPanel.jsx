import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { handleResult, handleSignal } from '../engine/executionEngineDispatch.js';
import {
  getSignalMiddlewareSnapshot,
  resetMiddlewareProcessingState,
  setMiddlewareEnabled,
} from '../middleware/useSignalMiddleware.js';
import { useLabStore } from '../store/useLabStore.js';
import { setValidationEnabled, validationEnabled as valFlag } from '../store/useValidationStore.js';

function correlationKeyFrom(mesa, round) {
  return `${String(mesa)}|${String(round)}`;
}

const LAB_SIMULATE_ENABLED = import.meta.env.VITE_GPULSE_ALLOW_LAB_SIMULATE === '1';

/** Preferencia UI: default ON (correlación / cola GPulse Lab). Valores '1' | '0'. */
const MW_PREF_STORAGE_KEY = 'gpulse_lab_middleware_enabled';

function readMiddlewarePreference() {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(MW_PREF_STORAGE_KEY);
    if (v === null) return true;
    return v === '1' || v === 'true';
  } catch {
    return true;
  }
}

function IndicatorPill({ label, active, activeLabel = 'ACTIVO', inactiveLabel = 'INACTIVO' }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:min-w-[140px]">
      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
      <span
        className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide ${
          active
            ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-300'
            : 'border-red-500/45 bg-red-950/40 text-red-300'
        }`}
      >
        {active ? activeLabel : inactiveLabel}
      </span>
    </div>
  );
}

export default function ControlPanel() {
  const [middlewareOn, setMiddlewareOn] = useState(readMiddlewarePreference);
  const [validationOn, setValidationOn] = useState(() => valFlag);
  const [mwSnap, setMwSnap] = useState(() => getSignalMiddlewareSnapshot());

  useLayoutEffect(() => {
    setMiddlewareEnabled(middlewareOn);
  }, [middlewareOn]);

  const selectedMesaId = useLabStore((s) => s.selectedMesaId);
  const mesaIdsKey = useLabStore((s) => JSON.stringify(Object.keys(s.mesas).sort()));
  const mesaIds = useMemo(() => {
    try {
      return JSON.parse(mesaIdsKey);
    } catch {
      return [];
    }
  }, [mesaIdsKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      const snapshot = getSignalMiddlewareSnapshot();
      setMwSnap((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(snapshot)) {
          return prev;
        }
        return snapshot;
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const openSet = useMemo(() => new Set(mwSnap.mesaKeysWithOpenCycle ?? []), [mwSnap]);

  const toggleMiddleware = useCallback(() => {
    setMiddlewareOn((prev) => {
      const next = !prev;
      try {
        window.localStorage?.setItem(MW_PREF_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleValidation = useCallback(() => {
    const next = !validationOn;
    setValidationOn(next);
    setValidationEnabled(next);
  }, [validationOn]);

  const resetTodo = useCallback(() => {
    resetMiddlewareProcessingState();
    useLabStore.getState().resetCycle();
  }, []);

  const resetMesaSeleccionada = useCallback(() => {
    const id = useLabStore.getState().selectedMesaId;
    if (!id) return;
    resetMiddlewareProcessingState(id);
    useLabStore.getState().resetCycle(id);
  }, []);

  const simulateCycle = useCallback(() => {
    const mesa = useLabStore.getState().selectedMesaId || 'SIM';
    resetMiddlewareProcessingState(mesa);
    useLabStore.getState().resetCycle(mesa);

    const round = String(Math.floor(Date.now() / 1000) % 100000);
    const correlationKey = correlationKeyFrom(mesa, round);

    const signalPayload = {
      mesa,
      round,
      recommendation: 'B',
      martingale: 0,
      correlationKey,
    };

    handleSignal(signalPayload);

    window.setTimeout(() => {
      handleResult({
        ganador: 'B',
        mesa,
        round,
        correlationKey,
        vector_resultado: [1],
        vector_win: [1],
        contador_martingala: 0,
      });
    }, 200);
  }, []);

  return (
    <section
      className="relative z-panel rounded-xl border border-white/[0.1] bg-zinc-900/85 p-3 shadow-lg shadow-black/35 ring-1 ring-white/[0.06] sm:p-4"
      aria-label="Panel de control GPulse Lab"
    >
      <div className="mb-4 flex flex-col gap-3 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Control operativo</h2>
          <p className="mt-1 text-[10px] text-slate-600">Multi-mesa · middleware y validación por mesa.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <IndicatorPill label="Middleware" active={middlewareOn} activeLabel="ACTIVO" inactiveLabel="INACTIVO" />
          <IndicatorPill label="Validación" active={validationOn} activeLabel="ACTIVO" inactiveLabel="INACTIVO" />
          <div className="flex min-w-0 flex-col gap-0.5 sm:min-w-[140px]">
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Ciclos abiertos</span>
            <span
              className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 font-mono text-xs font-semibold tabular-nums ${
                (mwSnap.mesaKeysWithOpenCycle?.length ?? 0) > 0
                  ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-300'
                  : 'border-slate-600/50 bg-slate-900/60 text-slate-500'
              }`}
            >
              {mwSnap.mesaKeysWithOpenCycle?.length ?? 0}
            </span>
          </div>
        </div>
      </div>

      {mesaIds.length > 0 ? (
        <div className="mb-4 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/25 font-mono text-[10px]">
          <table className="w-full min-w-[280px] border-collapse text-left text-slate-400">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-500">
                <th className="px-3 py-2 font-medium">Mesa</th>
                <th className="px-3 py-2 font-medium">Ciclo abierto</th>
                <th className="px-3 py-2 font-medium">Selección</th>
              </tr>
            </thead>
            <tbody>
              {mesaIds.map((id) => (
                <tr key={id} className="border-b border-white/[0.04] last:border-b-0">
                  <td className="px-3 py-2 text-cyan-400/90">{id}</td>
                  <td className="px-3 py-2">{openSet.has(id) ? <span className="text-amber-300">sí</span> : 'no'}</td>
                  <td className="px-3 py-2">{selectedMesaId === id ? '●' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={toggleMiddleware}
          className={`min-h-[52px] flex-1 rounded-xl border-2 px-4 py-3 font-mono text-sm font-semibold uppercase tracking-wide transition sm:min-w-[200px] ${
            middlewareOn
              ? 'border-emerald-500/60 bg-emerald-950/45 text-emerald-200 hover:bg-emerald-900/50'
              : 'border-red-500/55 bg-red-950/40 text-red-200 hover:bg-red-900/45'
          }`}
        >
          {middlewareOn ? '🟢 Middleware ON' : '🔴 Middleware OFF'}
        </button>
        <button
          type="button"
          onClick={toggleValidation}
          className={`min-h-[52px] flex-1 rounded-xl border-2 px-4 py-3 font-mono text-sm font-semibold uppercase tracking-wide transition sm:min-w-[200px] ${
            validationOn
              ? 'border-emerald-500/60 bg-emerald-950/45 text-emerald-200 hover:bg-emerald-900/50'
              : 'border-red-500/55 bg-red-950/40 text-red-200 hover:bg-red-900/45'
          }`}
        >
          {validationOn ? '🔍 Validation ON' : '🔍 Validation OFF'}
        </button>
        <button
          type="button"
          onClick={resetTodo}
          className="min-h-[52px] flex-1 rounded-xl border-2 border-slate-500/40 bg-slate-900/80 px-4 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-slate-200 hover:bg-slate-800/90 sm:min-w-[200px]"
        >
          🧹 Reset todo
        </button>
        <button
          type="button"
          onClick={resetMesaSeleccionada}
          disabled={!selectedMesaId}
          className="min-h-[52px] flex-1 rounded-xl border-2 border-amber-500/35 bg-amber-950/25 px-4 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-amber-200 hover:bg-amber-950/40 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[200px]"
        >
          🧹 Reset mesa seleccionada
        </button>
        {LAB_SIMULATE_ENABLED ? (
          <button
            type="button"
            onClick={simulateCycle}
            className="min-h-[52px] flex-1 rounded-xl border-2 border-violet-500/45 bg-violet-950/35 px-4 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-violet-200 hover:bg-violet-900/40 sm:min-w-[200px]"
          >
            🧪 Simular ciclo (mesa elegida o SIM)
          </button>
        ) : null}
      </div>
    </section>
  );
}
