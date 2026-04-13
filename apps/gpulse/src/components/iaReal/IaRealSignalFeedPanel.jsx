import React, { useMemo } from 'react';
import { History, Radio } from 'lucide-react';
import { iaRealContadorForStrip } from '../../utils/iaRealEngineUi.js';
import { forecastStepIndexFromContador } from '../../utils/providerMartingaleRead.js';
import { IaRealMartingaleGrid } from './IaRealMartingaleGrid.jsx';

/**
 * Read-only feed: phased header (relay + engine), live martingale when aplicable, history, events.
 *
 * @param {object} [engine] — `iaRealEngineState` from App (same shape as IaRealExecutionLayer).
 * @param {string} [connectionStatus] — `useExternalSignalsStore` `connectionStatus`.
 * @param {number} [pendingSignalCount] — señales `pending` en el store (cola activa).
 */

/**
 * @param {string | undefined} cs
 * @param {{ status?: string } | null | undefined} engine
 * @param {number} pending
 */
function phasePresentation(cs, engine, pending) {
  const st = engine?.status ?? 'IDLE';
  if (cs === 'disabled') {
    return {
      title: 'Relay apagado',
      sub: 'Las señales externas no están activas en esta sesión.',
      badge: 'OFF',
      badgeClass: 'border-white/15 bg-white/5 text-white/45',
    };
  }
  if (cs === 'error') {
    return {
      title: 'Sin conexión al relay',
      sub: 'No llegan eventos del proveedor hasta reconectar.',
      badge: 'ERROR',
      badgeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-200',
    };
  }
  if (cs === 'connecting' || cs === 'reconnecting') {
    return {
      title: cs === 'reconnecting' ? 'Reconectando al relay…' : 'Conectando…',
      sub: 'Estableciendo canal de NEW_SIGNAL / NEW_RESULT.',
      badge: '···',
      badgeClass: 'border-amber-400/35 bg-amber-500/10 text-amber-100',
    };
  }
  if (cs === 'idle') {
    return {
      title: 'Canal inactivo',
      sub: 'Inicializando transporte de señales.',
      badge: '—',
      badgeClass: 'border-white/15 bg-white/5 text-white/45',
    };
  }
  // connected
  if (st === 'IDLE') {
    return {
      title: 'En escucha',
      sub:
        pending > 0
          ? `${pending} señal(es) pendiente(s) en cola.`
          : 'Sin mano activa: cuando llegue NEW_SIGNAL, verás vector y martingala aquí.',
      badge: 'LISTO',
      badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    };
  }
  if (st === 'SYNC') {
    return {
      title: 'Sincronizando con el proveedor',
      sub: 'Validando mesa y predicción antes de la ventana de resultado.',
      badge: 'SYNC',
      badgeClass: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-200',
    };
  }
  if (st === 'WAITING_RESULT') {
    return {
      title: 'Señal recibida — mano en curso',
      sub: 'Esperando NEW_RESULT del relay (resultado de la mesa).',
      badge: 'LIVE',
      badgeClass: 'border-pink-500/35 bg-pink-500/10 text-pink-200',
    };
  }
  if (st === 'RESULT' || st === 'RESULT_SEQUENCE' || st === 'RESULT_ANIMATION') {
    return {
      title: 'Mostrando resultado',
      sub: 'Secuencia visual de cartas / puntajes.',
      badge: 'PLAY',
      badgeClass: 'border-violet-500/35 bg-violet-500/10 text-violet-200',
    };
  }
  if (st === 'SUCCESS') {
    return {
      title: 'Última mano: acierto',
      sub: 'Evaluación favorable respecto a la recomendación.',
      badge: 'WIN',
      badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100',
    };
  }
  if (st === 'FAILED') {
    return {
      title: 'Última mano: sin acierto',
      sub: 'Evaluación no favorable; revisa vector en el historial.',
      badge: 'LOSS',
      badgeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-100',
    };
  }
  return {
    title: 'Panel de señales',
    sub: 'Estado del motor IA Real.',
    badge: '·',
    badgeClass: 'border-white/15 bg-white/5 text-white/45',
  };
}
function roundLabelForRow(r) {
  const v = r?.round ?? r?.ronda;
  if (v == null || v === '') return '—';
  return String(v);
}

/** @param {object} r — fila de `extHistory` (won/lost/intermediate y/o `winStatus`). */
function rowOutcomeKind(r) {
  if (r?.status === 'intermediate') return 'intermediate';
  if (r?.status === 'won' || r?.winStatus === true) return 'won';
  if (r?.status === 'lost' || r?.winStatus === false) return 'lost';
  return null;
}

export function IaRealSignalFeedPanel({
  history,
  recentEvents,
  isLightMode,
  engine = null,
  connectionStatus = 'idle',
  pendingSignalCount = 0,
}) {
  const rows = useMemo(() => (Array.isArray(history) ? history.slice(0, 12) : []), [history]);
  const events = useMemo(() => (Array.isArray(recentEvents) ? recentEvents.slice(0, 10) : []), [recentEvents]);

  const phase = useMemo(
    () => phasePresentation(connectionStatus, engine, pendingSignalCount),
    [connectionStatus, engine, pendingSignalCount],
  );

  const card = isLightMode
    ? 'rounded-xl border border-slate-200 bg-white/90'
    : 'rounded-xl border border-white/10 bg-black/30';
  const label = isLightMode ? 'text-slate-500' : 'text-white/45';
  const text = isLightMode ? 'text-slate-800' : 'text-white/90';
  const muted = isLightMode ? 'text-slate-400' : 'text-white/40';

  const martingaleBlock = useMemo(() => {
    if (!engine || typeof engine !== 'object') return null;
    const { status, activeRow, outcomeRow, phaseVisual } = engine;
    if (activeRow && (status === 'WAITING_RESULT' || status === 'SYNC')) {
      return (
        <IaRealMartingaleGrid
          rawSignal={activeRow.rawSignal}
          rawResult={activeRow.rawResult ?? null}
          martingaleFromStore={iaRealContadorForStrip(activeRow, null, null, status)}
          visualStepIndex={forecastStepIndexFromContador(
            iaRealContadorForStrip(activeRow, null, null, status),
          )}
          isLightMode={isLightMode}
        />
      );
    }
    if (
      outcomeRow &&
      (status === 'RESULT_ANIMATION' ||
        status === 'RESULT' ||
        status === 'RESULT_SEQUENCE' ||
        status === 'SUCCESS' ||
        status === 'FAILED')
    ) {
      const cm = iaRealContadorForStrip(activeRow, outcomeRow, phaseVisual, status);
      return (
        <IaRealMartingaleGrid
          rawSignal={(activeRow ?? outcomeRow)?.rawSignal}
          rawResult={outcomeRow.rawResult}
          martingaleFromStore={cm}
          visualStepIndex={forecastStepIndexFromContador(cm)}
          isLightMode={isLightMode}
        />
      );
    }
    return null;
  }, [engine, isLightMode]);

  return (
    <div className="px-4 pb-4 pt-2 flex flex-col gap-4">
      {/* 1 — Una sola cabecera de fase: relay + motor (no repetir títulos abajo) */}
      <div
        className={`rounded-xl border p-3 ${
          isLightMode ? 'border-slate-200 bg-slate-50/90' : 'border-white/10 bg-white/[0.04]'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${label}`}>Señales IA Real</p>
            <p className={`mt-1 text-sm font-bold leading-snug ${text}`}>{phase.title}</p>
            <p className={`mt-0.5 text-[11px] leading-relaxed ${muted}`}>{phase.sub}</p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${phase.badgeClass}`}
          >
            {phase.badge}
          </span>
        </div>
        <div className={`mt-2 flex items-center gap-1.5 text-[9px] font-mono ${muted}`}>
          <Radio className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          <span>Relay: {String(connectionStatus)}</span>
        </div>
      </div>

      {/* 2 — Solo cuando hay mano / resultado que mostrar en la parrilla */}
      {martingaleBlock ? (
        <div>
          <p className={`mb-1.5 text-[9px] font-black uppercase tracking-widest ${label}`}>Vector en esta mano</p>
          <div className={`${card} p-2 overflow-x-auto`}>{martingaleBlock}</div>
        </div>
      ) : null}

      {/* 3 — Historial compacto */}
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
                  {String(r.mesa ?? '—')} · R{roundLabelForRow(r)}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={
                      rowOutcomeKind(r) === 'won'
                        ? isLightMode
                          ? 'text-emerald-700 font-black'
                          : 'text-emerald-300 font-black'
                        : rowOutcomeKind(r) === 'lost'
                          ? isLightMode
                            ? 'text-rose-700 font-black'
                            : 'text-rose-300 font-black'
                          : rowOutcomeKind(r) === 'intermediate'
                            ? isLightMode
                              ? 'text-amber-700 font-black'
                              : 'text-amber-200 font-black'
                            : muted
                    }
                  >
                    {rowOutcomeKind(r) === 'won'
                      ? 'WIN'
                      : rowOutcomeKind(r) === 'lost'
                        ? 'LOSS'
                        : rowOutcomeKind(r) === 'intermediate'
                          ? `T${Number(r.martingale ?? 1)}`
                          : String(r.status ?? (r.winStatus == null ? '—' : r.winStatus ? 'WIN' : 'LOSS'))}
                  </span>
                  {r.resultIngestSource === 'signal_stream_frame' ? (
                    <span
                      className={`text-[8px] font-bold uppercase tracking-tighter px-1 rounded ${isLightMode ? 'bg-amber-100 text-amber-900' : 'bg-amber-500/25 text-amber-200'}`}
                      title="Resultado ingerido vía signal_stream_frame (paridad con evento NEW_RESULT)"
                    >
                      stream
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`${card} p-3 opacity-[0.92]`}>
        <p className={`text-[9px] font-black uppercase tracking-widest ${label} mb-2`}>
          Actividad del relay
        </p>
        <p className={`mb-2 text-[8px] font-mono ${muted}`}>Últimos eventos del store (NEW_SIGNAL / NEW_RESULT).</p>
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
