import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

function formatTs(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  try {
    return new Date(ms).toISOString();
  } catch {
    return String(ms);
  }
}

export function SignalCycleDetails({ rawEvents, fullRawBundle }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 border-t border-white/[0.08] pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition hover:text-cyan-200/90"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        Detalles · JSON completo
      </button>

      {open ? (
        <div className="mt-3 space-y-4">
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Timeline</p>
            <ul className="space-y-2">
              {(rawEvents || []).map((ev, i) => (
                <li
                  key={`${ev.type}-${ev.at}-${i}`}
                  className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-[11px]"
                >
                  <span className="font-mono text-cyan-300/90">{ev.type}</span>
                  <span className="mx-2 text-slate-600">·</span>
                  <span className="font-mono text-slate-400">{formatTs(ev.at)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Raw · NEW_SIGNAL + NEW_RESULT (sin omitir campos)
            </p>
            <pre className="max-h-[min(420px,50vh)] overflow-auto rounded-xl border border-white/[0.08] bg-[#0a0a12] p-3 text-[10px] leading-relaxed text-emerald-100/90">
              {JSON.stringify(fullRawBundle ?? { signal: {}, result: {} }, null, 2)}
            </pre>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Eventos (payload por paso)</p>
            <pre className="max-h-[min(280px,40vh)] overflow-auto rounded-xl border border-white/[0.08] bg-[#0a0a12] p-3 text-[10px] leading-relaxed text-slate-200/85">
              {JSON.stringify(rawEvents ?? [], null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
