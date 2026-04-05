import React, { useMemo } from 'react';
import { useGpulseSystem } from '../../context/GpulseContext.jsx';
import { useQueueStats } from '../../hooks/useQueueStats.js';
import { useSystemActions } from '../../hooks/useSystemActions.js';
import { useSystemIntelligenceSnapshot } from '../../hooks/useSystemIntelligence.js';
import {
  setAutoOptimizationEnabled,
  setStrategyOverride,
  setFreezeWeights,
  EXECUTION_STRATEGY,
} from '../../system/systemFeedbackLoop.js';
import {
  MODEL_CONFIDENCE_LOW_THRESHOLD,
  getMetaConfidenceK,
  PREDICTION_DECAY_HALF_LIFE_MS,
} from '../../system/systemMetaConfidence.js';

function fmtTime(ts) {
  if (!Number.isFinite(ts)) return '—';
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '—';
  }
}

function fmtNum(x, d = 3) {
  if (x == null || !Number.isFinite(Number(x))) return '—';
  return Number(x).toFixed(d);
}

/**
 * Operator dashboard: autonomous loop telemetry, queue scale hints, and safe overrides.
 */
export default function SystemIntelligencePanel({
  open,
  onClose,
  isLight = false,
  backendOrigin = '',
  transactions = [],
  queueWaiting = 0,
}) {
  const { systemHealth } = useGpulseSystem();
  const queueStats = useQueueStats(backendOrigin);
  const intel = useSystemIntelligenceSnapshot();
  const {
    confidence,
    modelConfidencePct,
    decisionReasons,
    strategyConfidencePct,
  } = useSystemActions({ transactions, queueWaiting });

  const fb = intel.feedback;
  const pred = confidence || {};
  const err = intel.predictionSummary;

  const card = isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.04]';
  const muted = isLight ? 'text-slate-500' : 'text-white/45';
  const main = isLight ? 'text-slate-900' : 'text-white/90';
  const btn =
    isLight
      ? 'bg-white border-slate-200 text-slate-700 hover:border-cyan-500/50'
      : 'bg-white/5 border-white/10 text-white/80 hover:border-cyan-500/35';

  const overrideValue = fb.strategyOverride == null ? '' : String(fb.strategyOverride);

  const strategyOptions = useMemo(
    () => [
      { id: '', label: '(autonomous)' },
      { id: EXECUTION_STRATEGY.SPEED, label: 'speed' },
      { id: EXECUTION_STRATEGY.BALANCED, label: 'balanced' },
      { id: EXECUTION_STRATEGY.PROTECTION, label: 'protection' },
    ],
    [],
  );

  if (!open) return null;

  return (
    <div className="fixed left-4 bottom-4 z-[72] w-[min(94vw,480px)] max-h-[min(88vh,720px)] flex flex-col">
      <div
        className={`rounded-2xl border backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-full ${
          isLight ? 'bg-white/95 border-slate-200 text-slate-900' : 'bg-[rgba(8,2,22,0.92)] border-white/10 text-white'
        }`}
      >
        <div className={`px-4 py-3 border-b shrink-0 ${isLight ? 'border-slate-200' : 'border-white/10'} flex items-center justify-between gap-3`}>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.32em]">System Intelligence</p>
            <p className={`mt-1 text-[9px] font-mono ${muted}`}>Autonomous loop · queue · confidence</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-colors ${btn}`}
          >
            Close
          </button>
        </div>

        <div className={`p-4 space-y-3 overflow-y-auto custom-scrollbar text-[10px] font-mono ${main}`}>
          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-2`}>Live confidence</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <span className={muted}>congestion P</span>
              <span>{fmtNum(pred.congestionProbability, 4)}</span>
              <span className={muted}>failure P</span>
              <span>{fmtNum(pred.failureProbability, 4)}</span>
              <span className={muted}>stress score</span>
              <span>{pred.systemStressScore != null ? String(pred.systemStressScore) : '—'}</span>
              <span className={muted}>health risk</span>
              <span>{String(systemHealth?.riskLevel ?? '—')}</span>
            </div>
          </div>

          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-2`}>Meta-confidence & explainability</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <span className={muted}>model confidence</span>
              <span className="font-black">
                {modelConfidencePct != null ? `${fmtNum(modelConfidencePct, 1)}%` : '—'}
              </span>
              <span className={muted}>strategy confidence</span>
              <span className="font-black">{strategyConfidencePct != null ? `${strategyConfidencePct}%` : '—'}</span>
              <span className={muted}>calibration floor</span>
              <span>{`${Math.round(MODEL_CONFIDENCE_LOW_THRESHOLD * 100)}%`}</span>
              <span className={muted}>exp(−k·ε) k</span>
              <span>{fmtNum(getMetaConfidenceK(), 2)}</span>
              <span className={muted}>error decay HL</span>
              <span>{`${Math.round(PREDICTION_DECAY_HALF_LIFE_MS / 60_000)} min`}</span>
            </div>
            {modelConfidencePct != null && modelConfidencePct < MODEL_CONFIDENCE_LOW_THRESHOLD * 100 ? (
              <p className={`mt-2 text-[9px] ${isLight ? 'text-amber-800' : 'text-amber-300/90'}`}>
                Safety fallback: autonomy dampened · bias toward safe queue/retry pacing.
              </p>
            ) : null}
            <div className={`mt-3 border-t pt-2 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-1`}>decisionReason</p>
              <ul className="space-y-1 list-disc list-inside">
                {(decisionReasons || []).length === 0 ? (
                  <li className={muted}>—</li>
                ) : (
                  (decisionReasons || []).map((line) => (
                    <li key={line} className="text-[10px] leading-snug">
                      {line}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-2`}>Weights (congestion blend)</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className={muted}>queue</p>
                <p className="font-black mt-0.5">{fmtNum(intel.effectiveWeights.wQueue, 3)}</p>
              </div>
              <div>
                <p className={muted}>delay</p>
                <p className="font-black mt-0.5">{fmtNum(intel.effectiveWeights.wDelay, 3)}</p>
              </div>
              <div>
                <p className={muted}>failure</p>
                <p className="font-black mt-0.5">{fmtNum(intel.effectiveWeights.wFailure, 3)}</p>
              </div>
            </div>
            {fb.freezeWeights ? <p className={`mt-2 ${muted}`}>Frozen snapshot active (inference uses frozen vector).</p> : null}
          </div>

          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-2`}>Adaptive thresholds</p>
            <p>
              medium <span className="font-black">{fmtNum(intel.thresholds.medium, 2)}</span>
              <span className={muted}> · </span>
              high <span className="font-black">{fmtNum(intel.thresholds.high, 2)}</span>
            </p>
          </div>

          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-2`}>Execution strategy</p>
            <p>
              effective <span className="font-black">{intel.executionStrategy}</span>
            </p>
            <p className={`mt-1 ${muted}`}>
              autonomous <span className="font-mono">{intel.autonomousStrategy}</span>
              {fb.strategyOverride != null ? <span> · override ON</span> : null}
            </p>
          </div>

          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-2`}>Queue / scale</p>
            <div className="grid grid-cols-2 gap-2">
              <span className={muted}>waiting</span>
              <span>{String(queueStats.waiting)}</span>
              <span className={muted}>active</span>
              <span>{String(queueStats.active)}</span>
              <span className={muted}>scaleSignal</span>
              <span className="font-black">{String(queueStats.scaleSignal || 'hold')}</span>
            </div>
          </div>

          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-2`}>Prediction vs realized stress</p>
            <p>
              mean |error|{' '}
              <span className="font-black">
                {err.meanErrorPct != null ? `${fmtNum(err.meanErrorPct, 2)}%` : '—'}
              </span>
              <span className={muted}> · n={err.n}</span>
            </p>
            {err.meanCongestionErr != null ? (
              <p className="mt-1">
                <span className={muted}>segment mean |err| — congestion </span>
                <span className="font-black">{fmtNum(err.meanCongestionErr, 3)}</span>
                <span className={muted}> · delay </span>
                <span className="font-black">{fmtNum(err.meanDelayErr, 3)}</span>
                <span className={muted}> · failure </span>
                <span className="font-black">{fmtNum(err.meanFailureErr, 3)}</span>
              </p>
            ) : null}
            <p className={`mt-1 ${muted}`}>predicted ≈ prior snapshot CP · actual = settlement stress proxy (0–1)</p>
            <ul className="mt-2 space-y-1 max-h-[88px] overflow-y-auto custom-scrollbar">
              {intel.predictionRows.length === 0 ? (
                <li className={muted}>No outcomes yet.</li>
              ) : (
                intel.predictionRows.map((r, i) => (
                  <li key={`${r.t}-${i}`} className="flex justify-between gap-2 border-b border-white/5 pb-1">
                    <span className={muted}>{fmtTime(r.t)}</span>
                    <span className="text-right">
                      pred {fmtNum(r.predictedCp, 2)} · act {fmtNum(r.actualStress, 2)} · err {fmtNum(r.errorPct, 1)}%
                      {r.eCongestion != null ? (
                        <span className={muted}>
                          {' '}
                          · c {fmtNum(r.eCongestion, 2)} d {fmtNum(r.eDelay, 2)} f {fmtNum(r.eFailure, 2)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-2`}>Decision trace (audit)</p>
            <ul className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
              {intel.decisionTrace.length === 0 ? (
                <li className={muted}>No settled outcomes yet.</li>
              ) : (
                intel.decisionTrace.map((tr, i) => (
                  <li key={`${tr.t}-dt-${i}`} className="border-b border-white/5 pb-1.5 text-[9px] leading-snug">
                    <div className="flex justify-between gap-2">
                      <span className={muted}>{fmtTime(tr.t)}</span>
                      <span className="font-black">{tr.outcome?.success ? 'success' : 'failure'}</span>
                    </div>
                    <p className={`mt-0.5 ${muted}`}>
                      inputs qw {fmtNum(tr.inputs?.queueWaiting, 1)} · pred cp {fmtNum(tr.inputs?.cpPrior, 2)}
                    </p>
                    <p className={muted}>
                      decision stress {fmtNum(tr.decision?.stressTick, 3)} · err {fmtNum(tr.prediction?.errorPct, 1)}%
                    </p>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-2`}>Weight history</p>
            <ul className="space-y-1 max-h-[72px] overflow-y-auto custom-scrollbar">
              {intel.weightHistory.length === 0 ? (
                <li className={muted}>—</li>
              ) : (
                intel.weightHistory
                  .slice(-10)
                  .reverse()
                  .map((w, i) => (
                    <li key={`${w.t}-w-${i}`} className="flex justify-between gap-2">
                      <span className={muted}>{fmtTime(w.t)}</span>
                      <span className="truncate">
                        q{fmtNum(w.wQueue, 2)} d{fmtNum(w.wDelay, 2)} f{fmtNum(w.wFailure, 2)}
                      </span>
                    </li>
                  ))
              )}
            </ul>
          </div>

          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-2`}>Threshold evolution</p>
            <ul className="space-y-1 max-h-[72px] overflow-y-auto custom-scrollbar">
              {intel.thresholdHistory.length === 0 ? (
                <li className={muted}>—</li>
              ) : (
                intel.thresholdHistory
                  .slice(-10)
                  .reverse()
                  .map((h, i) => (
                    <li key={`${h.t}-th-${i}`} className="flex justify-between gap-2">
                      <span className={muted}>{fmtTime(h.t)}</span>
                      <span>
                        med {fmtNum(h.medium, 2)} · hi {fmtNum(h.high, 2)}
                      </span>
                    </li>
                  ))
              )}
            </ul>
          </div>

          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-2`}>Trend samples</p>
            <ul className="space-y-1 max-h-[72px] overflow-y-auto custom-scrollbar">
              {intel.trendHistory.length === 0 ? (
                <li className={muted}>—</li>
              ) : (
                intel.trendHistory
                  .slice(-12)
                  .reverse()
                  .map((tr, i) => (
                    <li key={`${tr.t}-tr-${i}`} className="flex justify-between gap-2">
                      <span className={muted}>{fmtTime(tr.t)}</span>
                      <span className="font-black">{tr.trend}</span>
                    </li>
                  ))
              )}
            </ul>
          </div>

          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted} mb-2`}>Control</p>
            <label className="flex items-center justify-between gap-3 py-1.5">
              <span>Auto-optimization</span>
              <input
                type="checkbox"
                className="accent-cyan-500"
                checked={fb.autoOptimizationEnabled !== false}
                onChange={(e) => setAutoOptimizationEnabled(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-3 py-1.5">
              <span>Freeze weights</span>
              <input
                type="checkbox"
                className="accent-cyan-500"
                checked={Boolean(fb.freezeWeights)}
                onChange={(e) => setFreezeWeights(e.target.checked)}
              />
            </label>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={muted}>Strategy override</span>
              <select
                value={overrideValue}
                onChange={(e) => setStrategyOverride(e.target.value === '' ? null : e.target.value)}
                className={`max-w-[200px] rounded-lg border px-2 py-1 text-[10px] font-mono outline-none ${
                  isLight ? 'border-slate-200 bg-white' : 'border-white/15 bg-black/40 text-white'
                }`}
              >
                {strategyOptions.map((o) => (
                  <option key={o.id || 'auto'} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <p className={`mt-2 ${muted}`}>
              EMA confirm {fmtNum(fb.emaConfirmMs, 0)}ms · success EMA {fmtNum(fb.emaSuccess, 3)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
