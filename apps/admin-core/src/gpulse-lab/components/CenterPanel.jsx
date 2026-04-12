import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  History,
  Play,
  Square,
  RefreshCw,
  Cpu,
  Activity,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  X,
  LayoutGrid,
  Layers,
  Eye,
  Crosshair,
  Box,
  TrendingUp,
  TrendingDown,
  Maximize2,
  Settings,
  WifiOff,
} from 'lucide-react';
import {
  createEmptyMesaState,
  getEffectiveMesaId,
  LAB_LIFECYCLE_LABELS,
  LAB_LIFECYCLE_STATES,
  useLabStore,
} from '../store/useLabStore.js';
import { getAdaptiveStreamDeadlineMs, getStreamDelayStatsForMesa } from '../store/useValidationStore.js';
import { useAlertStore } from '../store/useAlertStore.js';
import { computeIntelligentWaitingUx } from '../utils/intelligentWaitingUx.js';
import { useBaccaratLiveDealEngine } from '../hooks/useBaccaratLiveDealEngine.js';
import { normalizeOutcomeCell } from '../utils/baccaratIntelligence.js';
import { validateUIUXState } from '../utils/uiUxValidator.js';
import { validateUIFlow, UI_FLOW_STATES } from '../utils/uiFlowValidator.js';
import { monitorProviderTruth } from '../utils/providerTruthMonitor.js';
import { computeAndAlertTrace } from '../utils/forensicObservability.js';
import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';
import { useEngineRenderForensic } from '../hooks/useEngineRenderForensic.js';
import { replayFold } from '../engine/executionReplay.js';
import { selectEngineForDisplay, useExecutionEngineStore } from '../store/useExecutionEngineStore.js';
import { useExecutionReplayStore } from '../store/useExecutionReplayStore.js';
import { normalizeCorrelationKey } from '../utils/labCorrelationKey.js';
import ExecutionReplayBar from './ExecutionReplayBar.jsx';
import { detectAndPreventPreFailure } from '../utils/preFailureDetector.js';
import { padForecastVector } from '../engine/executionEngine.js';
import {
  forecastStepIndexFromContador,
  mapForecastAtStep,
  recommendationFromForecastCell,
} from '../../utils/forecastMartingaleStep.js';

/** Títulos modo casino (es) + fallback inglés en store */
const TITLE_BY_LIFECYCLE = {
  [LAB_LIFECYCLE_STATES.IDLE]: 'ANALIZANDO…',
  [LAB_LIFECYCLE_STATES.WARMUP]: 'CALENTANDO MESA…',
  [LAB_LIFECYCLE_STATES.WAITING_SIGNAL]: 'ESPERANDO SEÑAL',
  [LAB_LIFECYCLE_STATES.SIGNAL_DETECTED]: 'SEÑAL DETECTADA',
  [LAB_LIFECYCLE_STATES.BETTING_PHASE]: 'APUESTAS ABIERTAS',
  [LAB_LIFECYCLE_STATES.BETTING_CLOSED]: 'APUESTAS CERRADAS',
  [LAB_LIFECYCLE_STATES.WAITING_RESULT]: 'REPARTIENDO',
  [LAB_LIFECYCLE_STATES.STREAM_INTERRUPTED]: 'EN VIGILANCIA',
  [LAB_LIFECYCLE_STATES.RESULT_RECEIVED]: 'RESULTADO',
  [LAB_LIFECYCLE_STATES.CYCLE_COMPLETE]: 'MANO CERRADA',
};

/** Mensajes por tiempo transcurrido + badge vs tiempo medio de la mesa (WAITING_RESULT / cierre). */
function getWaitingElapsedFeedback(elapsedMs, avgDelayMs) {
  const elapsedSec = elapsedMs / 1000;
  let tierMessage;
  if (elapsedSec < 15) {
    tierMessage = 'Esperando resultado de la mesa...';
  } else if (elapsedSec <= 30) {
    tierMessage = 'Procesando jugada...';
  } else {
    tierMessage = 'Resultado inminente...';
  }

  let progressBadge;
  if (typeof avgDelayMs === 'number' && Number.isFinite(avgDelayMs) && avgDelayMs > 0) {
    if (elapsedMs < avgDelayMs) {
      progressBadge = {
        emoji: '🟢',
        label: 'Normal',
        className: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-100/95',
      };
    } else if (elapsedMs < avgDelayMs + 15_000) {
      progressBadge = {
        emoji: '🟡',
        label: 'Procesando',
        className: 'border-amber-500/40 bg-amber-500/12 text-amber-100/95',
      };
    } else {
      progressBadge = {
        emoji: '🔴',
        label: 'Lenta',
        className: 'border-rose-500/40 bg-rose-500/12 text-rose-100/95',
      };
    }
  } else {
    if (elapsedSec < 15) {
      progressBadge = {
        emoji: '🟢',
        label: 'Normal',
        className: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-100/95',
      };
    } else if (elapsedSec <= 30) {
      progressBadge = {
        emoji: '🟡',
        label: 'Procesando',
        className: 'border-amber-500/40 bg-amber-500/12 text-amber-100/95',
      };
    } else {
      progressBadge = {
        emoji: '🔴',
        label: 'Lenta',
        className: 'border-rose-500/40 bg-rose-500/12 text-rose-100/95',
      };
    }
  }

  return { tierMessage, progressBadge, elapsedSec };
}

/** @param {number | null} elapsedMs @param {unknown} avgDelayMs */
function computeWaitIntelligenceStatus(elapsedMs, avgDelayMs) {
  if (elapsedMs == null || !Number.isFinite(elapsedMs)) {
    return { text: '—', color: 'text-slate-400' };
  }
  const avg = typeof avgDelayMs === 'number' && Number.isFinite(avgDelayMs) && avgDelayMs > 0 ? avgDelayMs : null;
  if (avg == null) return { text: 'NORMAL', color: 'text-emerald-400' };
  if (elapsedMs < avg) return { text: 'NORMAL', color: 'text-emerald-400' };
  if (elapsedMs < avg * 1.5) return { text: 'EXTENDED', color: 'text-amber-400' };
  return { text: 'CRITICAL', color: 'text-red-400' };
}

/** @param {unknown} raw */
function adaptCardPlaying(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = /** @type {Record<string, unknown>} */ (raw);
    const val = o.val ?? o.value ?? o.rank ?? o.card ?? '?';
    let suit = o.symbol ?? o.suit ?? o.palo ?? '♠';
    const s = String(suit);
    suit = ['♥', '♦', '♣', '♠'].includes(s) ? s : '♠';
    return { value: String(val).toUpperCase(), suit };
  }
  return null;
}

/**
 * @param {unknown} raw
 * @returns {{
 *   playerCards: unknown[],
 *   bankerCards: unknown[],
 *   playerScore: number | null,
 *   bankerScore: number | null,
 *   winner: 'PLAYER' | 'BANKER' | 'TIE' | null,
 * } | null}
 */
function normalizeMesaInfo(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const mi = /** @type {Record<string, unknown>} */ (raw);
  const playerCards =
    mi.player_cards ??
    mi.cartas_player ??
    mi.PlayerCards ??
    mi.playerCards ??
    mi.player;
  const bankerCards =
    mi.banker_cards ??
    mi.cartas_banker ??
    mi.BankerCards ??
    mi.bankerCards ??
    mi.banker;
  const pc = Array.isArray(playerCards) ? playerCards : [];
  const bc = Array.isArray(bankerCards) ? bankerCards : [];
  const hasCards = pc.length > 0 || bc.length > 0;
  const hasWinner = mi.ganador != null || mi.winner != null || mi.resultado != null;
  const ps0 = mi.player_score ?? mi.puntaje_player ?? mi.puntaje_Player ?? mi.playerScore;
  const bs0 = mi.banker_score ?? mi.puntaje_banker ?? mi.puntaje_Banker ?? mi.bankerScore;
  const hasScores =
    (typeof ps0 === 'number' && Number.isFinite(ps0)) ||
    (typeof bs0 === 'number' && Number.isFinite(bs0)) ||
    (ps0 != null && String(ps0).trim() !== '') ||
    (bs0 != null && String(bs0).trim() !== '');
  if (!hasCards && !hasWinner && !hasScores) return null;
  const ps = ps0;
  const bs = bs0;
  const playerScore =
    typeof ps === 'number' && Number.isFinite(ps) ? ps : ps != null && String(ps).trim() !== '' ? Number(ps) : null;
  const bankerScore =
    typeof bs === 'number' && Number.isFinite(bs) ? bs : bs != null && String(bs).trim() !== '' ? Number(bs) : null;
  const winnerRaw = mi.ganador ?? mi.winner ?? mi.resultado ?? null;
  const winner = winnerToPlayerBanker(winnerRaw);
  return {
    playerCards: pc,
    bankerCards: bc,
    playerScore: playerScore != null && Number.isFinite(playerScore) ? playerScore : null,
    bankerScore: bankerScore != null && Number.isFinite(bankerScore) ? bankerScore : null,
    winner,
  };
}

/** @param {unknown} w */
function winnerToPlayerBanker(w) {
  if (w == null) return null;
  const u = String(w).toUpperCase();
  if (u === 'P' || u.includes('PLAY')) return 'PLAYER';
  if (u === 'B' || u.includes('BANK')) return 'BANKER';
  if (u === 'T' || u.includes('TIE') || u.includes('EMP')) return 'TIE';
  return null;
}

/** Predicción del motor de ejecución → etiqueta PatternTracker */
function trackerLabelFromEnginePrediction(pred) {
  if (pred == null) return null;
  return winnerToPlayerBanker(pred);
}

function GlassPanel({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-indigo-500/20 bg-slate-900/40 shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

function NeonButton({ children, onClick, variant = 'primary', className = '', type = 'button' }) {
  const baseStyle =
    'flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-bold shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all duration-300 active:scale-95';
  const variants = {
    primary:
      'border border-blue-400/50 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_0_25px_rgba(59,130,246,0.6)]',
    danger:
      'border border-red-400/50 bg-gradient-to-r from-red-600 to-pink-600 text-white hover:from-red-500 hover:to-pink-500 hover:shadow-[0_0_25px_rgba(239,68,68,0.6)]',
    outline:
      'border border-indigo-500/50 bg-transparent text-indigo-300 hover:bg-indigo-500/10 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]',
    ghost: 'border border-transparent bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white',
  };
  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function PlayingCard({ card, type, isDealt }) {
  if (!card) {
    return (
      <div className="flex h-36 w-24 items-center justify-center rounded-xl border-2 border-dashed border-slate-600/50 bg-slate-800/30 shadow-inner backdrop-blur-md">
        <div className="h-8 w-8 rounded-full border border-slate-600/30" />
      </div>
    );
  }
  const { value, suit } = card;
  const isRed = suit === '♥' || suit === '♦';
  const glow =
    type === 'PLAYER'
      ? 'border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.4)]'
      : 'border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.4)]';
  return (
    <div
      className={`relative flex h-36 w-24 flex-col justify-between overflow-hidden rounded-xl border-2 bg-slate-800/90 p-2 backdrop-blur-xl transition-all duration-700 ease-out group ${glow} ${
        isDealt ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-10 scale-90 opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className={`text-xl font-bold ${isRed ? 'text-red-500' : 'text-slate-200'}`}>
        {value}
        <div className="text-sm">{suit}</div>
      </div>
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform text-4xl opacity-30 ${isRed ? 'text-red-500' : 'text-slate-200'}`}
      >
        {suit}
      </div>
      <div className={`rotate-180 self-end text-xl font-bold ${isRed ? 'text-red-500' : 'text-slate-200'}`}>
        {value}
        <div className="text-sm">{suit}</div>
      </div>
    </div>
  );
}

/** Vector + paso (proveedor: `contador_martingala` → celda; motor como respaldo). */
function PatternTracker({ currentStep, maxSteps, vector, predictionLabel, tiroNumber }) {
  const cells = Array.isArray(vector) ? vector : [];
  const ms = typeof maxSteps === 'number' && maxSteps > 0 ? maxSteps : 6;
  const stepLine =
    typeof tiroNumber === 'number' && Number.isFinite(tiroNumber)
      ? `TIRO ${tiroNumber} · paso ${currentStep}/${ms}`
      : `paso ${currentStep}/${ms}`;
  return (
    <div className="z-50 flex flex-col gap-2 rounded-xl border border-indigo-500/20 bg-slate-900/60 p-3 backdrop-blur-lg">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
          <Crosshair className="h-3 w-3" /> Vector
        </span>
        <span className="font-mono text-[10px] text-cyan-300/90">{stepLine}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {cells.map((cell, i) => {
          const side = trackerLabelFromEnginePrediction(cell);
          const isActive = typeof currentStep === 'number' && currentStep === i + 1;
          let colorClass = 'border-slate-600 bg-slate-700/50 text-slate-500';
          if (side === 'PLAYER') colorClass = 'border-blue-400 bg-blue-500/80 text-white';
          if (side === 'BANKER') colorClass = 'border-red-400 bg-red-500/80 text-white';
          if (side === 'TIE') colorClass = 'border-emerald-400 bg-emerald-600/80 text-white';
          const letter =
            side === 'PLAYER' ? 'P' : side === 'BANKER' ? 'B' : side === 'TIE' ? 'T' : '—';
          return (
            <div
              key={i}
              className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border px-1 font-mono text-[10px] font-bold ${colorClass} ${
                isActive ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900' : ''
              }`}
            >
              {letter}
            </div>
          );
        })}
      </div>
      {predictionLabel ? (
        <div className="text-center text-[10px] font-bold uppercase tracking-wider text-indigo-200/90">
          predicción · {predictionLabel}
        </div>
      ) : null}
    </div>
  );
}

/** Historial del motor (`history` ya viene del reducer). */
function HistoryPanel({ history }) {
  const rows = Array.isArray(history) ? history : [];
  if (rows.length === 0) {
    return <p className="text-xs text-slate-500">Sin entradas en el motor para este ciclo.</p>;
  }
  return (
    <>
      {rows.map((h, i) => {
        const pred = trackerLabelFromEnginePrediction(h.prediction);
        const resRaw = h.result;
        const res = winnerToPlayerBanker(resRaw);
        const id = `eh-${h.step}-${i}`;
        return (
          <GlassPanel key={id} className="group flex cursor-default items-center justify-between p-4 transition-colors hover:bg-indigo-900/20">
            <div>
              <div className="mb-1 font-mono text-[10px] font-bold text-slate-500">PASO {h.step}</div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>
                  pred:{' '}
                  <span className="font-bold text-slate-200">{pred ?? '—'}</span>
                </span>
                <span>
                  res:{' '}
                  <span
                    className={`font-black ${
                      res === 'BANKER'
                        ? 'text-red-400'
                        : res === 'PLAYER'
                          ? 'text-blue-400'
                          : res === 'TIE'
                            ? 'text-emerald-400'
                            : 'text-slate-500'
                    }`}
                  >
                    {res ?? '—'}
                  </span>
                </span>
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-xs font-black uppercase ${
                  h.status === 'WIN' ? 'text-emerald-400' : h.status === 'LOSS' ? 'text-rose-400' : 'text-slate-500'
                }`}
              >
                {h.status ?? '—'}
              </div>
            </div>
          </GlassPanel>
        );
      })}
    </>
  );
}

export default function CenterPanel() {
  const mesas = useLabStore((s) => s.mesas);
  const selectedMesaId = useLabStore((s) => s.selectedMesaId);
  const lifecycleState = useLabStore((s) => s.lifecycleState);
  const providerCloseTs = useLabStore((s) => s.providerCloseTs);
  const cycleStartedAt = useLabStore((s) => s.cycleStartedAt);
  const labSignalTs = useLabStore((s) => s.signalTs);
  const highlightMesaId = useGpulseLabUiStore((s) => s.highlightMesaId);
  const highlightUntilTs = useGpulseLabUiStore((s) => s.highlightUntilTs);
  const alerts = useAlertStore((s) => s.alerts);

  const effectiveId = useMemo(() => getEffectiveMesaId(mesas, selectedMesaId), [mesas, selectedMesaId]);
  const row = useMemo(
    () => (effectiveId ? mesas[effectiveId] : createEmptyMesaState()),
    [mesas, effectiveId],
  );

  const selectedCorrelationKey = useMemo(
    () => normalizeCorrelationKey(null, row.mesa ?? effectiveId, row.round),
    [row.mesa, row.round, effectiveId],
  );

  const replayRow = useExecutionReplayStore(
    useCallback(
      (s) => (selectedCorrelationKey ? s.byCk[selectedCorrelationKey] : undefined),
      [selectedCorrelationKey],
    ),
  );

  const liveEngineState = useExecutionEngineStore(
    useCallback(
      (s) => selectEngineForDisplay(s.engineMap, selectedCorrelationKey, s.engineIndex),
      [selectedCorrelationKey],
    ),
  );

  const engineState = useMemo(() => {
    if (replayRow?.events?.length) {
      const tail = replayRow.events.length - 1;
      if (replayRow.cursor < tail) {
        return replayFold(replayRow.events, replayRow.cursor);
      }
    }
    return liveEngineState;
  }, [replayRow, liveEngineState]);

  useEngineRenderForensic(engineState.correlationKey);

  const providerForecastSideLabel = useMemo(() => {
    const vf = row.vector_forecast;
    if (!Array.isArray(vf) || vf.length === 0) return null;
    const idx = forecastStepIndexFromContador(row.martingala);
    const cell = mapForecastAtStep(vf, idx);
    return recommendationFromForecastCell(cell);
  }, [row.vector_forecast, row.martingala]);

  const patternTrackerVector = useMemo(() => {
    const vf = row.vector_forecast;
    if (Array.isArray(vf) && vf.length > 0) return padForecastVector(vf);
    return Array.isArray(engineState.vector) ? engineState.vector : [];
  }, [row.vector_forecast, engineState.vector]);

  const patternTrackerStep = useMemo(() => {
    if (Array.isArray(row.vector_forecast) && row.vector_forecast.length > 0) {
      return forecastStepIndexFromContador(row.martingala) + 1;
    }
    return typeof engineState.currentStep === 'number' ? engineState.currentStep : 0;
  }, [row.vector_forecast, row.martingala, engineState.currentStep]);

  const tiroDisplayNumber = useMemo(() => {
    const c = Number(row.martingala);
    if (!Number.isFinite(c)) return null;
    return c + 1;
  }, [row.martingala]);

  const predictionSideLabel = useMemo(
    () => providerForecastSideLabel ?? trackerLabelFromEnginePrediction(engineState.prediction),
    [providerForecastSideLabel, engineState.prediction],
  );

  const ganador = row.ganador;
  const mesaInfo = row.supplierMesaInfoFull;

  /** Espejo VistaLabs: títulos alineados a fases visuales históricas (sin simular fases locales). */
  const titleLifecycleKey = useMemo(() => {
    if (lifecycleState === LAB_LIFECYCLE_STATES.RESULT_RECEIVED) return LAB_LIFECYCLE_STATES.CYCLE_COMPLETE;
    if (lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED) return LAB_LIFECYCLE_STATES.WAITING_RESULT;
    return lifecycleState;
  }, [lifecycleState]);

  const uiLifecycleState = useMemo(() => {
    if (lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED) return LAB_LIFECYCLE_STATES.WAITING_RESULT;
    if (lifecycleState === LAB_LIFECYCLE_STATES.RESULT_RECEIVED) return LAB_LIFECYCLE_STATES.CYCLE_COMPLETE;
    return lifecycleState;
  }, [lifecycleState]);

  const title = TITLE_BY_LIFECYCLE[titleLifecycleKey] ?? LAB_LIFECYCLE_LABELS[titleLifecycleKey] ?? 'ANALIZANDO…';

  const [now, setNow] = useState(() => Date.now());
  const [isAuto, setIsAuto] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  useEffect(() => {
    const needsTick =
      lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED ||
      lifecycleState === LAB_LIFECYCLE_STATES.RESULT_RECEIVED ||
      (typeof providerCloseTs === 'number' && Number.isFinite(providerCloseTs) && providerCloseTs > Date.now());
    if (!needsTick) return undefined;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [lifecycleState, providerCloseTs]);

  /** NEW_SIGNAL: prioridad intel por mesa, luego store (Date.now() al aceptar señal). */
  const signalTs = row.intelSignalTs ?? labSignalTs ?? cycleStartedAt ?? null;

  const timeEngine = useMemo(() => {
    const currentNow = now;

    let remainingMs = null;
    if (typeof providerCloseTs === 'number' && Number.isFinite(providerCloseTs) && providerCloseTs > currentNow) {
      remainingMs = Math.max(0, providerCloseTs - currentNow);
    }

    const waitingForResult =
      lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED && (ganador == null || String(ganador).trim() === '');
    const waitingStart = waitingForResult && signalTs != null ? signalTs : null;

    const elapsedMs = waitingStart != null ? Math.max(0, currentNow - waitingStart) : null;

    return {
      now: currentNow,
      remainingMs,
      remainingSec: remainingMs != null ? remainingMs / 1000 : null,
      waitingStart,
      elapsedMs,
      elapsedSec: elapsedMs != null ? elapsedMs / 1000 : null,
    };
  }, [now, lifecycleState, signalTs, providerCloseTs, ganador]);

  const streamStats = useMemo(
    () => (effectiveId ? getStreamDelayStatsForMesa(effectiveId) : { avgDelay: null, maxObserved: null, count: 0 }),
    [effectiveId, row.mesaAnalytics?.avgDelayMs, row.mesaAnalytics?.lastDelayMs],
  );
  const avgDelayMs =
    row.mesaAnalytics?.avgDelayMs != null ? row.mesaAnalytics.avgDelayMs : streamStats.avgDelay;

  const streamDeadlineMs = useMemo(
    () => (effectiveId ? getAdaptiveStreamDeadlineMs(effectiveId) : 60000),
    [effectiveId, streamStats.maxObserved, streamStats.count],
  );

  const intelligentWait = useMemo(
    () =>
      computeIntelligentWaitingUx({
        lifecycleState,
        mesaId: effectiveId,
        signalTs,
        now: timeEngine.now,
        avgDelayMs,
        deadlineMs: streamDeadlineMs,
        alerts,
      }),
    [lifecycleState, effectiveId, signalTs, timeEngine.now, avgDelayMs, streamDeadlineMs, alerts],
  );

  const waitingFeedback = useMemo(() => {
    const activeWait =
      lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED &&
      (ganador == null || String(ganador).trim() === '');
    if (!activeWait) return null;
    const start = signalTs;
    if (start == null) return null;
    const elapsedMs = Math.max(0, timeEngine.now - start);
    const avg =
      typeof avgDelayMs === 'number' && Number.isFinite(avgDelayMs) && avgDelayMs > 0 ? avgDelayMs : null;
    return getWaitingElapsedFeedback(elapsedMs, avg);
  }, [lifecycleState, signalTs, avgDelayMs, timeEngine.now, ganador]);

  const avgMesaLine =
    typeof avgDelayMs === 'number' && Number.isFinite(avgDelayMs) && avgDelayMs > 0
      ? `Tiempo promedio de mesa: ${(avgDelayMs / 1000).toFixed(1)}s`
      : null;

  const streamInterrupted = lifecycleState === LAB_LIFECYCLE_STATES.STREAM_INTERRUPTED;

  let subtitle = 'Esperando señal del proveedor';
  if (lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED && (ganador == null || String(ganador).trim() === '')) {
    if (intelligentWait.active) {
      subtitle = intelligentWait.headline ?? 'La jugada sigue en curso…';
    } else if (waitingFeedback?.tierMessage != null) {
      subtitle =
        timeEngine.remainingSec != null
          ? `Esperando resultado… · ${waitingFeedback.tierMessage} · cierre ~${timeEngine.remainingSec.toFixed(0)}s`
          : `Esperando resultado… · ${waitingFeedback.tierMessage}`;
    } else {
      subtitle =
        providerForecastSideLabel == null
          ? 'Señal activa · esperando resultado del proveedor'
          : `Señal activa · ${providerForecastSideLabel}`;
    }
  } else if (lifecycleState === LAB_LIFECYCLE_STATES.STREAM_INTERRUPTED) {
    subtitle = 'La mesa no ha emitido resultado en el tiempo esperado…';
  } else if (lifecycleState === LAB_LIFECYCLE_STATES.RESULT_RECEIVED) {
    subtitle = ganador == null ? 'Resultado recibido' : `Ganador: ${String(ganador)}`;
  } else if (lifecycleState === LAB_LIFECYCLE_STATES.CYCLE_COMPLETE) {
    subtitle = ganador == null ? 'Mano sin ganador' : `Ganador: ${String(ganador)}`;
  }

  const tableData = useMemo(() => {
    const n = normalizeMesaInfo(mesaInfo);
    if (!n) {
      return {
        playerCards: [],
        bankerCards: [],
        playerScore: null,
        bankerScore: null,
      };
    }
    return {
      playerCards: n.playerCards,
      bankerCards: n.bankerCards,
      playerScore: n.playerScore,
      bankerScore: n.bankerScore,
    };
  }, [mesaInfo]);

  const winnerForTable = useMemo(() => {
    const n = normalizeMesaInfo(mesaInfo);
    if (n?.winner != null) return n.winner;
    const mi = mesaInfo && typeof mesaInfo === 'object' && !Array.isArray(mesaInfo) ? mesaInfo : null;
    const raw = mi?.ganador ?? mi?.winner ?? mi?.resultado ?? ganador;
    return winnerToPlayerBanker(raw);
  }, [mesaInfo, ganador]);

  const { visiblePlayer, visibleBanker, dealStep, totalDealSteps, isDealing } = useBaccaratLiveDealEngine({
    mesaId: effectiveId,
    round: row.round,
    playerCards: tableData.playerCards,
    bankerCards: tableData.bankerCards,
    lifecycleState: uiLifecycleState,
  });

  const winnerForTableLive = isDealing && dealStep < totalDealSteps ? null : winnerForTable;

  const showResultTable =
    lifecycleState === LAB_LIFECYCLE_STATES.RESULT_RECEIVED ||
    lifecycleState === LAB_LIFECYCLE_STATES.CYCLE_COMPLETE;
  const showWaitingTable =
    lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED ||
    lifecycleState === LAB_LIFECYCLE_STATES.BETTING_CLOSED ||
    lifecycleState === LAB_LIFECYCLE_STATES.WAITING_RESULT ||
    lifecycleState === LAB_LIFECYCLE_STATES.STREAM_INTERRUPTED;

  const uiState = useMemo(() => {
    if (lifecycleState === LAB_LIFECYCLE_STATES.WARMUP) return UI_FLOW_STATES.UI_ANALYZING;
    if (lifecycleState === LAB_LIFECYCLE_STATES.IDLE) return UI_FLOW_STATES.UI_IDLE;
    if (lifecycleState === LAB_LIFECYCLE_STATES.WAITING_SIGNAL) return UI_FLOW_STATES.UI_IDLE;
    if (lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED) return UI_FLOW_STATES.UI_WAITING_RESULT;
    if (lifecycleState === LAB_LIFECYCLE_STATES.BETTING_PHASE) return UI_FLOW_STATES.UI_BETTING_OPEN;
    if (lifecycleState === LAB_LIFECYCLE_STATES.BETTING_CLOSED) return UI_FLOW_STATES.UI_WAITING_RESULT;
    if (lifecycleState === LAB_LIFECYCLE_STATES.WAITING_RESULT) return UI_FLOW_STATES.UI_WAITING_RESULT;
    if (lifecycleState === LAB_LIFECYCLE_STATES.STREAM_INTERRUPTED) return UI_FLOW_STATES.UI_WAITING_RESULT;
    if (lifecycleState === LAB_LIFECYCLE_STATES.RESULT_RECEIVED) return UI_FLOW_STATES.UI_DEALING_ANIMATION;
    if (lifecycleState === LAB_LIFECYCLE_STATES.CYCLE_COMPLETE) return UI_FLOW_STATES.UI_RESULT_DISPLAY;
    return UI_FLOW_STATES.UI_IDLE;
  }, [lifecycleState]);

  useEffect(() => {
    if (!effectiveId) return;
    if (!mesaInfo) return;
    const renderedState = {
      cardsVisible:
        (Array.isArray(tableData.playerCards) && tableData.playerCards.length > 0) ||
        (Array.isArray(tableData.bankerCards) && tableData.bankerCards.length > 0),
      resultVisible: Boolean(winnerForTable),
      scoresVisible: tableData.playerScore != null || tableData.bankerScore != null,
    };
    validateUIUXState({
      mesaId: effectiveId,
      mesaInfo,
      lifecycleState,
      renderedState,
    });

    validateUIFlow({
      mesaId: effectiveId,
      lifecycleState,
      uiState,
      supplierMesaInfoFull: mesaInfo,
      uiData: {
        playerCards: tableData.playerCards,
        bankerCards: tableData.bankerCards,
        playerScore: tableData.playerScore,
        bankerScore: tableData.bankerScore,
        winner: winnerForTable,
        resultVisible: showResultTable && (Boolean(winnerForTable) || renderedState.cardsVisible || renderedState.scoresVisible),
      },
      timestamps: {
        cycleStartedAt: useLabStore.getState().cycleStartedAt ?? null,
        intelResultTs: row?.intelResultTs ?? null,
      },
    });

    monitorProviderTruth({
      mesaId: effectiveId,
      supplierLastRawResult: row?.supplierLastRawResult ?? null,
      supplierMesaInfoFull: mesaInfo,
      uiData: {
        playerCards: tableData.playerCards,
        bankerCards: tableData.bankerCards,
        playerScore: tableData.playerScore,
        bankerScore: tableData.bankerScore,
        winner: winnerForTable,
      },
      lifecycleState,
    });

    computeAndAlertTrace({
      mesaId: effectiveId,
      lifecycleState,
      uiState,
      supplierLastRawResult: row?.supplierLastRawResult ?? null,
      supplierMesaInfoFull: mesaInfo,
      adapterData: tableData,
      uiData: {
        playerCards: tableData.playerCards,
        bankerCards: tableData.bankerCards,
        playerScore: tableData.playerScore,
        bankerScore: tableData.bankerScore,
        winner: winnerForTable,
      },
    });

    detectAndPreventPreFailure({
      mesaId: effectiveId,
      lifecycleState,
      uiState,
      supplierLastRawResult: row?.supplierLastRawResult ?? null,
      supplierMesaInfoFull: mesaInfo,
      adapterData: tableData,
      uiData: {
        playerCards: tableData.playerCards,
        bankerCards: tableData.bankerCards,
        playerScore: tableData.playerScore,
        bankerScore: tableData.bankerScore,
        winner: winnerForTable,
      },
      intelResultTs: row?.intelResultTs ?? null,
    });
  }, [effectiveId, mesaInfo, lifecycleState, tableData, winnerForTable, uiState, row, showResultTable]);

  const enginePhase = useMemo(() => {
    if (
      lifecycleState === LAB_LIFECYCLE_STATES.IDLE ||
      lifecycleState === LAB_LIFECYCLE_STATES.WARMUP ||
      lifecycleState === LAB_LIFECYCLE_STATES.WAITING_SIGNAL
    ) {
      return 'ANALYZING';
    }
    return lifecycleState;
  }, [lifecycleState]);

  const supplierDisplay = useMemo(() => {
    const pc = (Array.isArray(visiblePlayer) ? visiblePlayer : []).map(adaptCardPlaying).filter(Boolean);
    const bc = (Array.isArray(visibleBanker) ? visibleBanker : []).map(adaptCardPlaying).filter(Boolean);
    const w = winnerToPlayerBanker(winnerForTableLive ?? winnerForTable);
    return {
      winner: w,
      playerCards: pc,
      bankerCards: bc,
      playerScore: tableData.playerScore,
      bankerScore: tableData.bankerScore,
    };
  }, [visiblePlayer, visibleBanker, winnerForTableLive, winnerForTable, tableData]);

  const martingaleHistoryUi = useMemo(() => {
    if (!Array.isArray(engineState.history) || engineState.history.length === 0) return [];
    const t0 = engineState.startedAt ?? Date.now();
    return engineState.history.map((h, i) => ({
      id: `eng-${String(engineState.correlationKey ?? 'ck')}-${h.step}-${i}`,
      status: h.status,
      step: h.step,
      time: t0 + i * 100,
    }));
  }, [engineState.history, engineState.startedAt, engineState.correlationKey]);

  const metricsPair = useMemo(() => {
    const w = Array.isArray(row.wins) ? row.wins : [];
    return {
      wins: w.filter((x) => normalizeOutcomeCell(x) === 'P').length,
      losses: w.filter((x) => normalizeOutcomeCell(x) === 'B').length,
    };
  }, [row.wins]);

  const mesaAnalyticsUi = useMemo(() => {
    const w = Array.isArray(row.wins) ? row.wins : [];
    const winRate =
      w.length > 0 ? Math.round((w.filter((x) => normalizeOutcomeCell(x) === 'P').length / w.length) * 100) : 0;
    const errAlerts = alerts.filter((a) => a.severity === 'error').length;
    const avgMs = row.mesaAnalytics?.avgDelayMs ?? streamStats.avgDelay;
    return {
      winRate,
      anomalies: errAlerts,
      avgDelay: typeof avgMs === 'number' && Number.isFinite(avgMs) ? (avgMs / 1000).toFixed(1) : '—',
    };
  }, [row.wins, row.mesaAnalytics?.avgDelayMs, streamStats.avgDelay, alerts]);

  const betTotalSec = useMemo(() => {
    if (typeof providerCloseTs === 'number' && Number.isFinite(providerCloseTs) && labSignalTs != null) {
      return Math.max(1, (providerCloseTs - labSignalTs) / 1000);
    }
    return 10;
  }, [providerCloseTs, labSignalTs]);

  const remainingTimeUi =
    timeEngine.remainingSec != null ? timeEngine.remainingSec.toFixed(1) : '0.0';

  const waitStatusUi = useMemo(
    () => computeWaitIntelligenceStatus(timeEngine.elapsedMs, avgDelayMs),
    [timeEngine.elapsedMs, avgDelayMs],
  );

  const desyncWarning = useMemo(() => {
    if (!timeEngine.elapsedMs || !avgDelayMs) return null;

    if (timeEngine.elapsedMs > avgDelayMs * 2) {
      return 'DESYNC_RISK';
    }

    return null;
  }, [timeEngine.elapsedMs, avgDelayMs]);

  const formatTimeAgo = (timestamp) => {
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins === 0) return 'Ahora';
    return mins < 60 ? `hace ${mins}m` : `hace ${Math.floor(mins / 60)}h`;
  };

  const handleCopyAlert = () => {
    if (!selectedAlert) return;

    const fullText = JSON.stringify(selectedAlert, null, 2);

    void navigator.clipboard.writeText(fullText);
  };

  const cardsDealtVisible =
    lifecycleState === LAB_LIFECYCLE_STATES.RESULT_RECEIVED ||
    lifecycleState === LAB_LIFECYCLE_STATES.CYCLE_COMPLETE;

  const isEngineRunning = true;

  return (
    <div className="relative flex min-h-0 min-h-[min(28rem,50vh)] w-full flex-1 flex-col overflow-hidden bg-[#05050A] font-sans text-slate-300 selection:bg-indigo-500/30">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className={`absolute left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full blur-[150px] transition-colors duration-1000 ${
            supplierDisplay?.winner === 'PLAYER' ? 'bg-blue-900/30' : 'bg-indigo-900/20'
          }`}
        />
        <div
          className={`absolute bottom-[-20%] right-[-10%] h-[60%] w-[40%] rounded-full blur-[150px] transition-colors duration-1000 ${
            supplierDisplay?.winner === 'BANKER' ? 'bg-red-900/30' : 'bg-fuchsia-900/10'
          }`}
        />
        <div
          className={`absolute left-[30%] top-[20%] h-[40%] w-[40%] rounded-full blur-[120px] transition-all duration-2000 ${
            enginePhase === 'ANALYZING'
              ? 'scale-110 bg-cyan-500/20'
              : lifecycleState === LAB_LIFECYCLE_STATES.BETTING_PHASE
                ? 'scale-100 animate-pulse bg-indigo-500/20'
                : lifecycleState === LAB_LIFECYCLE_STATES.WAITING_RESULT
                  ? 'animate-breathe bg-purple-600/20'
                  : 'scale-90 bg-blue-900/10'
          }`}
        />
      </div>

      <div className="relative z-40 border-b border-cyan-500/10 bg-slate-950/50 px-4 py-2 sm:px-6">
        <ExecutionReplayBar correlationKey={selectedCorrelationKey} />
      </div>

      <header className="relative z-50 flex h-16 items-center justify-between border-b border-indigo-500/20 bg-slate-900/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-fuchsia-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]">
            <Cpu className="h-5 w-5 text-white" />
          </div>
          <h1 className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-xl font-black tracking-widest text-transparent">
            A.I. GENESIS <span className="ml-2 text-sm font-normal text-indigo-500">v2.1</span>
          </h1>
          <span
            className={`ml-4 flex items-center gap-2 rounded-md border px-3 py-1 text-[10px] font-bold tracking-widest transition-colors ${
              lifecycleState === LAB_LIFECYCLE_STATES.STREAM_INTERRUPTED
                ? 'border-red-500/20 bg-red-500/10 text-red-400'
                : enginePhase === 'ANALYZING'
                  ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400'
                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
            }`}
          >
            {lifecycleState === LAB_LIFECYCLE_STATES.STREAM_INTERRUPTED ? (
              <>
                <WifiOff className="h-3 w-3" /> OFFLINE
              </>
            ) : enginePhase === 'ANALYZING' ? (
              <>
                <Eye className="h-3 w-3 animate-pulse" /> SCANNING MESA
              </>
            ) : (
              <>
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />{' '}
                LINK ACTIVE
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setAlertsOpen(!alertsOpen)}
              className="group relative rounded-lg border border-indigo-500/30 bg-slate-800/50 p-2 transition-all hover:bg-indigo-500/20"
            >
              <Bell className="h-5 w-5 text-indigo-300 group-hover:text-indigo-100" />
              {alerts.length > 0 ? (
                <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
              ) : null}
            </button>
            {alertsOpen ? (
              <GlassPanel className="absolute right-0 top-12 w-80 border border-indigo-500/50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Registro de Validaciones</h3>
                  <button type="button" onClick={() => setAlertsOpen(false)} aria-label="Cerrar">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-72 space-y-3 overflow-y-auto custom-scrollbar">
                  {alerts.length === 0 ? (
                    <p className="text-xs text-slate-500">Sin alertas activas.</p>
                  ) : (
                    alerts.map((alert) => (
                      <div
                        key={alert.id}
                        onClick={() => setSelectedAlert(alert)}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-slate-800/50 p-3 hover:bg-indigo-500/10"
                      >
                        {alert.severity === 'warning' ? (
                          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                        ) : alert.severity === 'error' ? (
                          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" />
                        ) : (
                          <Activity className="h-5 w-5 shrink-0 text-blue-500" />
                        )}
                        <div>
                          <p className="text-sm leading-tight text-slate-200">{alert.message}</p>
                          <span className="mt-1 block text-[10px] text-slate-500">
                            {formatTimeAgo(alert.timestamp ?? Date.now())}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </GlassPanel>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="rounded-lg border border-indigo-500/30 bg-slate-800/50 p-2 text-indigo-300 transition-all hover:bg-indigo-500/20"
          >
            <History className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setToolsOpen(true)}
            className="rounded-lg border border-indigo-400/50 bg-indigo-600/20 p-2 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all hover:bg-indigo-500/40"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          {effectiveId ? (
            <button
              type="button"
              onClick={() =>
                useGpulseLabUiStore.getState().openCycleReplay({
                  mesaId: effectiveId,
                })
              }
              className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-2 py-2 font-mono text-[10px] text-amber-100 hover:bg-amber-900/50"
            >
              Replay
            </button>
          ) : null}
        </div>
      </header>

      <nav className="relative z-40 flex h-11 items-center gap-8 border-b border-indigo-500/10 bg-slate-900/60 px-6 text-[11px] font-bold tracking-widest shadow-md backdrop-blur-md">
        {['DASHBOARD', 'SEÑALES', 'ANALYTICS', 'LAB ENGINE', 'HERRAMIENTAS'].map((tab, i) => (
          <button
            key={tab}
            type="button"
            className={`relative flex h-full items-center transition-colors ${
              i === 3 ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
            {i === 3 ? (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            ) : null}
          </button>
        ))}
      </nav>

      <main className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        {desyncWarning ? (
          <div className="absolute right-2 top-32 z-[999] rounded border border-red-500 bg-red-900/80 px-3 py-2 text-xs text-red-300">
            ⚠ DESYNC DETECTED
          </div>
        ) : null}
        <div className="custom-scrollbar z-20 flex w-[280px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-indigo-500/20 bg-slate-900/30 p-5 backdrop-blur-md">
          <GlassPanel className="relative overflow-hidden p-4">
            <h2 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              <Activity className="h-4 w-4" /> Rendimiento Global
            </h2>
            <div className="mb-4 flex items-center justify-between px-2">
              <div className="flex flex-col items-center">
                <span className="flex items-center gap-1 text-3xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]">
                  <TrendingUp className="h-4 w-4 opacity-50" />
                  {metricsPair.wins}
                </span>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Player</span>
              </div>
              <div className="h-10 w-px bg-indigo-500/20" />
              <div className="flex flex-col items-center">
                <span className="flex items-center gap-1 text-3xl font-black text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                  {metricsPair.losses}
                  <TrendingDown className="h-4 w-4 opacity-50" />
                </span>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Banker</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-indigo-500/20 pt-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ciclo Actual</span>
              <span className="text-xs font-black text-indigo-300">
                {engineState.status === 'RUNNING' && tiroDisplayNumber != null
                  ? `TIRO ${tiroDisplayNumber}`
                  : engineState.status === 'RUNNING'
                    ? `${engineState.currentStep}/${engineState.maxSteps}`
                    : '—'}
              </span>
            </div>
          </GlassPanel>

          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Modo de Operación</h3>
            <div className="flex rounded-lg border border-indigo-500/20 bg-slate-800/50 p-1">
              <button
                type="button"
                onClick={() => setIsAuto(false)}
                className={`flex-1 rounded-md py-2 text-xs font-bold transition-all ${
                  !isAuto
                    ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                MANUAL
              </button>
              <button
                type="button"
                onClick={() => setIsAuto(true)}
                className={`flex-1 rounded-md py-2 text-xs font-bold transition-all ${
                  isAuto
                    ? 'bg-fuchsia-600 text-white shadow-[0_0_15px_rgba(192,38,211,0.5)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                AUTO-AI
              </button>
            </div>
          </div>

          <div className="flex min-h-[180px] flex-1 flex-col space-y-3 overflow-hidden">
            <div className="rounded-lg border border-slate-600/40 bg-slate-900/40 px-2 py-1.5 font-mono text-[9px] text-slate-400">
              <span className="text-slate-500">Execution engine</span>{' '}
              <span className="text-cyan-300/90">{engineState.status}</span>
              {engineState.status === 'RUNNING' ? (
                <span className="text-slate-500">
                  {' '}
                  · step {patternTrackerStep}/{engineState.maxSteps}
                </span>
              ) : null}
            </div>
            <h3 className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Historial Martingala <span className="text-indigo-400">(Ciclo 6)</span>
            </h3>
            <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
              {martingaleHistoryUi.length === 0 ? (
                <p className="text-[10px] text-slate-600">Sin eventos RESULT en el ciclo actual.</p>
              ) : (
                martingaleHistoryUi.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
                      item.status === 'WIN'
                        ? 'border-emerald-500/20 bg-emerald-900/10 hover:bg-emerald-900/20'
                        : 'border-red-500/20 bg-red-900/10 hover:bg-red-900/20'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span
                        className={`text-[11px] font-black tracking-widest ${
                          item.status === 'WIN' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {item.status === 'WIN' ? 'VICTORIA' : 'PÉRDIDA TOTAL'}
                      </span>
                      <span className="text-[9px] text-slate-500">{formatTimeAgo(item.time)}</span>
                    </div>
                    <div className="flex items-center gap-1 rounded border border-slate-700/50 bg-slate-900/50 px-2 py-1 font-mono text-[11px] text-slate-300">
                      Tiro{' '}
                      <span
                        className={item.status === 'WIN' ? 'font-bold text-emerald-300' : 'font-bold text-red-300'}
                      >
                        {item.step}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4 border-t border-indigo-500/20 pt-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ejecución del Motor</h3>
            <NeonButton variant={isEngineRunning ? 'danger' : 'primary'} className="w-full py-4 text-sm tracking-widest">
              {isEngineRunning ? (
                <>
                  <Square className="h-4 w-4" /> SUSPENDER
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" /> INYECTAR
                </>
              )}
            </NeonButton>
            <div className="flex gap-2">
              <NeonButton variant="ghost" className="flex-1 text-[10px]">
                <RefreshCw className="h-3 w-3" /> REINICIAR
              </NeonButton>
              <NeonButton variant="ghost" className="flex-1 text-[10px]">
                <Settings className="h-3 w-3" /> CONFIGURAR
              </NeonButton>
            </div>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative z-20 flex min-h-0 flex-1 flex-col items-center justify-center p-8">
            <div className="absolute top-8 z-50 flex w-full flex-col items-center">
              <div
                className={`transform text-xs font-bold tracking-[0.3em] transition-all duration-500 ease-in-out ${
                  enginePhase === 'ANALYZING'
                    ? 'scale-100 translate-y-0 text-cyan-400'
                    : lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED
                      ? 'scale-110 translate-y-0 text-indigo-300'
                      : lifecycleState === LAB_LIFECYCLE_STATES.BETTING_PHASE
                        ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]'
                        : lifecycleState === LAB_LIFECYCLE_STATES.BETTING_CLOSED
                          ? 'text-slate-400'
                          : lifecycleState === LAB_LIFECYCLE_STATES.WAITING_RESULT
                            ? 'text-amber-400'
                            : lifecycleState === LAB_LIFECYCLE_STATES.RESULT_RECEIVED
                              ? 'text-emerald-400'
                              : lifecycleState === LAB_LIFECYCLE_STATES.CYCLE_COMPLETE
                                ? 'text-slate-300'
                                : 'text-slate-500'
                }`}
              >
                {enginePhase === 'ANALYZING' && (
                  <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4 animate-spin" /> ANALIZANDO MESA...
                  </span>
                )}
                {lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED && 'SEÑAL CONFIRMADA'}
                {lifecycleState === LAB_LIFECYCLE_STATES.BETTING_PHASE && 'EJECUTA TU JUGADA...'}
                {lifecycleState === LAB_LIFECYCLE_STATES.BETTING_CLOSED && 'APUESTAS CERRADAS'}
                {lifecycleState === LAB_LIFECYCLE_STATES.WAITING_RESULT && (
                  <span className="flex animate-pulse items-center gap-2">
                    <Eye className="h-4 w-4" /> OBSERVANDO FLUJO...
                  </span>
                )}
                {lifecycleState === LAB_LIFECYCLE_STATES.RESULT_RECEIVED && 'DATOS RECIBIDOS'}
                {lifecycleState === LAB_LIFECYCLE_STATES.CYCLE_COMPLETE && 'RESULTADO CONFIRMADO'}
                {lifecycleState === LAB_LIFECYCLE_STATES.STREAM_INTERRUPTED && 'STREAM EN PAUSA'}
              </div>
              <div className="mt-3 flex items-center gap-6 opacity-60">
                <h2 className="text-2xl font-black tracking-widest text-white">
                  ROUND {row.round != null ? String(row.round) : '—'}
                </h2>
                <div className="h-4 w-px bg-slate-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-200">
                  {effectiveId ? String(effectiveId) : '—'}
                </h2>
              </div>
            </div>

            <div className="absolute top-28 z-50">
              <PatternTracker
                currentStep={patternTrackerStep}
                maxSteps={engineState.maxSteps}
                vector={patternTrackerVector}
                predictionLabel={predictionSideLabel}
                tiroNumber={tiroDisplayNumber}
              />
            </div>

            <div className="relative z-40 mb-8 mt-20 flex h-64 w-full items-center justify-center">
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
                  enginePhase === 'ANALYZING' ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0'
                }`}
              >
                <div className="relative flex h-48 w-48 items-center justify-center overflow-hidden rounded-full border border-cyan-500/30">
                  <div className="absolute inset-0 bg-cyan-500/10" />
                  <div className="animate-scanline h-full w-1 bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,1)]" />
                  <Box className="absolute h-12 w-12 text-cyan-500/50" />
                </div>
              </div>

              <div
                className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
                  lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED ||
                  lifecycleState === LAB_LIFECYCLE_STATES.BETTING_PHASE
                    ? 'scale-100 opacity-100'
                    : 'pointer-events-none scale-125 opacity-0'
                }`}
              >
                <div
                  className={`absolute inset-0 mx-auto h-64 w-64 rounded-full blur-[60px] transition-colors duration-1000 ${
                    predictionSideLabel === 'PLAYER'
                      ? 'bg-blue-600/30'
                      : predictionSideLabel === 'BANKER'
                        ? 'bg-red-600/30'
                        : 'bg-indigo-500/10'
                  }`}
                />
                <svg className="h-64 w-64 -rotate-90 transform drop-shadow-[0_0_20px_rgba(99,102,241,0.6)]" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#1e1b4b" strokeWidth="2" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#gradientMain)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="283"
                    strokeDashoffset={
                      lifecycleState === LAB_LIFECYCLE_STATES.BETTING_PHASE &&
                      timeEngine.remainingMs != null &&
                      betTotalSec > 0
                        ? 283 - 283 * Math.min(1, timeEngine.remainingMs / (betTotalSec * 1000))
                        : 0
                    }
                    className="transition-[stroke-dashoffset] duration-100 ease-linear"
                  />
                  <defs>
                    <linearGradient id="gradientMain" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop
                        offset="0%"
                        stopColor={predictionSideLabel === 'BANKER' ? '#ef4444' : '#3b82f6'}
                      />
                      <stop
                        offset="100%"
                        stopColor={predictionSideLabel === 'BANKER' ? '#b91c1c' : '#8b5cf6'}
                      />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <div className="text-7xl font-black tabular-nums tracking-tighter text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.8)]">
                    {remainingTimeUi}
                  </div>
                  <div className="mt-1 text-xs font-bold tracking-[0.2em] text-indigo-200/80">SEGUNDOS</div>
                </div>
              </div>

              <div
                className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
                  lifecycleState === LAB_LIFECYCLE_STATES.BETTING_CLOSED ||
                  lifecycleState === LAB_LIFECYCLE_STATES.WAITING_RESULT
                    ? 'scale-100 opacity-100'
                    : 'pointer-events-none scale-95 opacity-0'
                }`}
              >
                <GlassPanel className="animate-breathe relative flex h-48 w-80 flex-col justify-between overflow-hidden border-indigo-400/40 p-5">
                  <div
                    className="absolute inset-0 opacity-50"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA0MCAwIEwgMCAwIDAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSg5OSwgMTAyLCAyNDEsIDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==\")",
                    }}
                  />
                  <div className="relative z-10 mt-2 flex flex-col gap-2 text-center">
                    <Activity className="mx-auto mb-2 h-8 w-8 animate-pulse text-indigo-400" />
                    <div className="flex h-10 items-center justify-center text-sm font-semibold text-indigo-200">
                      {subtitle}
                    </div>
                  </div>
                  <div className="relative z-10 grid grid-cols-3 gap-2 border-t border-indigo-500/30 pt-3 text-center">
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-slate-400">Elapsed</div>
                      <div className="font-mono text-sm font-bold text-white">
                        {timeEngine.elapsedSec?.toFixed(1) ?? '—'}s
                      </div>
                    </div>
                    <div className="border-x border-indigo-500/30">
                      <div className="text-[9px] uppercase tracking-widest text-slate-400">Avg Delay</div>
                      <div className="font-mono text-sm font-bold text-slate-300">{mesaAnalyticsUi.avgDelay}s</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-slate-400">Status</div>
                      <div className={`mt-0.5 text-xs font-black tracking-wider ${waitStatusUi.color}`}>
                        {waitStatusUi.text}
                      </div>
                    </div>
                  </div>
                </GlassPanel>
              </div>
            </div>

            <div
              className={`pointer-events-none absolute left-1/2 top-1/2 z-30 flex w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-16 transition-all duration-500 ${
                cardsDealtVisible && (supplierDisplay.playerCards.length > 0 || supplierDisplay.bankerCards.length > 0)
                  ? 'scale-100 opacity-100 blur-none'
                  : 'scale-95 opacity-0 blur-md'
              }`}
            >
              <div className="relative flex flex-col items-center gap-4">
                <div
                  className={`absolute left-1/2 top-1/2 z-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px] transition-all duration-1000 ${
                    supplierDisplay.winner === 'PLAYER' ? 'bg-blue-500/50' : 'bg-blue-500/10 blur-[40px]'
                  }`}
                />
                <h3
                  className={`z-10 text-3xl font-black tracking-widest transition-colors duration-500 ${
                    supplierDisplay.winner === 'PLAYER'
                      ? 'text-blue-300 drop-shadow-[0_0_20px_rgba(59,130,246,1)]'
                      : 'text-blue-500/50'
                  }`}
                >
                  PLAYER
                </h3>
                <div className="z-20 flex gap-[-25px]">
                  <div className="translate-x-4 rotate-[-8deg] transform">
                    <PlayingCard
                      card={supplierDisplay.playerCards[0]}
                      type="PLAYER"
                      isDealt={cardsDealtVisible}
                    />
                  </div>
                  <div className="z-10 rotate-[4deg] transform">
                    <PlayingCard
                      card={supplierDisplay.playerCards[1]}
                      type="PLAYER"
                      isDealt={cardsDealtVisible}
                    />
                  </div>
                  {supplierDisplay.playerCards[2] ? (
                    <div className="z-20 translate-x-[-12px] rotate-[15deg] transform">
                      <PlayingCard
                        card={supplierDisplay.playerCards[2]}
                        type="PLAYER"
                        isDealt={cardsDealtVisible}
                      />
                    </div>
                  ) : null}
                </div>
                <div
                  className={`z-40 mt-6 rounded-full border-2 px-6 py-2 text-xl font-black tracking-widest transition-all duration-500 ${
                    supplierDisplay.winner === 'PLAYER'
                      ? 'scale-110 border-blue-400 bg-blue-900/90 text-blue-100 shadow-[0_0_25px_rgba(59,130,246,0.8)]'
                      : 'border-blue-800/50 bg-blue-950/50 text-blue-500/70'
                  }`}
                >
                  {supplierDisplay.playerScore ?? '—'}
                </div>
              </div>

              <div className="z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-indigo-500/50 bg-slate-900 font-black text-indigo-400 opacity-60 shadow-[0_0_25px_rgba(0,0,0,0.8)]">
                VS
              </div>

              <div className="relative flex flex-col items-center gap-4">
                <div
                  className={`absolute left-1/2 top-1/2 z-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px] transition-all duration-1000 ${
                    supplierDisplay.winner === 'BANKER' ? 'bg-red-500/50' : 'bg-red-500/10 blur-[40px]'
                  }`}
                />
                <h3
                  className={`z-10 text-3xl font-black tracking-widest transition-colors duration-500 ${
                    supplierDisplay.winner === 'BANKER'
                      ? 'text-red-300 drop-shadow-[0_0_20px_rgba(239,68,68,1)]'
                      : 'text-red-500/50'
                  }`}
                >
                  BANKER
                </h3>
                <div className="z-20 flex gap-[-25px]">
                  <div className="translate-x-4 rotate-[-4deg] transform">
                    <PlayingCard
                      card={supplierDisplay.bankerCards[0]}
                      type="BANKER"
                      isDealt={cardsDealtVisible}
                    />
                  </div>
                  <div className="z-10 rotate-[8deg] transform">
                    <PlayingCard
                      card={supplierDisplay.bankerCards[1]}
                      type="BANKER"
                      isDealt={cardsDealtVisible}
                    />
                  </div>
                  {supplierDisplay.bankerCards[2] ? (
                    <div className="z-20 translate-x-[-12px] rotate-[20deg] transform">
                      <PlayingCard
                        card={supplierDisplay.bankerCards[2]}
                        type="BANKER"
                        isDealt={cardsDealtVisible}
                      />
                    </div>
                  ) : null}
                </div>
                <div
                  className={`z-40 mt-6 rounded-full border-2 px-6 py-2 text-xl font-black tracking-widest transition-all duration-500 ${
                    supplierDisplay.winner === 'BANKER'
                      ? 'scale-110 border-red-400 bg-red-900/90 text-red-100 shadow-[0_0_25px_rgba(239,68,68,0.8)]'
                      : 'border-red-800/50 bg-red-950/50 text-red-500/70'
                  }`}
                >
                  {supplierDisplay.bankerScore ?? '—'}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`z-50 border-t border-indigo-500/20 bg-slate-900/80 backdrop-blur-2xl transition-all duration-300 ${
              dockOpen ? 'h-32' : 'h-10'
            }`}
          >
            <button
              type="button"
              className="flex h-10 w-full cursor-pointer items-center justify-between px-6 transition-colors hover:bg-white/5"
              onClick={() => setDockOpen(!dockOpen)}
            >
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-indigo-300">
                <Activity className="h-3 w-3" /> ENGINE TERMINAL STREAM
              </div>
              {dockOpen ? (
                <ChevronDown className="h-4 w-4 text-indigo-400" />
              ) : (
                <ChevronUp className="h-4 w-4 text-indigo-400" />
              )}
            </button>
            {dockOpen ? (
              <div className="flex h-22 flex-col gap-1.5 overflow-hidden px-6 pb-4 font-mono text-[11px] text-indigo-200/60">
                <div className="text-white">
                  [{new Date().toLocaleTimeString()}] <span className="ml-2 text-cyan-400">LIFECYCLE</span> {title}
                </div>
                <div>
                  [{new Date().toLocaleTimeString()}] <span className="ml-2 text-indigo-400">STATE</span> {lifecycleState}
                </div>
                <div>
                  [{new Date().toLocaleTimeString()}] <span className="ml-2 text-emerald-400">MESA</span>{' '}
                  {effectiveId ?? '—'} · ronda {row.round ?? '—'}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="custom-scrollbar z-20 flex w-[320px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-indigo-500/20 bg-slate-900/30 p-5 backdrop-blur-md">
          <GlassPanel className="group relative overflow-hidden p-1">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 opacity-50 transition-opacity" />
            <div className="relative z-10 m-1 flex flex-col items-center rounded-xl border border-indigo-400/30 bg-slate-900/80 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                <Cpu className="h-3 w-3" /> SEÑAL COMPUTADA
              </h3>
              <div
                className={`text-4xl font-black tracking-tight transition-all duration-700 ${
                  predictionSideLabel === 'BANKER'
                    ? 'scale-110 text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]'
                    : predictionSideLabel === 'PLAYER'
                      ? 'scale-110 text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]'
                      : 'text-slate-600'
                }`}
              >
                {predictionSideLabel ?? 'ANALIZANDO'}
              </div>
              <div className="mt-4 w-full px-2 text-center font-mono text-[10px] text-slate-400">
                <div className="mb-1 uppercase tracking-widest text-slate-500">Motor</div>
                <div className="text-indigo-200">
                  {engineState.status}
                  {engineState.status === 'RUNNING'
                    ? ` · paso ${patternTrackerStep}/${engineState.maxSteps}`
                    : ''}
                </div>
                {engineState.result != null ? (
                  <div className="mt-2 text-[11px] text-slate-300">
                    último resultado:{' '}
                    <span className="font-bold text-white">{String(engineState.result)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </GlassPanel>

          <div className="grid grid-cols-2 gap-3">
            <GlassPanel className="flex flex-col items-center justify-center p-4 text-center">
              <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">% Player (últimos)</div>
              <div className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">
                {mesaAnalyticsUi.winRate}%
              </div>
            </GlassPanel>
            <GlassPanel className="flex flex-col items-center justify-center p-4 text-center">
              <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">Alertas error</div>
              <div className="text-2xl font-black text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]">
                {mesaAnalyticsUi.anomalies}
              </div>
            </GlassPanel>
          </div>

          <div className="mt-auto">
            <button
              type="button"
              onClick={() =>
                useGpulseLabUiStore.getState().openCycleXRay({
                  mesaId: effectiveId != null ? String(effectiveId) : null,
                })
              }
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-500/40 p-4 opacity-70 transition-opacity hover:opacity-100"
            >
              <Maximize2 className="h-4 w-4 text-indigo-400" />
              <span className="text-[10px] font-bold tracking-widest text-indigo-300">VALIDACIONES PROFUNDAS</span>
            </button>
          </div>
        </div>
      </main>

      <div
        className={`absolute bottom-0 right-0 top-0 z-[100] w-[450px] transform border-l border-indigo-500/50 bg-slate-900/95 shadow-[-30px_0_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          toolsOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col p-6">
          <div className="mb-8 flex items-center justify-between border-b border-indigo-500/20 pb-4">
            <h2 className="flex items-center gap-3 text-lg font-black tracking-widest text-white">
              <Layers className="h-5 w-5 text-indigo-400" />
              MÓDULOS DEL SISTEMA
            </h2>
            <button
              type="button"
              onClick={() => setToolsOpen(false)}
              className="rounded-full bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              'Constructor de Estrategias',
              'Inteligencia de Mercado',
              'Config. de Riesgo',
              'Webhooks API',
              'Alertas Personalizadas',
              'Exportación de Datos',
            ].map((tool) => (
              <div
                key={tool}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-indigo-500/20 bg-slate-800/40 p-5 text-center transition-all hover:border-indigo-400 hover:bg-indigo-900/30"
              >
                <Box className="h-8 w-8 text-indigo-500/50" />
                <span className="text-xs font-bold text-slate-300">{tool}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto rounded-xl border border-indigo-500/30 bg-indigo-950/50 p-4 text-center">
            <span className="text-xs text-indigo-300">API de expansión de módulos disponible en Ajustes de Lab.</span>
          </div>
        </div>
      </div>

      <div
        className={`absolute bottom-0 right-0 top-0 z-[100] w-[400px] transform border-l border-indigo-500/50 bg-slate-900/95 shadow-[-20px_0_50px_rgba(0,0,0,0.8)] backdrop-blur-3xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          historyOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-3 text-xl font-bold tracking-widest text-white">
              <History className="h-5 w-5 text-indigo-400" />
              HISTORIAL DEL CICLO
            </h2>
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              className="rounded-full bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
            <HistoryPanel history={engineState.history} />
          </div>
        </div>
      </div>

      {selectedAlert ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="max-h-[80vh] w-[500px] overflow-hidden rounded-xl border border-indigo-500/30 bg-slate-900 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-indigo-300">ALERT DETAIL</h2>
              <button type="button" onClick={() => setSelectedAlert(null)} aria-label="Cerrar detalle de alerta">
                <X className="h-4 w-4 text-slate-400 hover:text-white" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto rounded border border-indigo-500/20 bg-black/50 p-3 font-mono text-xs">
              <div className="mb-2 text-slate-200">{selectedAlert.message}</div>
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(selectedAlert, null, 2)}
              </pre>
            </div>

            <div className="mt-4 flex justify-between">
              <button
                type="button"
                onClick={handleCopyAlert}
                className="rounded bg-indigo-600 px-3 py-2 text-xs font-bold hover:bg-indigo-500"
              >
                COPY FULL
              </button>

              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="rounded bg-red-600 px-3 py-2 text-xs font-bold hover:bg-red-500"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.5); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.8); }
        @keyframes scanline {
          0% { transform: translateY(-100px); }
          50% { transform: translateY(200px); }
          100% { transform: translateY(-100px); }
        }
        .animate-scanline { animation: scanline 2s ease-in-out infinite; }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        .animate-breathe { animation: breathe 3s ease-in-out infinite; }
      `,
        }}
      />
    </div>
  );
}
