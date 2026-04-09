import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { getForensicCycleSnapshot } from '../utils/forensicObservability.js';
import { buildCycleXRaySnapshot } from '../utils/buildCycleXRaySnapshot.js';
import { getEffectiveMesaId, useLabStore } from '../store/useLabStore.js';
import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';
import { useValidationStore } from '../store/useValidationStore.js';

function fmtTs(ms) {
  if (ms == null || typeof ms !== 'number') return '—';
  return new Date(ms).toLocaleTimeString(undefined, { hour12: false });
}

function SideCard({ title, tone, children }) {
  const border =
    tone === 'green'
      ? 'border-emerald-500/35 shadow-[0_0_20px_rgba(16,185,129,0.12)]'
      : tone === 'amber'
        ? 'border-amber-500/35 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
        : tone === 'red'
          ? 'border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.12)]'
          : 'border-cyan-500/30 shadow-[0_0_18px_rgba(34,211,238,0.1)]';
  return (
    <div className={`rounded-xl border bg-black/40 p-3 ${border}`}>
      <h4 className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</h4>
      <div className="mt-2 font-mono text-[10px] leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}

function MagicRow({ ok, label }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] text-slate-300">
      <span className={ok ? 'text-emerald-400' : 'text-rose-400'}>{ok ? '✔' : '✗'}</span>
      <span>{label}</span>
    </div>
  );
}

export default function CycleXRayPanel() {
  const open = useGpulseLabUiStore((s) => s.cycleXRayOpen);
  const target = useGpulseLabUiStore((s) => s.cycleXRayTarget);
  const closeCycleXRay = useGpulseLabUiStore((s) => s.closeCycleXRay);

  const mesas = useLabStore((s) => s.mesas);
  const selectedMesaId = useLabStore((s) => s.selectedMesaId);
  const cycleStartedAt = useLabStore((s) => s.cycleStartedAt);
  const signalTs = useLabStore((s) => s.signalTs);
  const bettingEndsAt = useLabStore((s) => s.bettingEndsAt);
  const lifecycleState = useLabStore((s) => s.lifecycleState);

  const cycles = useValidationStore((s) => s.cycles);

  const effectiveMesa = useMemo(() => {
    const tid = target?.mesaId != null && String(target.mesaId).trim() !== '' ? String(target.mesaId).trim() : null;
    if (tid && mesas[tid]) return tid;
    return getEffectiveMesaId(mesas, selectedMesaId);
  }, [target?.mesaId, mesas, selectedMesaId]);

  const labMesaRow = effectiveMesa && mesas[effectiveMesa] ? mesas[effectiveMesa] : null;

  const snap = useMemo(
    () =>
      buildCycleXRaySnapshot({
        validationCycles: cycles,
        mesaId: effectiveMesa,
        labMesaRow,
        labLifecycle: { cycleStartedAt, signalTs, bettingEndsAt, lifecycleState },
        forensicSnapshot: effectiveMesa ? getForensicCycleSnapshot(effectiveMesa) : null,
        explicitCorrelationKey: target?.correlationKey != null ? String(target.correlationKey) : null,
        explicitCycleId: target?.cycleId != null ? String(target.cycleId) : null,
      }),
    [
      cycles,
      effectiveMesa,
      labMesaRow,
      cycleStartedAt,
      signalTs,
      bettingEndsAt,
      lifecycleState,
      target?.correlationKey,
      target?.cycleId,
    ],
  );

  const { signalSide, resultSide, correlation, resync, timeline, magic, validationCycle: vc } = snap;

  const sigTone =
    correlation.flags.roundMismatch || correlation.flags.missingKey || correlation.flags.differentCorrelationKey
      ? 'red'
      : 'cyan';
  const resTone = correlation.status === 'MISMATCH' ? 'red' : correlation.status === 'RESYNC' ? 'amber' : 'green';

  const t0 = timeline.signalAt;
  const tBet = timeline.bettingClosedAt;
  const tRes = timeline.resultAt;
  const spanMs = t0 != null && tRes != null && tRes > t0 ? tRes - t0 : null;
  const betPct = spanMs != null && spanMs > 0 ? Math.min(100, (10_000 / spanMs) * 100) : 18;
  const waitPct = spanMs != null && spanMs > 0 ? Math.max(0, 100 - betPct) : 55;

  /* Portal a document.body: el layout admin (.admin-content) usa overflow-y-auto y
   * atrapaba el fixed + z-index; así el panel queda por encima de mesa y dock. */
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="xray"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 32, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="fixed inset-x-3 bottom-3 z-[130] max-h-[min(82vh,720px)] overflow-hidden rounded-2xl border border-cyan-500/25 bg-zinc-950/95 shadow-[0_0_48px_rgba(34,211,238,0.14)] ring-1 ring-white/[0.06] sm:inset-x-6"
          aria-label="Cycle X-Ray"
        >
          <div className="flex max-h-[min(82vh,720px)] flex-col">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-cyan-500/15 bg-gradient-to-r from-cyan-950/40 via-black/80 to-violet-950/30 px-4 py-3">
              <div>
                <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200/95">🔬 Cycle X-Ray</h3>
                <p className="mt-0.5 font-mono text-[9px] text-slate-500">
                  Mesa {effectiveMesa ?? '—'} · {correlation.label} {vc?.correlationKey ? `· ${String(vc.correlationKey)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCycleXRay}
                className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar X-Ray"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <SideCard title="[A] SIGNAL DATA" tone={sigTone}>
                  <ul className="list-none space-y-1">
                    <li>
                      <span className="text-slate-500">mesa:</span> {signalSide.mesa ?? '—'}
                    </li>
                    <li>
                      <span className="text-slate-500">round:</span> {signalSide.round != null ? String(signalSide.round) : '—'}
                    </li>
                    <li>
                      <span className="text-slate-500">correlationKey:</span>{' '}
                      <span className={correlation.flags.differentCorrelationKey ? 'text-rose-300' : 'text-cyan-200/90'}>
                        {signalSide.correlationKey}
                      </span>
                    </li>
                    <li>
                      <span className="text-slate-500">recommendation:</span> {signalSide.recommendation != null ? String(signalSide.recommendation) : '—'}
                    </li>
                    <li>
                      <span className="text-slate-500">t (lab signal):</span> {fmtTs(signalSide.timestamp)}
                    </li>
                  </ul>
                  {correlation.flags.roundMismatch ? <p className="mt-2 text-rose-400/90">❌ Desfase de round vs validación</p> : null}
                  {correlation.flags.missingKey ? <p className="mt-2 text-rose-400/90">❌ Falta clave de correlación</p> : null}
                </SideCard>

                <SideCard title="[B] RESULT DATA" tone={resTone}>
                  <ul className="list-none space-y-1">
                    <li>
                      <span className="text-slate-500">mesa:</span> {resultSide.mesa ?? '—'}
                    </li>
                    <li>
                      <span className="text-slate-500">round:</span> {resultSide.round != null ? String(resultSide.round) : '—'}
                    </li>
                    <li>
                      <span className="text-slate-500">correlationKey:</span>{' '}
                      <span className={correlation.flags.differentCorrelationKey ? 'text-rose-300' : 'text-emerald-200/90'}>
                        {resultSide.correlationKey}
                      </span>
                    </li>
                    <li>
                      <span className="text-slate-500">ganador:</span> {resultSide.ganador != null ? String(resultSide.ganador) : '—'}
                    </li>
                    <li>
                      <span className="text-slate-500">t (resultado):</span> {fmtTs(resultSide.timestamp)}
                    </li>
                  </ul>
                </SideCard>
              </div>

              <div className="mt-4 rounded-xl border border-violet-500/25 bg-violet-950/20 p-3 shadow-[0_0_24px_rgba(139,92,246,0.08)]">
                <h4 className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">[C] CORRELATION</h4>
                <dl className="mt-3 grid gap-2 font-mono text-[10px] text-slate-300 sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">SIGNAL</dt>
                    <dd className="break-all text-cyan-200/90">{correlation.signalKey}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">RESULT</dt>
                    <dd className="break-all text-amber-200/85">{correlation.resultKey}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">RESOLVED</dt>
                    <dd className="break-all text-emerald-200/90">{correlation.resolvedKey}</dd>
                  </div>
                </dl>
                <p
                  className={`mt-3 font-mono text-[11px] font-semibold ${
                    correlation.status === 'MATCH'
                      ? 'text-emerald-400'
                      : correlation.status === 'RESYNC' || correlation.status === 'ROUND_ADJ'
                        ? 'text-amber-300'
                        : 'text-rose-400'
                  }`}
                >
                  {correlation.label}
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-cyan-500/20 bg-black/35 p-3">
                <h4 className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-400/80">[D] TIMELINE</h4>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 font-mono text-[9px] text-slate-500">
                    <span>NEW_SIGNAL → {fmtTs(t0)}</span>
                    <span className="text-slate-600">|</span>
                    <span>BETTING_END → {fmtTs(tBet)} (~+10s)</span>
                    <span className="text-slate-600">|</span>
                    <span>NEW_RESULT → {fmtTs(tRes)}</span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-lg bg-black/60 ring-1 ring-cyan-500/20">
                    <motion.div
                      className="h-full shrink-0 rounded-l bg-gradient-to-r from-cyan-500/85 to-cyan-400/45"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(4, betPct))}%` }}
                      transition={{ duration: 0.65, ease: 'easeOut' }}
                      title="Ventana apuestas ~10s"
                    />
                    <motion.div
                      className="h-full min-w-[8%] flex-1 rounded-r bg-gradient-to-r from-amber-500/45 to-violet-500/55"
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      title="Espera resultado"
                    />
                  </div>
                  <p className="font-mono text-[10px] text-slate-400">
                    [ SIGNAL ] ──── ~10s ──── [ BETTING_CLOSED ] ────────── [ {tRes ? 'RESULT' : 'WAIT…'} ]
                    {timeline.totalDelayMs != null ? (
                      <span className="ml-2 text-cyan-300/90">· totalDelay {(timeline.totalDelayMs / 1000).toFixed(2)}s</span>
                    ) : (
                      <span className="ml-2 text-slate-500">· totalDelay —</span>
                    )}
                  </p>
                  {resync.applied ? (
                    <p className="font-mono text-[9px] text-amber-300/90">
                      ◆ resync: reconstrucción antes de emitir · ver sección [E]
                    </p>
                  ) : null}
                </div>
              </div>

              {resync.applied ? (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/25 p-3 shadow-[0_0_24px_rgba(245,158,11,0.1)]">
                  <h4 className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">[E] RESYNC · 🧠 ACTIVADO</h4>
                  <p className="mt-2 font-mono text-[10px] leading-relaxed text-amber-100/90">{resync.narrative}</p>
                  {resync.qualityLine ? (
                    <p
                      className={`mt-2 font-mono text-[10px] font-semibold ${
                        resync.quality === 'HIGH'
                          ? 'text-emerald-300/95'
                          : resync.quality === 'LOW'
                            ? 'text-rose-300/95'
                            : 'text-amber-200/95'
                      }`}
                    >
                      🧠 Calidad recuperación: {resync.qualityLine}
                    </p>
                  ) : null}
                  {resync.qualityInvestigate ? (
                    <p className="mt-1 font-mono text-[9px] text-amber-100/80">{resync.qualityInvestigate}</p>
                  ) : null}
                  {resync.meta ? (
                    <ul className="mt-2 list-none space-y-1 font-mono text-[9px] text-amber-200/80">
                      <li>
                        <span className="text-slate-500">originalSignalKey:</span> {String(resync.meta.originalSignalKey ?? 'null')}
                      </li>
                      <li>
                        <span className="text-slate-500">resultKeyFromPayload:</span> {String(resync.meta.resultKeyFromPayload ?? '—')}
                      </li>
                      <li>
                        <span className="text-slate-500">syntheticSignalKey:</span> {String(resync.meta.syntheticSignalKey ?? '—')}
                      </li>
                      <li>
                        <span className="text-slate-500">resolvedKeyAfterMiddleware:</span>{' '}
                        {String(resync.meta.resolvedKeyAfterMiddleware ?? '—')}
                      </li>
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-3">
                <h4 className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-300/85">🧠 Magic questions</h4>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <MagicRow ok={magic.signalArrived} label="¿Signal llegó?" />
                  <MagicRow ok={magic.resultArrived} label="¿Result llegó?" />
                  <MagicRow ok={magic.correlated} label="¿Se correlacionaron?" />
                  <MagicRow ok={magic.resyncApplied} label="¿Se aplicó resync?" />
                  <MagicRow ok={magic.cycleValid} label="¿El ciclo es válido?" />
                </div>
              </div>

              {snap.forensic && (safeLen(snap.forensic.outside) > 0 || safeLen(snap.forensic.inside) > 0) ? (
                <details className="mt-4 rounded-lg border border-white/[0.06] bg-black/30 p-2">
                  <summary className="cursor-pointer font-mono text-[9px] text-slate-500">Forensic · socket vs middleware (reciente)</summary>
                  <pre className="mt-2 max-h-32 overflow-auto text-[8px] text-slate-600">
                    {JSON.stringify({ outside: snap.forensic.outside, inside: snap.forensic.inside }, null, 2)}
                  </pre>
                </details>
              ) : null}

              <details className="mt-2 rounded-lg border border-white/[0.06] bg-black/30 p-2">
                <summary className="cursor-pointer font-mono text-[9px] text-slate-500">🧪 Debug JSON</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[8px] text-slate-600">
                  {JSON.stringify(
                    {
                      rawSignal: labMesaRow?.supplierLastRawSignal ?? null,
                      rawResult: labMesaRow?.supplierLastRawResult ?? null,
                      merged: labMesaRow
                        ? {
                            round: labMesaRow.round,
                            recommendation: labMesaRow.recommendation,
                            ganador: labMesaRow.ganador,
                            intelSignalTs: labMesaRow.intelSignalTs,
                            intelResultTs: labMesaRow.intelResultTs,
                            currentCycleHistory: labMesaRow?.currentCycleHistory,
                          }
                        : null,
                      validationCycle: vc,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function safeLen(v) {
  return Array.isArray(v) ? v.length : 0;
}
