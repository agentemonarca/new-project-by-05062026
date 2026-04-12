import React, { useMemo } from 'react';
import { Radio, History } from 'lucide-react';
import { IaRealMartingaleGrid } from './IaRealMartingaleGrid.jsx';

/**
 * Read-only feed: optional live martingale table from engine, settled history, recent store events.
 *
 * @param {object} [engine] — `iaRealEngineState` from App (same shape as IaRealExecutionLayer).
 */
export function IaRealSignalFeedPanel({ history, recentEvents, isLightMode, engine = null }) {
  const rows = useMemo(() => (Array.isArray(history) ? history.slice(0, 12) : []), [history]);
  const events = useMemo(() => (Array.isArray(recentEvents) ? recentEvents.slice(0, 10) : []), [recentEvents]);

  const card = isLightMode
    ? 'rounded-xl border border-slate-200 bg-white/90'
    : 'rounded-xl border border-white/10 bg-black/30';
  const label = isLightMode ? 'text-slate-500' : 'text-white/45';
  const text = isLightMode ? 'text-slate-800' : 'text-white/90';
  const muted = isLightMode ? 'text-slate-400' : 'text-white/40';

  const martingaleBlock = useMemo(() => {
    if (!engine || typeof engine !== 'object') return null;
    const { status, activeRow, outcomeRow, visualStepIndex } = engine;
    const activeIdx = Number(visualStepIndex) || 0;
    if (activeRow && (status === 'WAITING_RESULT' || status === 'SYNC')) {
      return (
        <IaRealMartingaleGrid
          rawSignal={activeRow.rawSignal}
          rawResult={activeRow.rawResult ?? null}
          martingaleFromStore={activeRow.martingale}
          visualStepIndex={visualStepIndex}
          isLightMode={isLightMode}
        />
      );
    }
    if (outcomeRow && (status === 'RESULT_ANIMATION' || status === 'SUCCESS' || status === 'FAILED')) {
      return (
        <IaRealMartingaleGrid
          rawSignal={(activeRow ?? outcomeRow)?.rawSignal}
          rawResult={outcomeRow.rawResult}
          martingaleFromStore={(activeRow ?? outcomeRow)?.martingale}
          visualStepIndex={activeIdx}
          isLightMode={isLightMode}
        />
      );
    }
    return null;
  }, [engine, isLightMode]);

  return (
    <div className="px-4 pb-4 pt-2 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${label}`}>History · IA Real</span>
        <span className={`inline-flex items-center gap-1 text-[9px] font-mono ${muted}`}>
          <Radio className="h-3 w-3" aria-hidden />
          Tracking
        </span>
      </div>

      {martingaleBlock ? <div className={`${card} p-2 overflow-x-auto`}>{martingaleBlock}</div> : null}

      <div className={`${card} p-3`}>
        <div className="flex items-center gap-2 mb-2">
          <History className={`h-3.5 w-3.5 ${muted}`} aria-hidden />
          <p className={`text-[9px] font-black uppercase tracking-widest ${label}`}>Últimas manos</p>
        </div>
        {rows.length === 0 ? (
          <p className={`text-[10px] font-mono ${muted}`}>Sin resultados aún.</p>
        ) : (
          <ul className={`divide-y ${isLightMode ? 'divide-slate-100' : 'divide-white/10'} max-h-[28vh] overflow-y-auto custom-scrollbar`}>
            {rows.map((r) => (
              <li key={r.id} className={`py-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono ${text}`}>
                <span className="truncate">
                  {String(r.mesa ?? '—')} · R{r.round ?? '—'}
                </span>
                <span
                  className={
                    r.status === 'won'
                      ? isLightMode
                        ? 'text-emerald-700 font-black'
                        : 'text-emerald-300 font-black'
                      : r.status === 'lost'
                        ? isLightMode
                          ? 'text-rose-700 font-black'
                          : 'text-rose-300 font-black'
                        : muted
                  }
                >
                  {r.status === 'won' ? 'WIN' : r.status === 'lost' ? 'LOSS' : String(r.status ?? '—')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`${card} p-3`}>
        <p className={`text-[9px] font-black uppercase tracking-widest ${label} mb-2`}>Eventos recientes</p>
        {events.length === 0 ? (
          <p className={`text-[10px] font-mono ${muted}`}>Sin eventos.</p>
        ) : (
          <ul className="space-y-1 max-h-[22vh] overflow-y-auto custom-scrollbar">
            {events.map((e, idx) => (
              <li key={`${e.ts}-${idx}`} className={`text-[9px] font-mono leading-snug ${muted}`}>
                <span className={isLightMode ? 'text-slate-500' : 'text-white/55'}>{e.type}</span> · {e.summary}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
