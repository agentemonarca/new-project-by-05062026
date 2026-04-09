import React, { useEffect, useMemo, useState } from 'react';
import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';
import { MAX_CYCLE_DURATION_MS, useValidationStore } from '../store/useValidationStore.js';

function statusBadge(c) {
  if (c.timeoutKind === 'STREAM' && c.uiStatus === 'ERROR') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-500/55 bg-red-950/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-100">
        <span aria-hidden>⏱️</span> STREAM TIMEOUT
      </span>
    );
  }
  if (c.labTimeout) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
        <span aria-hidden>⏱️</span> RETARDO REAL
      </span>
    );
  }
  switch (c.uiStatus) {
    case 'COMPLETE':
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          COMPLETO <span aria-hidden>✅</span>
        </span>
      );
    case 'COMPLETE_RESYNC':
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/35 bg-cyan-950/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
          <span aria-hidden>🔁</span> RESYNC COMPLETE
        </span>
      );
    case 'INCOMPLETE_NO_RESULT':
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
          <span aria-hidden>🟡</span> SIN RESULTADO
        </span>
      );
    case 'ERROR':
      if (c.failureType === 'DATA_INCONSISTENCY') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-red-500/55 bg-red-950/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-100">
            <span aria-hidden>🔴</span> INCONSISTENTE
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
          ERROR <span aria-hidden>❌</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
          INCOMPLETO <span aria-hidden>⚠️</span>
        </span>
      );
  }
}

function ActiveStreamWaitCountdown() {
  const activeStreamWaits = useValidationStore((s) => s.activeStreamWaits);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const limitMs = MAX_CYCLE_DURATION_MS;
  const limitSec = Math.round(limitMs / 1000);

  const rows = useMemo(() => {
    return Object.entries(activeStreamWaits).map(([key, { signalAt }]) => {
      const elapsed = now - signalAt;
      const remaining = Math.max(0, limitMs - elapsed);
      const remSec = Math.ceil(remaining / 1000);
      const pct = Math.min(1, Math.max(0, elapsed / limitMs));
      return { key, remSec, pct };
    });
  }, [activeStreamWaits, now, limitMs]);

  if (rows.length === 0) return null;

  return (
    <div className="mb-4 space-y-2 rounded-lg border border-violet-500/15 bg-violet-950/10 p-3">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">Stream · esperando NEW_RESULT</p>
      {rows.map(({ key, remSec, pct }) => (
        <div
          key={key}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-2 transition-[border-color,background-color] duration-200"
          style={{
            borderColor: `rgba(248, 113, 113, ${0.2 + pct * 0.65})`,
            backgroundColor: `rgba(69, 10, 10, ${0.08 + pct * 0.22})`,
            boxShadow: pct > 0.75 ? '0 0 12px rgba(248, 113, 113, 0.12)' : undefined,
          }}
        >
          <span className="min-w-0 truncate font-mono text-[9px] text-slate-500" title={key}>
            <span className="text-violet-400/90">{key}</span>
          </span>
          <span
            className="shrink-0 font-mono text-[11px] font-semibold tabular-nums"
            style={{
              color: `rgb(${Math.round(251 - pct * 40)}, ${Math.round(191 - pct * 120)}, ${Math.round(36 + pct * 40)})`,
            }}
          >
            {remSec}s / {limitSec}s
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * @param {{ variant?: 'default' | 'dock' }} p
 */
export default function ValidationPanel({ variant = 'default' }) {
  const cycles = useValidationStore((s) => s.cycles);
  const logs = useValidationStore((s) => s.logs);
  const clear = useValidationStore((s) => s.clear);
  const [logOpen, setLogOpen] = useState(false);

  const tailLogs = useMemo(() => logs.slice(-24), [logs]);

  const shell =
    variant === 'dock'
      ? 'mt-0 w-full rounded-xl border border-violet-500/20 bg-gradient-to-br from-zinc-950/90 via-black/75 to-violet-950/20 p-3 ring-1 ring-white/[0.06] sm:p-4'
      : 'mt-4 w-full rounded-xl border border-violet-500/20 bg-gradient-to-br from-zinc-950/95 via-black/80 to-violet-950/20 p-4 shadow-lg shadow-black/40 ring-1 ring-white/[0.05] sm:p-5';

  return (
    <section className={shell} aria-label="Validation Engine">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
        <div>
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300/95">
            Validation Engine
          </h2>
          <p className="mt-1 text-[10px] text-slate-500">
            Stream <span className="font-mono text-slate-400">/admin-signals</span> vs ciclo middleware (correlationKey)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-slate-300 hover:bg-white/[0.08]"
            onClick={() => setLogOpen((o) => !o)}
          >
            {logOpen ? 'Ocultar log' : 'Log avanzado'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-slate-400 hover:bg-white/[0.08]"
            onClick={() => clear()}
          >
            Limpiar
          </button>
        </div>
      </div>

      <ActiveStreamWaitCountdown />

      {logOpen && (
        <div className="mb-4 max-h-36 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/35 p-2 font-mono text-[9px] leading-relaxed text-slate-500">
          {tailLogs.length === 0 ? (
            <span className="text-slate-600">Sin entradas.</span>
          ) : (
            tailLogs.map((e, i) => (
              <div key={`${e.ts}-${i}`} className="border-b border-white/[0.04] py-1 last:border-b-0">
                <span className="text-slate-600">{new Date(e.ts).toLocaleTimeString()}</span>{' '}
                <span
                  className={
                    e.level === 'error' ? 'text-red-400/95' : e.level === 'warn' ? 'text-amber-300/90' : 'text-slate-400'
                  }
                >
                  {e.message}
                </span>
                {e.meta != null ? (
                  <pre className="mt-0.5 whitespace-pre-wrap break-all text-[8px] text-slate-600">{JSON.stringify(e.meta)}</pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}

      <div className="max-h-[min(52vh,420px)] space-y-3 overflow-y-auto pr-1">
        {cycles.length === 0 ? (
          <p className="py-6 text-center font-mono text-xs text-slate-600">Sin ciclos aún — esperando señal/resultado.</p>
        ) : (
          cycles.map((c) => (
            <article
              key={c.id}
              className="rounded-lg border border-white/[0.07] bg-black/25 p-3 font-mono text-[10px] text-slate-300"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium text-slate-200">{c.label}</p>
                  <p className="mt-0.5 text-[9px] text-slate-600">
                    key <span className="text-violet-400/90">{c.correlationKey}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-cyan-500/35 bg-cyan-950/30 px-2 py-1 font-mono text-[9px] text-cyan-200/90 hover:bg-cyan-900/40"
                    onClick={() =>
                      useGpulseLabUiStore.getState().openCycleXRay({
                        correlationKey: c.correlationKey != null ? String(c.correlationKey) : null,
                        mesaId: c.mesa != null ? String(c.mesa) : null,
                        cycleId: c.id,
                      })
                    }
                  >
                    🔬 X-Ray
                  </button>
                  {statusBadge(c)}
                </div>
              </div>

              <div className="mt-2 grid gap-1 border-t border-white/[0.06] pt-2 text-[10px] sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">Lab: </span>
                  <span className="text-cyan-300/90">{c.resultadoLab != null ? String(c.resultadoLab) : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">GPulse (stream): </span>
                  <span className="text-emerald-300/90">{c.resultadoGpulse != null ? String(c.resultadoGpulse) : '—'}</span>
                </div>
              </div>

              {c.uiStatus === 'ERROR' &&
              c.resultadoLab != null &&
              c.resultadoGpulse != null &&
              String(c.resultadoLab).toUpperCase() !== String(c.resultadoGpulse).toUpperCase() ? (
                <p className="mt-2 text-[10px] text-red-400/95">
                  Mesa {String(c.mesa)} | Round {c.round}
                  <br />
                  Lab: {String(c.resultadoLab)} · GPulse: {String(c.resultadoGpulse)} ❌
                </p>
              ) : null}

              <dl className="mt-2 grid gap-x-4 gap-y-1 border-t border-white/[0.05] pt-2 text-[9px] text-slate-500 sm:grid-cols-2">
                <div>
                  <dt className="text-slate-600">Tiempo señal→result (lab, recepción)</dt>
                  <dd className="text-slate-400">{c.delayMsLab != null ? `${Math.round(c.delayMsLab)} ms` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">Retardo real vs umbral adaptativo</dt>
                  <dd className="text-slate-400">
                    {c.actualDelayMs != null ? `${Math.round(c.actualDelayMs)} ms` : '—'}
                    {c.adaptiveThresholdMs != null ? (
                      <span className="text-slate-500"> · umbral {Math.round(c.adaptiveThresholdMs)} ms</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">Tiempo total hasta emitir store</dt>
                  <dd className="text-slate-400">{c.delayTotalLabMs != null ? `${Math.round(c.delayTotalLabMs)} ms` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">Delay stream (misma key)</dt>
                  <dd className="text-slate-400">{c.delayMsStream != null ? `${Math.round(c.delayMsStream)} ms` : '—'}</dd>
                </div>
                {c.middlewareCorrectedRound ? (
                  <div className="sm:col-span-2">
                    <dt className="text-amber-400/90">Middleware corrigió round</dt>
                    <dd className="text-slate-400">sí</dd>
                  </div>
                ) : null}
              </dl>

              {c.issues?.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-[9px] text-amber-200/85">
                  {c.issues.map((iss, idx) => (
                    <li key={idx}>{iss}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
