import React, { useMemo } from 'react';

const DAY_MS = 86400000;

function parseStartMs(startDate) {
  if (startDate == null) return Date.now();
  if (typeof startDate === 'number' && Number.isFinite(startDate)) return startDate;
  const d = new Date(startDate);
  const t = d.getTime();
  return Number.isNaN(t) ? Date.now() : t;
}

/**
 * @param {{ user?: { plan?: string, startDate?: string | number | Date, durationDays?: number } }} props
 */
export default function GpulseStatusPanel({ user = {} }) {
  const { plan = 'Standard', startDate, durationDays = 30 } = user;

  const { activeDays, remainingDays, progressPct, levelLabel } = useMemo(() => {
    const startMs = parseStartMs(startDate);
    const now = Date.now();
    const elapsed = Math.max(0, now - startMs);
    const rawActive = Math.floor(elapsed / DAY_MS);
    const total = Math.max(1, Number(durationDays) || 1);
    const active = Math.min(rawActive, total);
    const remaining = Math.max(0, total - active);
    const progress = Math.min(100, Math.round((active / total) * 1000) / 10);
    const level =
      typeof plan === 'string' && plan.trim()
        ? plan.trim().replace(/^\w/, (c) => c.toUpperCase())
        : 'Standard';

    return {
      activeDays: active,
      remainingDays: remaining,
      progressPct: progress,
      levelLabel: level,
    };
  }, [plan, startDate, durationDays]);

  return (
    <section
      className="rounded-2xl border border-white/[0.08] bg-black px-5 py-4 text-white shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]"
      aria-label="Estado G_Pulse"
    >
      <header className="mb-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">G_Pulse</h2>
      </header>

      <dl className="space-y-3 text-[13px] leading-snug tracking-[-0.01em]">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
          <dt className="text-white/50">Nivel actual</dt>
          <dd className="font-medium tabular-nums text-white">{levelLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
          <dt className="text-white/50">Tiempo activo</dt>
          <dd className="font-medium tabular-nums text-white">
            {activeDays} {activeDays === 1 ? 'día' : 'días'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 pb-1">
          <dt className="text-white/50">Tiempo restante</dt>
          <dd className="font-medium tabular-nums text-white">
            {remainingDays} {remainingDays === 1 ? 'día' : 'días'}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/40">
          <span>Progreso</span>
          <span className="tabular-nums text-white/60">{progressPct}%</span>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-white/[0.12]"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
