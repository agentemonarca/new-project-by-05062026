import React, { useEffect, useMemo, useState } from 'react';

export default function EngineDebugPanel({
  open,
  onClose,
  isLight,
  orchestratorBusy = false,
  phase,
  isActive,
  isDev,
  isDebugEnabled,
  isPaused,
  isStepMode,
  stepRemaining,
  onPause,
  onResume,
  onReset,
  onToggleStepMode,
  onStepOnce,
  onForcePhase,
  snapshotsRef,
  onRestoreSnapshot,
  onReplayActions,
  actionLogRef,
  planRef,
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [open]);

  const snapshot = useMemo(() => {
    // tick is intentionally used only to refresh this snapshot while open
    void tick;
    const logs = Array.isArray(actionLogRef?.current) ? actionLogRef.current : [];
    const last10 = logs.slice(-10).reverse();
    const plan = planRef?.current || null;
    const unknown = last10.some((e) => e && e.known === false);
    const snaps = Array.isArray(snapshotsRef?.current) ? snapshotsRef.current : [];
    return { last10, plan, unknown, snaps: snaps.slice(-20).reverse() };
  }, [tick, actionLogRef, planRef, snapshotsRef]);

  if (!open) return null;

  const panelBg = isLight ? 'bg-white/90 border-slate-200 text-slate-900' : 'bg-[rgba(10,2,30,0.82)] border-white/10 text-white';
  const muted = isLight ? 'text-slate-500' : 'text-white/50';
  const card = isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5';
  const btn =
    isLight
      ? 'bg-white border-slate-200 text-slate-700 hover:border-cyan-400'
      : 'bg-white/5 border-white/10 text-white/75 hover:border-cyan-500/40 hover:bg-cyan-500/10';

  return (
    <div className="fixed right-4 bottom-4 z-[70] w-[min(92vw,420px)]">
      <div className={`rounded-2xl border backdrop-blur-xl shadow-2xl overflow-hidden ${panelBg}`}>
        <div className={`px-4 py-3 border-b ${isLight ? 'border-slate-200' : 'border-white/10'} flex items-center justify-between gap-3`}>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.35em]">Engine Debug</p>
            <p className={`mt-1 text-[9px] font-mono ${muted}`}>
              Visual observability · last 10 actions
              {orchestratorBusy ? <span className="ml-2 text-cyan-400/90">· executeAIFlow…</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${btn}`}
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Controls (dev/debug only) */}
          {isDev && isDebugEnabled ? (
            <div className={`rounded-xl border p-3 ${card}`}>
              <div className="flex items-center justify-between gap-3">
                <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Controls</p>
                <span className={`text-[9px] font-mono ${muted}`}>dev-only</span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" onClick={onPause} className={`h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${btn} ${isPaused ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isPaused}>
                  Pause
                </button>
                <button type="button" onClick={onResume} className={`h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${btn} ${!isPaused ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!isPaused}>
                  Resume
                </button>
                <button type="button" onClick={onReset} className={`h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${btn}`}>
                  Reset
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onToggleStepMode}
                  className={`h-9 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${btn} ${isStepMode ? (isLight ? 'border-amber-300 bg-amber-50' : 'border-amber-500/45 bg-amber-500/10') : ''}`}
                >
                  Step mode {isStepMode ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={onStepOnce}
                  disabled={!isStepMode || !(stepRemaining > 0)}
                  className={`h-9 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${btn} ${(!isStepMode || !(stepRemaining > 0)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Step ({Number(stepRemaining) || 0})
                </button>
              </div>

              <div className="mt-3">
                <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Force phase</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {['STANDBY', 'ANALISIS', 'DETECCION', 'SEÑAL', 'RESULTADO', 'REINICIO'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onForcePhase?.(p)}
                      className={`h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${btn} ${String(phase) === p ? 'opacity-60' : ''}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* Engine status */}
          <div className={`rounded-xl border p-3 ${card}`}>
            <div className="flex items-center justify-between gap-3">
              <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Status</p>
              <span className={`text-[9px] font-mono uppercase tracking-widest ${isActive ? 'text-emerald-500' : (isLight ? 'text-slate-500' : 'text-white/45')}`}>
                {isActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <p className="mt-2 text-[11px] font-mono font-black">Phase: {String(phase)}</p>
            {isPaused ? <p className={`mt-1 text-[9px] font-mono ${muted}`}>Paused</p> : null}
          </div>

          {/* Next phase preview */}
          <div className={`rounded-xl border p-3 ${card}`}>
            <div className="flex items-center justify-between gap-3">
              <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Next phase preview</p>
              <p className={`text-[9px] font-mono ${muted}`}>{snapshot.plan ? 'planned' : '—'}</p>
            </div>
            {snapshot.plan ? (
              <p className="mt-2 text-[11px] font-mono">
                nextPhase <span className="font-black">{String(snapshot.plan.nextPhase ?? '—')}</span> · delay{' '}
                <span className="font-black">{Number(snapshot.plan.delay || 0)}ms</span>
              </p>
            ) : (
              <p className={`mt-2 text-[11px] font-mono ${muted}`}>No plan snapshot available.</p>
            )}
          </div>

          {/* Unknown warning */}
          {snapshot.unknown ? (
            <div className={`rounded-xl border px-3 py-2 text-[10px] font-mono ${
              isLight ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-amber-500/35 bg-amber-950/25 text-amber-200'
            }`}>
              Warning: unknown action detected in the last 10 executions.
            </div>
          ) : null}

          {/* Action stream */}
          <div className={`rounded-xl border p-3 ${card}`}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Action stream</p>
              <p className={`text-[9px] font-mono ${muted}`}>last {snapshot.last10.length}</p>
            </div>
            {snapshot.last10.length === 0 ? (
              <p className={`py-3 text-center text-[10px] font-mono ${muted}`}>No actions yet.</p>
            ) : (
              <ul className={`space-y-2 ${isLight ? '' : 'text-white/90'}`}>
                {snapshot.last10.map((a, idx) => (
                  <li key={`${a.timestamp || 0}-${idx}`} className={`rounded-lg border px-2.5 py-2 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-black/20'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-mono font-black truncate">{String(a.type)}</span>
                      <span className={`text-[9px] font-mono ${muted}`}>
                        {a.timestamp ? new Date(Number(a.timestamp)).toLocaleTimeString() : '—'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className={`text-[9px] font-mono ${muted}`}>phase {String(a.phase || '—')}</span>
                      <span className={`text-[9px] font-mono ${a.known === false ? (isLight ? 'text-amber-700' : 'text-amber-300') : muted}`}>
                        {a.known === false ? 'unknown' : 'ok'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Snapshots (time travel) */}
          {isDev && isDebugEnabled ? (
            <div className={`rounded-xl border p-3 ${card}`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Snapshots</p>
                <p className={`text-[9px] font-mono ${muted}`}>last {snapshot.snaps.length}</p>
              </div>
              {snapshot.snaps.length === 0 ? (
                <p className={`py-3 text-center text-[10px] font-mono ${muted}`}>No snapshots yet.</p>
              ) : (
                <ul className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                  {snapshot.snaps.map((s, idx) => (
                    <li key={`${s.id}-${idx}`} className={`rounded-lg border px-2.5 py-2 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-black/20'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-mono font-black truncate">{String(s.phase)}</span>
                        <span className={`text-[9px] font-mono ${muted}`}>
                          {s.timestamp ? new Date(Number(s.timestamp)).toLocaleTimeString() : '—'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className={`text-[9px] font-mono ${muted}`}>{s.note || 'snapshot'}</span>
                        <button
                          type="button"
                          onClick={() => onRestoreSnapshot?.(s.id)}
                          className={`px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${btn}`}
                        >
                          Restore
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onReplayActions?.(10)}
                  className={`h-9 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${btn}`}
                >
                  Replay last 10 actions
                </button>
                <button
                  type="button"
                  onClick={() => onReplayActions?.(20)}
                  className={`h-9 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${btn}`}
                >
                  Replay 20
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

