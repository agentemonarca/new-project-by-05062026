import React from 'react';
import { SignalCycleDetails } from './SignalCycleDetails.jsx';

function formatTs(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

const statusStyles = {
  WIN: 'border-emerald-500/35 bg-emerald-500/[0.08] text-emerald-100',
  LOSS: 'border-rose-500/40 bg-rose-500/[0.1] text-rose-100',
  UNKNOWN: 'border-amber-500/35 bg-amber-500/[0.08] text-amber-100',
};

const badgeStyles = {
  WIN: 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/30',
  LOSS: 'bg-rose-500/20 text-rose-200 ring-rose-500/30',
  UNKNOWN: 'bg-amber-500/20 text-amber-200 ring-amber-500/30',
};

export function SignalCycleCard({ cycle }) {
  const { mesa, round, signal, martingale, status, startedAt, settledAt, rawEvents, fullRawBundle } = cycle;
  const shell = statusStyles[status] || statusStyles.UNKNOWN;
  const badge = badgeStyles[status] || badgeStyles.UNKNOWN;

  return (
    <article
      className={`rounded-2xl border px-4 py-4 shadow-lg backdrop-blur-sm ${shell}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.08] pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Mesa</p>
          <p className="font-mono text-lg font-bold text-white/95">{mesa}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Ronda</p>
          <p className="font-mono text-lg font-bold text-white/95">{round}</p>
        </div>
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Señal</p>
          <p className="mt-0.5 font-mono text-base font-black tracking-tight text-white">{String(signal)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Martingala</p>
          <p className="mt-0.5 font-mono text-base font-black text-white">{martingale}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Estado</p>
          <span
            className={`mt-1 inline-flex rounded-lg px-3 py-1 text-xs font-black uppercase tracking-widest ring-1 ring-inset ${badge}`}
          >
            {status}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Inicio señal</p>
          <p className="mt-0.5 font-mono text-[11px] text-white/80">{formatTs(startedAt)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Resultado</p>
          <p className="mt-0.5 font-mono text-[11px] text-white/80">{formatTs(settledAt)}</p>
        </div>
      </div>

      <SignalCycleDetails rawEvents={rawEvents} fullRawBundle={fullRawBundle} />
    </article>
  );
}
