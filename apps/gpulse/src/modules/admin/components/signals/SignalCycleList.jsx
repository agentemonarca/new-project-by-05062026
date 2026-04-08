import React from 'react';
import { Activity } from 'lucide-react';
import { SignalCycleCard } from './SignalCycleCard.jsx';

export function SignalCycleList({ cycles, connectionStatus, lastError }) {
  const ok = connectionStatus === 'connected';
  const label =
    connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
      ? 'Conectando…'
      : ok
        ? 'Socket /admin-signals conectado'
        : connectionStatus === 'disabled'
          ? 'Señales desactivadas (configura env)'
          : connectionStatus === 'error'
            ? `Error: ${lastError || 'desconocido'}`
            : 'Desconectado';

  return (
    <div className="space-y-4">
      <div
        className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 text-xs ${
          ok
            ? 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-100/95'
            : 'border-white/[0.1] bg-white/[0.03] text-slate-300'
        }`}
      >
        <Activity className={`h-4 w-4 shrink-0 ${ok ? 'text-emerald-400' : 'text-slate-500'}`} />
        <span className="font-medium">{label}</span>
        <span className="ml-auto font-mono text-[10px] text-white/40">
          {cycles.length} ciclo{cycles.length === 1 ? '' : 's'} completo{cycles.length === 1 ? '' : 's'}
        </span>
      </div>

      {cycles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.12] bg-slate-950/50 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-slate-300">Sin ciclos completos aún</p>
          <p className="mt-2 max-w-md mx-auto text-xs leading-relaxed text-slate-500">
            Solo se listan pares <span className="font-mono text-slate-400">NEW_SIGNAL</span> →{' '}
            <span className="font-mono text-slate-400">NEW_RESULT</span> correlacionados. Cuando llegue el
            resultado del proveedor, el ciclo aparecerá aquí con todo el payload en bruto.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {cycles.map((c) => (
            <li key={c.cycleId}>
              <SignalCycleCard cycle={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
