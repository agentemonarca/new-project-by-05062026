import React, { useMemo } from 'react';
import {
  normalizeNewResultPayload,
  normalizeNewSignalPayload,
} from '@/ui-genesis/lib/externalSignalsTypes.js';
import { useExternalSignalsStore } from '@/ui-genesis/stores/externalSignalsStore.js';

function Field({ label, value }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-white/[0.05] py-2 last:border-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="max-w-[65%] break-all text-right font-mono text-xs text-cyan-100/90">{value}</dd>
    </div>
  );
}

/**
 * Vista de cómo GPulse interpreta correlación y normalización.
 */
export function AdminSignalParsedView({ className = '' }) {
  const activeSignals = useExternalSignalsStore((s) => s.activeSignals);
  const history = useExternalSignalsStore((s) => s.history);
  const adminRawFeed = useExternalSignalsStore((s) => s.adminRawFeed);

  const latestSignalRaw = useMemo(() => {
    const hit = adminRawFeed.find((e) => e.type === 'NEW_SIGNAL');
    return hit?.raw ?? null;
  }, [adminRawFeed]);

  const latestResultRaw = useMemo(() => {
    const hit = adminRawFeed.find((e) => e.type === 'NEW_RESULT');
    return hit?.raw ?? null;
  }, [adminRawFeed]);

  const pendingTop = activeSignals.length ? activeSignals[activeSignals.length - 1] : null;
  const settledTop = history.length ? history[0] : null;

  const parsedFromFeed = useMemo(() => {
    try {
      return latestSignalRaw ? normalizeNewSignalPayload(latestSignalRaw) : null;
    } catch {
      return null;
    }
  }, [latestSignalRaw]);

  const parsedResultFeed = useMemo(() => {
    try {
      return latestResultRaw ? normalizeNewResultPayload(latestResultRaw) : null;
    } catch {
      return null;
    }
  }, [latestResultRaw]);

  return (
    <div className={`rounded-2xl border border-white/[0.08] bg-slate-950/70 ${className}`}>
      <div className="border-b border-white/[0.06] px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Signal interpretation</h3>
        <p className="text-[11px] text-slate-500">
          Normalización interna · misma lógica que <span className="font-mono">ingestNewSignal</span> /{' '}
          <span className="font-mono">ingestNewResult</span>
        </p>
      </div>
      <div className="custom-scrollbar max-h-[min(420px,50vh)] overflow-y-auto p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <section>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Señal activa (store)
            </h4>
            {pendingTop ? (
              <dl className="rounded-xl border border-cyan-500/15 bg-black/30 p-3">
                <Field label="correlationKey" value={pendingTop.correlationKey} />
                <Field label="recommendación" value={pendingTop.recommendation} />
                <Field label="estado" value={pendingTop.status} />
                <Field label="martingale" value={String(pendingTop.martingale)} />
                <Field label="mesa / ronda" value={`${pendingTop.mesa || '—'} · ${pendingTop.round || '—'}`} />
              </dl>
            ) : (
              <p className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-xs text-slate-500">
                No hay señal pendiente en el store.
              </p>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Último resultado (store)
            </h4>
            {settledTop ? (
              <dl className="rounded-xl border border-violet-500/15 bg-black/30 p-3">
                <Field label="correlationKey" value={settledTop.correlationKey} />
                <Field label="recommendación" value={settledTop.recommendation} />
                <Field label="estado" value={settledTop.status} />
                <Field label="winStatus" value={String(settledTop.winStatus)} />
                <Field label="mesa / ronda" value={`${settledTop.mesa || '—'} · ${settledTop.round || '—'}`} />
              </dl>
            ) : (
              <p className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-xs text-slate-500">
                Sin historial de resultados aún.
              </p>
            )}
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Parse último NEW_SIGNAL (feed)
            </h4>
            {parsedFromFeed ? (
              <dl className="rounded-xl border border-emerald-500/15 bg-black/30 p-3">
                <Field label="correlationKey" value={parsedFromFeed.correlationKey} />
                <Field label="recommendación" value={parsedFromFeed.recommendation} />
                <Field label="providerSignalId" value={parsedFromFeed.providerSignalId ?? '—'} />
                <Field label="martingale (raw→número)" value={String(parsedFromFeed.martingale)} />
                <Field label="mesa / ronda" value={`${parsedFromFeed.mesa || '—'} · ${parsedFromFeed.round || '—'}`} />
              </dl>
            ) : (
              <p className="text-xs text-slate-500">Ningún NEW_SIGNAL en el feed reciente.</p>
            )}
          </section>
          <section>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Parse último NEW_RESULT (feed)
            </h4>
            {parsedResultFeed ? (
              <dl className="rounded-xl border border-amber-500/15 bg-black/30 p-3">
                <Field label="correlationKey" value={parsedResultFeed.correlationKey} />
                <Field label="winStatus" value={String(parsedResultFeed.winStatus)} />
                <Field label="providerSignalId" value={parsedResultFeed.providerSignalId ?? '—'} />
                <Field label="mesa / ronda" value={`${parsedResultFeed.mesa || '—'} · ${parsedResultFeed.round || '—'}`} />
              </dl>
            ) : (
              <p className="text-xs text-slate-500">Ningún NEW_RESULT en el feed reciente.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
