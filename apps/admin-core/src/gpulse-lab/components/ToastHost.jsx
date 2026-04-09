import React, { useEffect } from 'react';
import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';

function levelStyles(level) {
  if (level === 'critical') return 'border-red-500/50 bg-red-950/60 text-red-100';
  if (level === 'warning') return 'border-amber-500/45 bg-amber-950/50 text-amber-100';
  return 'border-cyan-500/35 bg-cyan-950/40 text-cyan-100';
}

export default function ToastHost() {
  const toasts = useGpulseLabUiStore((s) => s.toasts);
  const dismissToast = useGpulseLabUiStore((s) => s.dismissToast);

  useEffect(() => {
    if (!Array.isArray(toasts) || toasts.length === 0) return undefined;
    const ids = toasts.map((t) => t.id);
    const timers = ids.map((id) =>
      setTimeout(() => {
        try {
          dismissToast(id);
        } catch {
          /* ignore */
        }
      }, 3800),
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [toasts, dismissToast]);

  if (!Array.isArray(toasts) || toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-alert w-[min(92vw,420px)] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-lg border px-3 py-2 shadow-xl shadow-black/50 ${levelStyles(t.level)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] opacity-90">{t.title}</p>
              <p className="mt-1 text-[12px] leading-snug">{t.message}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] text-white/80 hover:bg-white/[0.12]"
              onClick={() => dismissToast(t.id)}
            >
              Cerrar
            </button>
          </div>
          {t.meta != null ? (
            <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded border border-white/[0.06] bg-black/30 p-2 font-mono text-[9px] text-white/60">
              {JSON.stringify(t.meta)}
            </pre>
          ) : null}
        </div>
      ))}
    </div>
  );
}

