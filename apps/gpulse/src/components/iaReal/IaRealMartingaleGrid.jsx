import React from 'react';
import {
  PROVIDER_MARTINGALE_STEPS,
  extractVectorForecastArrayFromSignalRaw,
  extractVectorResultadoAndWinFromResultRaw,
  forecastStepIndexFromContador,
  parseVectorWinStep,
  pickContadorMartingalaFromSignalRaw,
} from '../../utils/providerMartingaleRead.js';

/**
 * T1–T6 martingale table: vector_forecast, vector_resultado, vector_win per step (provider fields only).
 * @param {{ martingaleFromStore?: number }} [props]
 */
export function IaRealMartingaleGrid({
  rawSignal,
  rawResult,
  martingaleFromStore,
  visualStepIndex,
  isLightMode,
}) {
  const rs = rawSignal && typeof rawSignal === 'object' && !Array.isArray(rawSignal) ? rawSignal : {};
  const vf = extractVectorForecastArrayFromSignalRaw(rs).map((x) => String(x));
  const contadorFromRaw = pickContadorMartingalaFromSignalRaw(rs);
  const contadorNum = Number(contadorFromRaw);
  const contadorEffective =
    martingaleFromStore != null && Number.isFinite(Number(martingaleFromStore)) && Number(martingaleFromStore) >= 1
      ? Number(martingaleFromStore)
      : contadorNum;
  const contadorLabel =
    Number.isFinite(contadorEffective) && contadorEffective > 0 ? Math.min(6, Math.floor(contadorEffective)) : '—';

  const rr = rawResult && typeof rawResult === 'object' && !Array.isArray(rawResult) ? rawResult : null;
  const { vector_resultado: vrIn, vector_win: vwIn } = rr
    ? extractVectorResultadoAndWinFromResultRaw(rr)
    : { vector_resultado: [], vector_win: [] };

  const activeIdxFromStore =
    martingaleFromStore != null && Number.isFinite(Number(martingaleFromStore)) && Number(martingaleFromStore) >= 1
      ? forecastStepIndexFromContador(martingaleFromStore)
      : null;
  const activeIdx = activeIdxFromStore != null ? activeIdxFromStore : Number(visualStepIndex) || 0;

  const rows = [];
  for (let i = 0; i < PROVIDER_MARTINGALE_STEPS; i++) {
    const pred = vf[i] ?? '—';
    const res = vrIn[i] != null ? String(vrIn[i]) : '—';
    const wtok = vwIn[i];
    const w = parseVectorWinStep(wtok);
    const statusLabel = w === true ? 'WIN' : w === false ? 'LOSS' : '—';
    const isCurrent = i === activeIdx && vf.length > 0;
    rows.push({ step: i + 1, pred, res, statusLabel, win: w, isCurrent });
  }

  const th = isLightMode ? 'text-slate-500 border-slate-200' : 'text-white/45 border-white/10';
  const td = isLightMode ? 'text-slate-800 border-slate-100' : 'text-white/90 border-white/[0.06]';
  const winCls = (w) =>
    w === true
      ? isLightMode
        ? 'text-emerald-700 font-black'
        : 'text-emerald-300 font-black'
      : w === false
        ? isLightMode
          ? 'text-rose-700 font-black'
          : 'text-rose-300 font-black'
        : isLightMode
          ? 'text-slate-400'
          : 'text-white/35';

  return (
    <div
      className={`w-full max-w-lg mx-auto rounded-2xl border overflow-hidden ${isLightMode ? 'border-slate-200 bg-white/90' : 'border-white/10 bg-black/40'}`}
    >
      <div
        className={`flex items-center justify-between px-3 py-2 border-b ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.04]'}`}
      >
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isLightMode ? 'text-slate-600' : 'text-white/55'}`}>
          Martingala T1–T6
        </p>
        <p className={`font-mono text-[10px] ${isLightMode ? 'text-slate-500' : 'text-white/45'}`}>
          contador: <span className={isLightMode ? 'text-slate-800' : 'text-cyan-200/90'}>{String(contadorLabel)}</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] font-mono">
          <thead>
            <tr className={`border-b ${th}`}>
              <th className="px-2 py-1.5 w-10">#</th>
              <th className="px-2 py-1.5">Apuesta</th>
              <th className="px-2 py-1.5">Mesa</th>
              <th className="px-2 py-1.5 w-16">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.step}
                className={`border-b ${td} ${r.isCurrent ? (isLightMode ? 'bg-cyan-500/10 ring-1 ring-cyan-400/25' : 'bg-cyan-500/15 ring-1 ring-cyan-400/20') : ''}`}
              >
                <td
                  className={`px-2 py-1.5 ${isLightMode ? 'text-slate-400' : 'text-white/45'}`}
                >
                  T{r.step}
                </td>
                <td className="px-2 py-1.5 font-black">{r.pred}</td>
                <td className="px-2 py-1.5">{r.res}</td>
                <td className={`px-2 py-1.5 ${winCls(r.win)}`}>{r.statusLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`px-3 py-1.5 text-[9px] ${isLightMode ? 'text-slate-400 bg-slate-50' : 'text-white/35 bg-black/30'}`}>
        Apuesta = vector_forecast · Mesa = vector_resultado · Estado = vector_win (proveedor)
      </p>
    </div>
  );
}
