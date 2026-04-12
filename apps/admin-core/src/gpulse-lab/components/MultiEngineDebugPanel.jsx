import React, { useCallback, useMemo } from 'react';
import { Cpu } from 'lucide-react';
import { useExecutionEngineStore } from '../store/useExecutionEngineStore.js';
import {
  createEmptyMesaState,
  getEffectiveMesaId,
  useLabStore,
} from '../store/useLabStore.js';
import { normalizeCorrelationKey, parseLabCorrelationKeyParts } from '../utils/labCorrelationKey.js';
import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';

/** @param {unknown} pred */
function predictionShort(pred) {
  if (pred == null || String(pred).trim() === '') return '—';
  const u = String(pred).trim().toUpperCase();
  if (u === 'P' || u.startsWith('PLAY')) return 'P';
  if (u === 'B' || u.startsWith('BANK')) return 'B';
  if (u === 'T' || u.startsWith('TIE') || u.startsWith('EMP')) return 'T';
  return String(pred).slice(0, 8);
}

/** @param {string} st */
function statusRank(st) {
  if (st === 'RUNNING') return 0;
  if (st === 'SUCCESS') return 1;
  if (st === 'FAILED') return 2;
  return 3;
}

/**
 * @param {unknown} history
 * @returns {{
 *   historyLength: number,
 *   successRate: number | null,
 *   lastWl: 'WIN' | 'LOSS' | null,
 * }}
 */
function engineHistoryStats(history) {
  const h = Array.isArray(history) ? history : [];
  const total = h.length;
  const wins = h.reduce((n, e) => (e && e.status === 'WIN' ? n + 1 : n), 0);
  const last = total > 0 ? h[total - 1] : null;
  const lastStatus = last && (last.status === 'WIN' || last.status === 'LOSS') ? last.status : null;
  const successRate = total > 0 ? wins / total : null;
  return {
    historyLength: total,
    successRate,
    lastWl: lastStatus,
  };
}

/** @param {number | null} rate */
function successRateToneClass(rate) {
  if (rate == null || !Number.isFinite(rate)) return 'text-slate-500';
  if (rate >= 0.6) return 'text-emerald-400';
  if (rate >= 0.35) return 'text-amber-400';
  return 'text-rose-400';
}

/**
 * Lists every engine in `engineMap` for ops/debug; click focuses CenterPanel on that correlation.
 * @param {{ variant?: 'default' | 'dock' }} p
 */
export default function MultiEngineDebugPanel({ variant = 'dock' }) {
  const engineMap = useExecutionEngineStore((s) => s.engineMap);
  const mesas = useLabStore((s) => s.mesas);
  const selectedMesaId = useLabStore((s) => s.selectedMesaId);
  const focusMesaForEngineView = useLabStore((s) => s.focusMesaForEngineView);

  const effectiveId = useMemo(() => getEffectiveMesaId(mesas, selectedMesaId), [mesas, selectedMesaId]);
  const row = useMemo(
    () => (effectiveId ? mesas[effectiveId] : createEmptyMesaState()),
    [mesas, effectiveId],
  );

  const selectedCorrelationKey = useMemo(
    () => normalizeCorrelationKey(null, row.mesa ?? effectiveId, row.round),
    [row.mesa, row.round, effectiveId],
  );

  const rows = useMemo(() => {
    return Object.entries(engineMap)
      .map(([ck, st]) => ({ ck, st }))
      .sort((a, b) => {
        const ra = statusRank(String(a.st.status));
        const rb = statusRank(String(b.st.status));
        if (ra !== rb) return ra - rb;
        return a.ck.localeCompare(b.ck);
      });
  }, [engineMap]);

  const onFocus = useCallback(
    (ck) => {
      const st = engineMap[ck];
      const parts = parseLabCorrelationKeyParts(ck);
      const mesaRaw = st?.mesa != null && String(st.mesa).trim() !== '' ? String(st.mesa).trim() : null;
      const mesaId = mesaRaw ?? parts?.mesaId ?? null;
      const round =
        st?.round != null && String(st.round).trim() !== '' ? String(st.round).trim() : parts?.round ?? null;
      if (!mesaId) return;
      focusMesaForEngineView({ mesaId, round });
      useGpulseLabUiStore.getState().setHighlightMesa(mesaId, 1800);
    },
    [engineMap, focusMesaForEngineView],
  );

  const shell =
    variant === 'dock'
      ? 'rounded-xl border border-emerald-500/15 bg-gradient-to-br from-zinc-950/85 via-black/75 to-emerald-950/10 p-3 ring-1 ring-emerald-500/10 sm:p-4'
      : 'mt-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-zinc-950/90 via-black/80 to-emerald-950/15 p-4 sm:p-5';

  return (
    <section className={shell} aria-label="Multi-engine debug">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200/90">
          <Cpu className="h-3.5 w-3.5 text-emerald-400/90" aria-hidden />
          Engines activos
        </h2>
        <p className="max-w-xl font-mono text-[9px] text-slate-500">
          Mesa · ronda · estado · paso · pred · último W/L · historial · % acierto. Clic enfoca el motor central.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="font-mono text-[10px] text-slate-600">Sin motores en `engineMap` (esperando señales).</p>
      ) : (
        <div className="custom-scrollbar max-h-[min(36vh,22rem)] overflow-auto rounded-lg border border-white/[0.06] bg-black/25">
          <table className="w-full min-w-[720px] border-collapse text-left font-mono text-[10px]">
            <thead className="sticky top-0 z-[1] bg-zinc-950/95 backdrop-blur">
              <tr className="border-b border-white/[0.08] text-[9px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-2 font-semibold">Mesa</th>
                <th className="px-2 py-2 font-semibold">Round</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold">Step</th>
                <th className="px-2 py-2 font-semibold">Pred</th>
                <th className="px-2 py-2 font-semibold" title="Último resultado del historial (WIN/LOSS)">
                  Último
                </th>
                <th className="px-2 py-2 font-semibold" title="Entradas en history">
                  #Hist
                </th>
                <th className="px-2 py-2 font-semibold" title="Wins / pasos con resultado">
                  %OK
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ ck, st }) => {
                const mesa = st.mesa != null && String(st.mesa).trim() !== '' ? String(st.mesa) : '—';
                const round = st.round != null && String(st.round).trim() !== '' ? String(st.round) : '—';
                const status = st.status != null ? String(st.status) : '—';
                const step =
                  typeof st.currentStep === 'number' && Number.isFinite(st.currentStep)
                    ? `${st.currentStep}/${typeof st.maxSteps === 'number' ? st.maxSteps : '—'}`
                    : '—';
                const pred = predictionShort(st.prediction);
                const { historyLength, successRate, lastWl } = engineHistoryStats(st.history);
                const ratePct =
                  successRate != null ? `${Math.round(successRate * 100)}%` : '—';
                const rateCls = successRateToneClass(successRate);
                const lastBadge =
                  lastWl === 'WIN' ? (
                    <span className="inline-flex min-w-[1.75rem] justify-center rounded border border-emerald-500/45 bg-emerald-950/50 font-bold text-emerald-300">
                      W
                    </span>
                  ) : lastWl === 'LOSS' ? (
                    <span className="inline-flex min-w-[1.75rem] justify-center rounded border border-rose-500/45 bg-rose-950/50 font-bold text-rose-300">
                      L
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  );
                const focused = selectedCorrelationKey != null && ck === selectedCorrelationKey;
                const statusCls =
                  status === 'RUNNING'
                    ? 'text-cyan-300'
                    : status === 'SUCCESS'
                      ? 'text-emerald-300'
                      : status === 'FAILED'
                        ? 'text-rose-300'
                        : 'text-slate-400';
                return (
                  <tr
                    key={ck}
                    role="button"
                    tabIndex={0}
                    title={`${ck} · ${historyLength} pasos · ${ratePct}`}
                    onClick={() => onFocus(ck)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onFocus(ck);
                      }
                    }}
                    className={`cursor-pointer border-b border-white/[0.05] transition hover:bg-emerald-500/10 ${
                      focused ? 'bg-cyan-500/15 ring-1 ring-inset ring-cyan-500/30' : ''
                    }`}
                  >
                    <td className="px-2 py-1.5 text-cyan-100/95">{mesa}</td>
                    <td className="px-2 py-1.5 text-slate-300">{round}</td>
                    <td className={`px-2 py-1.5 font-semibold ${statusCls}`}>{status}</td>
                    <td className="px-2 py-1.5 text-slate-400">{step}</td>
                    <td className="px-2 py-1.5 font-bold text-indigo-200/95">{pred}</td>
                    <td className="px-2 py-1.5">{lastBadge}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-400">{historyLength}</td>
                    <td className={`px-2 py-1.5 font-semibold tabular-nums ${rateCls}`}>{ratePct}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
