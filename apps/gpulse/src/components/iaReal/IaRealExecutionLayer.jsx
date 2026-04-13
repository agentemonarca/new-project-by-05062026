import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  extractMesaInfoFlexible,
  extractScoreLabelsFromResultRaw,
  extractVectorForecastFromActiveRow,
  iaRealContadorForStrip,
  iaRealPredictionToneClasses,
  iaRealVectorCellToneClasses,
  iaRealVectorMaturityDimClass,
  iaRealVectorResultDimClass,
  normalizeGanadorSide,
  recommendationSide,
  resolveOutcomeRowResultPayload,
  winnerVectorIndexFromGanador,
} from '../../utils/iaRealEngineUi.js';
import {
  extractVectorResultadoAndWinFromResultRaw,
  forecastStepIndexFromContador,
  formatPredictionSideLabel,
  mergeResultEnvelopeForExtract,
  parseVectorWinStep,
  predictionSideFromVectorAndContador,
} from '../../utils/providerMartingaleRead.js';
import { IaRealCardTheater } from './IaRealCardTheater.jsx';

const CIN_EASE = [0.4, 0, 0.2, 1];
const CIN_MS = { fast: 0.16, med: 0.2, slow: 0.22 };

/** WAITING_RESULT / SYNC: active vector cell pulse (~1s) — visual only */
const WAITING_CELL_PULSE_S = 1;
const WAITING_BAR_BREATHE_S = 1.15;
const WAITING_BG_DRIFT_S = 5;
const WAITING_PRED_BREATH_S = 1.35;

const CYCLE_DEBUG = String(import.meta.env.VITE_CYCLE_DEBUG ?? '').trim() === '1';
/** 1 o VITE_CYCLE_DEBUG: `🧾 RAW RESULT FRONT` + `extractMesaInfoFlexible(rawResult)` */
const DEBUG_IA_RESULT_FRONT =
  String(import.meta.env.VITE_DEBUG_IA_RESULT_FRONT ?? '').trim() === '1' || CYCLE_DEBUG;

/** Ventana local T1–T6 (misma grilla que App: 60s hasta el último timeout de paso). */
const BETTING_WINDOW_MS = 60_000;

/**
 * Capa única derivada del motor (relay / backend). Sin `gamePhase` de App.
 * WAITING_RESULT | SYNC → espera; RESULT | RESULT_SEQUENCE (+ legacy) → resultado.
 */
function getUiPhaseFromEngineStatus(status) {
  if (
    status === 'RESULT' ||
    status === 'RESULT_SEQUENCE' ||
    status === 'RESULT_ANIMATION' ||
    status === 'SUCCESS' ||
    status === 'FAILED'
  ) {
    return 'RESULT_SHOW';
  }
  if (status === 'WAITING_RESULT' || status === 'SYNC') {
    return 'CARDS_WAITING';
  }
  return 'IDLE';
}

/**
 * Visual-only execution layer for IA Real (provider shell). No timers affecting engine state.
 *
 * Architecture: single hero surface for live IA Real — `IaRealCardTheater` mounts only here. App does not
 * stack a second execution layer; History uses `IaRealSignalFeedPanel` (feed only). Simulated SEÑAL UI is
 * gated off when the provider shell is active (`isIaRealProviderShell`).
 *
 * @param {{ status?: string, reconnectAttempt?: number, lastError?: string | null }} [connectionMeta] Optional relay connection snapshot (from parent store reads only).
 * @param {boolean} [suppressStoryText] When true, hide inline story copy (relato lives in App narrative box); data cards unchanged. Default false.
 * @param {number | null} [cycleStartTs] Marca nuevo ciclo (NEW_SIGNAL) para reset de `dealTrigger` en teatro.
 * @param {object | null} [augmentSourceRow] — App: `activeRow` o fila Zustand con mismo `id` que `outcomeRow` (history/activeSignals) para enriquecer cartas.
 */
export function IaRealExecutionLayer({
  engine,
  isLightMode,
  onOutcomePresented,
  connectionMeta = null,
  suppressStoryText = false,
  cycleStartTs = null,
  augmentSourceRow = null,
}) {
  const { status, activeRow, outcomeRow, visualStepIndex, phaseVisual } = engine;
  /** `augmentSourceRow` puede ir un tick detrás del store; `outcomeRow` evita fallback -2 en NDJSON (slotsFromFallbackEnrichment). */
  const rowForAugment = augmentSourceRow ?? activeRow ?? outcomeRow ?? null;
  const lastOutcomeFxRef = useRef('');

  useEffect(() => {
    if (!DEBUG_IA_RESULT_FRONT) return;
    if (!outcomeRow?.rawResult) return;
    console.log('🧾 RAW RESULT FRONT', outcomeRow.rawResult);
    console.log('🧾 extractMesaInfoFlexible', extractMesaInfoFlexible(outcomeRow.rawResult));
  }, [outcomeRow?.id, outcomeRow?.rawResult]);

  useEffect(() => {
    if (!CYCLE_DEBUG) return;
    console.log('🧠 UI ACTIVE ROW', {
      status,
      phaseVisual,
      rowId: activeRow?.id,
      martingale: activeRow?.martingale,
      contador: activeRow?.rawSignal?.contador_martingala,
      hasRawResult: !!activeRow?.rawResult,
    });
  }, [status, phaseVisual, activeRow]);

  useEffect(() => {
    if (status !== 'RESULT_SEQUENCE' && status !== 'RESULT') return;
    if (phaseVisual !== 'RESULT') return;
    const id = outcomeRow?.id != null ? String(outcomeRow.id) : '';
    if (!id || lastOutcomeFxRef.current === id) return;
    lastOutcomeFxRef.current = id;
    onOutcomePresented?.(outcomeRow?.winStatus === true);
  }, [status, phaseVisual, outcomeRow?.id, outcomeRow?.winStatus, onOutcomePresented]);

  const contadorEff = useMemo(
    () => iaRealContadorForStrip(activeRow, outcomeRow, phaseVisual, status),
    [activeRow, outcomeRow, phaseVisual, status],
  );

  const vfLen = activeRow ? extractVectorForecastFromActiveRow(activeRow).length : 0;
  const effectiveStepIndex = useMemo(() => {
    if (!vfLen) return Number(visualStepIndex) || 0;
    return forecastStepIndexFromContador(contadorEff);
  }, [vfLen, contadorEff, visualStepIndex]);

  const stepProgressRatio =
    vfLen > 0 ? Math.min(1, Math.max(0, (Number(effectiveStepIndex) + 1) / vfLen)) : 0;

  const predictionSide = useMemo(() => {
    if (!activeRow) return null;
    const vf = extractVectorForecastFromActiveRow(activeRow);
    return predictionSideFromVectorAndContador(vf, contadorEff);
  }, [activeRow, contadorEff]);
  const predictionLabel = formatPredictionSideLabel(predictionSide);
  const predSide = recommendationSide(predictionLabel);

  const phaseStr = phaseVisual != null ? String(phaseVisual) : '';
  const isWaiting = status === 'WAITING_RESULT';
  const isSync = status === 'SYNC';
  const isResultSequence = status === 'RESULT' || status === 'RESULT_SEQUENCE';
  const isFreezePhase = isResultSequence && phaseStr === 'RESULT_FREEZE';
  /** Pre-result tension: active strip “alive” for both waiting on result and sync guard */
  const isWaitingTension = isWaiting || isSync;
  /** Cinematic pipeline before winner impact: dimmer strip, no waiting loops */
  const isCinematicPreResult =
    isResultSequence && ['RESULT_FREEZE', 'DEALING', 'REVEAL', 'SCORE'].includes(phaseStr);

  /** vector_win from settled payload (display only) */
  const outcomeVectorWin = useMemo(() => {
    if (!isResultSequence || !outcomeRow?.rawResult) return [];
    const flat = mergeResultEnvelopeForExtract(outcomeRow.rawResult);
    return extractVectorResultadoAndWinFromResultRaw(flat).vector_win;
  }, [isResultSequence, outcomeRow?.rawResult]);

  /** Text-shadow keyframes per side (same as legacy block); used to merge with waiting breath. */
  const predictionShadowKeyframes = useMemo(() => {
    const rs = recommendationSide(predictionLabel);
    if (rs === 'PLAYER') {
      return isLightMode
        ? [
            '0 0 10px rgba(8,145,178,0.35)',
            '0 0 28px rgba(8,145,178,0.85)',
            '0 0 10px rgba(8,145,178,0.35)',
          ]
        : [
            '0 0 14px rgba(34,211,238,0.45)',
            '0 0 38px rgba(34,211,238,0.98)',
            '0 0 14px rgba(34,211,238,0.45)',
          ];
    }
    if (rs === 'BANKER') {
      return isLightMode
        ? [
            '0 0 10px rgba(190,18,60,0.25)',
            '0 0 28px rgba(225,29,72,0.62)',
            '0 0 10px rgba(190,18,60,0.25)',
          ]
        : [
            '0 0 14px rgba(251,113,133,0.45)',
            '0 0 36px rgba(251,113,133,0.95)',
            '0 0 14px rgba(251,113,133,0.45)',
          ];
    }
    return ['0 0 0px transparent', '0 0 14px rgba(167,139,250,0.35)', '0 0 0px transparent'];
  }, [predictionLabel, isLightMode]);

  const predictionMotionAnimate = useMemo(() => {
    const shadow = predictionShadowKeyframes;
    if (isWaiting) {
      return {
        scale: [1, 1.04, 1],
        textShadow: shadow,
        filter: ['brightness(1)', 'brightness(1.12)', 'brightness(1)'],
      };
    }
    if (isResultSequence) {
      return {
        scale: isFreezePhase ? 0.97 : 1,
        textShadow: isCinematicPreResult
          ? ['0 0 8px rgba(0,0,0,0.25)', '0 0 12px rgba(255,255,255,0.06)', '0 0 8px rgba(0,0,0,0.25)']
          : shadow,
        filter: isCinematicPreResult ? 'brightness(0.88)' : 'brightness(1)',
      };
    }
    return { textShadow: shadow };
  }, [
    isWaiting,
    isResultSequence,
    isFreezePhase,
    isCinematicPreResult,
    predictionShadowKeyframes,
  ]);

  const predictionMotionTransition = useMemo(() => {
    if (isWaiting) {
      return { duration: WAITING_PRED_BREATH_S, repeat: Infinity, ease: 'easeInOut' };
    }
    if (isResultSequence) {
      return { duration: 0.45, repeat: 0, ease: CIN_EASE };
    }
    return { duration: 2.3, repeat: Infinity, ease: 'easeInOut' };
  }, [isWaiting, isResultSequence]);

  const showSignalBlock =
    activeRow &&
    (isWaitingTension ||
      status === 'RESULT' ||
      status === 'RESULT_SEQUENCE' ||
      status === 'SUCCESS' ||
      status === 'FAILED');

  const stripCompact =
    isWaitingTension ||
    (isResultSequence &&
      phaseVisual &&
      ['RESULT_FREEZE', 'DEALING', 'REVEAL'].includes(phaseVisual));
  const ambientSequence =
    (status === 'RESULT' || status === 'RESULT_SEQUENCE') &&
    (phaseStr === 'RESULT_FREEZE' || phaseStr === 'FINAL_HOLD' || phaseStr === 'MARTINGALE_UPDATE');

  const [bettingNow, setBettingNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isWaitingTension || cycleStartTs == null) return undefined;
    setBettingNow(Date.now());
    const id = window.setInterval(() => setBettingNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [isWaitingTension, cycleStartTs, activeRow?.id]);

  const bettingTimerRatio =
    cycleStartTs != null && isWaitingTension
      ? Math.min(1, Math.max(0, (bettingNow - cycleStartTs) / BETTING_WINDOW_MS))
      : 0;

  const [winnerHeroVisible, setWinnerHeroVisible] = useState(true);
  useEffect(() => {
    if ((status !== 'RESULT_SEQUENCE' && status !== 'RESULT') || phaseStr !== 'RESULT') {
      setWinnerHeroVisible(true);
      return undefined;
    }
    setWinnerHeroVisible(true);
    const id = window.setTimeout(() => setWinnerHeroVisible(false), 2000);
    return () => clearTimeout(id);
  }, [status, phaseStr, outcomeRow?.id]);

  /** Panel mesa/ganador/vector: solo tras SCORE en secuencia (teatro primero; evita salto de layout). */
  const showResultDetailsPanel =
    (status !== 'RESULT_SEQUENCE' && status !== 'RESULT') ||
    !phaseStr ||
    ['SCORE', 'RESULT', 'MARTINGALE_UPDATE', 'FINAL_HOLD'].includes(phaseStr);

  const uiPhase = useMemo(() => getUiPhaseFromEngineStatus(status), [status]);

  const uiLayerPresence = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -14 },
    transition: { duration: 0.36, ease: CIN_EASE },
  };

  return (
    <>
      {status === 'IDLE' ? (
        <div
          className="absolute bottom-10 z-30 w-full max-w-lg px-4 pointer-events-none"
          data-layer="ia-real-signal"
          data-z="30"
        >
          {suppressStoryText ? (
            <span className="sr-only">Listo · esperando señal en vivo</span>
          ) : (
            <p
              className={`text-center text-sm font-black uppercase tracking-[0.35em] ${isLightMode ? 'text-slate-600' : 'text-white/70'}`}
            >
              Listo · esperando señal en vivo
            </p>
          )}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {showSignalBlock && (uiPhase === 'CARDS_WAITING' || uiPhase === 'RESULT_SHOW') ? (
          <motion.div
            key={`sig-${activeRow.id}-live`}
            role="region"
            aria-label={
              suppressStoryText
                ? 'Señal activa: mesa, ronda, vector y cartas (motor IA Real)'
                : 'Señal activa'
            }
            initial={uiLayerPresence.initial}
            animate={uiLayerPresence.animate}
            exit={uiLayerPresence.exit}
            transition={uiLayerPresence.transition}
            className="absolute bottom-12 z-30 w-full flex flex-col items-center pointer-events-auto px-2 gap-3 origin-bottom"
            data-layer="ia-real-signal-live"
            data-z="30"
            data-ui-phase={uiPhase}
          >
            {(status === 'WAITING_RESULT' ||
              status === 'SYNC' ||
              status === 'RESULT' ||
              status === 'RESULT_SEQUENCE') && (
              <motion.div
                className="w-full max-w-4xl mx-auto relative z-0"
                animate={{
                  scale: stripCompact ? 0.9 : 1,
                  opacity: stripCompact ? 0.82 : 1,
                  y: ambientSequence ? [0, -2, 0] : 0,
                }}
                transition={{
                  duration: CIN_MS.slow,
                  ease: CIN_EASE,
                  opacity: { duration: CIN_MS.med, ease: CIN_EASE },
                  scale: { type: 'spring', stiffness: 380, damping: 32 },
                  y: ambientSequence
                    ? { repeat: Infinity, duration: 4.2, ease: 'easeInOut' }
                    : { duration: 0.2, ease: CIN_EASE },
                }}
              >
                {isWaitingTension ? (
                  <motion.div
                    className="pointer-events-none absolute -inset-x-8 -inset-y-3 rounded-[2rem] z-0 overflow-hidden"
                    aria-hidden
                    initial={false}
                    animate={{ opacity: [0.05, 0.1, 0.05] }}
                    transition={{
                      duration: WAITING_BG_DRIFT_S,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,rgba(139,92,246,0.42),transparent_65%)]" />
                  </motion.div>
                ) : null}
                {isCinematicPreResult ? (
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[2rem] z-[0] bg-black/25 backdrop-blur-[1px]"
                    aria-hidden
                  />
                ) : null}
                <div className="relative z-[1] space-y-5">
                {connectionMeta &&
                (connectionMeta.status === 'reconnecting' ||
                  connectionMeta.status === 'connecting' ||
                  connectionMeta.status === 'error') ? (
                  suppressStoryText ? (
                    <span className="sr-only">
                      Relay{' '}
                      {connectionMeta.status === 'error'
                        ? 'sin enlace'
                        : connectionMeta.status === 'reconnecting'
                          ? `reconexión${connectionMeta.reconnectAttempt ? ` · ${connectionMeta.reconnectAttempt}` : ''}`
                          : 'conectando'}
                    </span>
                  ) : (
                    <p
                      className={`text-center text-[10px] font-mono uppercase tracking-widest ${isLightMode ? 'text-amber-900' : 'text-amber-200/85'}`}
                    >
                      Relay:{' '}
                      {connectionMeta.status === 'error'
                        ? 'sin enlace'
                        : connectionMeta.status === 'reconnecting'
                          ? `reconexión${connectionMeta.reconnectAttempt ? ` · ${connectionMeta.reconnectAttempt}` : ''}`
                          : 'conectando…'}
                    </p>
                  )
                ) : null}
                {status === 'SYNC' ? (
                  suppressStoryText ? (
                    <span className="sr-only">Sincronizando</span>
                  ) : (
                    <p
                      className={`text-center text-[11px] font-black uppercase tracking-[0.2em] ${isLightMode ? 'text-amber-800' : 'text-amber-200/90'}`}
                    >
                      Sincronizando…
                    </p>
                  )
                ) : null}
                <div
                  className={`flex justify-center gap-4 flex-wrap transition-[box-shadow,filter] duration-500 ${
                    isWaitingTension && predSide === 'PLAYER'
                      ? 'rounded-[2rem] p-2 -m-1 ring-2 ring-cyan-400/40 shadow-[0_0_36px_rgba(34,211,238,0.28)]'
                      : isWaitingTension && predSide === 'BANKER'
                        ? 'rounded-[2rem] p-2 -m-1 ring-2 ring-rose-400/45 shadow-[0_0_36px_rgba(251,113,133,0.26)]'
                        : isWaitingTension
                          ? 'rounded-[2rem] p-2 -m-1 ring-2 ring-violet-400/35 shadow-[0_0_28px_rgba(167,139,250,0.22)]'
                          : ''
                  }`}
                >
                  <div
                    className={`${isLightMode ? 'bg-white shadow-md' : 'bg-black/60'} px-6 py-4 rounded-3xl border border-white/5 min-w-[200px] backdrop-blur-md transition-shadow duration-300`}
                  >
                    <p className="armani-label-dynamic mb-1 opacity-60">Mesa</p>
                    <p
                      className={`text-3xl font-black font-mono tracking-tighter ${isLightMode ? 'text-slate-800' : 'text-white'}`}
                    >
                      {String(activeRow.mesa ?? '—')}
                    </p>
                  </div>
                  <div
                    className={`${isLightMode ? 'bg-white shadow-md' : 'bg-black/60'} px-6 py-4 rounded-3xl border border-white/5 min-w-[120px] backdrop-blur-md`}
                  >
                    <p className="armani-label-dynamic mb-1 opacity-60">Ronda</p>
                    <p className={`text-4xl font-black font-mono ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                      {String(activeRow.round ?? '—')}
                    </p>
                  </div>
                  <div
                    className={`${isLightMode ? 'bg-white shadow-md' : 'bg-black/60'} px-6 py-4 rounded-3xl border border-white/5 min-w-[180px] backdrop-blur-md relative overflow-hidden`}
                  >
                    <p className="armani-label-dynamic mb-1 opacity-60">Apuesta (vector)</p>
                    <motion.p
                      className={`text-2xl font-black font-mono ${iaRealPredictionToneClasses(predictionLabel, isLightMode)}`}
                      animate={predictionMotionAnimate}
                      transition={predictionMotionTransition}
                    >
                      {predictionLabel}
                    </motion.p>
                  </div>
                </div>

                {isWaitingTension && cycleStartTs != null ? (
                  <div className="max-w-md mx-auto px-1 w-full">
                    <p
                      className={`text-[10px] font-mono uppercase tracking-wider text-center mb-1 ${isLightMode ? 'text-slate-500' : 'text-white/45'}`}
                    >
                      Ventana de tiros · timer
                    </p>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden ring-1 ring-white/5">
                      <motion.div
                        className={`h-full origin-left rounded-full ${
                          predSide === 'PLAYER'
                            ? 'bg-gradient-to-r from-cyan-400/95 via-cyan-300/90 to-cyan-500/95'
                            : predSide === 'BANKER'
                              ? 'bg-gradient-to-r from-rose-400/95 via-fuchsia-500/85 to-rose-500/95'
                              : 'bg-gradient-to-r from-violet-400/90 via-fuchsia-400/85 to-violet-500/90'
                        }`}
                        initial={false}
                        animate={{ width: `${bettingTimerRatio * 100}%` }}
                        transition={{ duration: 0.2, ease: 'linear' }}
                      />
                    </div>
                    <p className={`text-[10px] font-mono text-center mt-1 ${isLightMode ? 'text-slate-500' : 'text-white/40'}`}>
                      {Math.max(0, Math.ceil((1 - bettingTimerRatio) * (BETTING_WINDOW_MS / 1000)))}s restantes · paso proveedor T
                      {String(contadorEff ?? '—')}
                    </p>
                  </div>
                ) : null}

                {vfLen > 0 ? (
                  <div className="max-w-md mx-auto px-1">
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden ring-1 ring-white/5">
                      <motion.div
                        className="h-full origin-left rounded-full overflow-hidden"
                        style={{ width: `${stepProgressRatio * 100}%` }}
                        initial={false}
                        animate={{ width: `${stepProgressRatio * 100}%` }}
                        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                      >
                        <motion.div
                          className="h-full w-full origin-left rounded-full"
                          initial={false}
                          animate={isWaiting ? { scaleX: [1, 1.05, 1] } : { scaleX: 1 }}
                          transition={
                            isWaiting
                              ? {
                                  duration: WAITING_BAR_BREATHE_S,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                }
                              : { duration: 0 }
                          }
                        >
                          <div className="h-full w-full rounded-full bg-gradient-to-r from-cyan-400/90 via-violet-400/85 to-fuchsia-400/80" />
                        </motion.div>
                      </motion.div>
                    </div>
                    <p className={`text-[10px] font-mono text-center mt-1.5 ${isLightMode ? 'text-slate-500' : 'text-white/40'}`}>
                      Paso {Math.min(vfLen, Number(effectiveStepIndex) + 1)} / {vfLen} · datos proveedor
                    </p>
                  </div>
                ) : null}

                <div className="flex justify-center flex-wrap gap-2.5">
                  {extractVectorForecastFromActiveRow(activeRow).map((t, idx) => {
                    const activeIdx = Number(effectiveStepIndex) || 0;
                    const isActive = idx === activeIdx;
                    const dim = iaRealVectorMaturityDimClass(idx, activeIdx);
                    let cellAnimate = { y: 0, scale: 1, boxShadow: '0 0 0 0 transparent' };
                    let cellTransition = { duration: 0.2, ease: CIN_EASE };
                    if (isActive) {
                      if (isWaiting) {
                        cellAnimate = {
                          y: [0, -3, 0],
                          scale: [1, 1.05, 1],
                          boxShadow: [
                            '0 0 0 0 rgba(168,85,247,0)',
                            '0 0 14px 3px rgba(168,85,247,0.78)',
                            '0 0 0 0 rgba(168,85,247,0)',
                          ],
                        };
                        cellTransition = { duration: WAITING_CELL_PULSE_S, repeat: Infinity, ease: CIN_EASE };
                      } else if (isSync) {
                        cellAnimate = {
                          y: [0, -2, 0],
                          scale: [1, 1.04, 1],
                          boxShadow: [
                            '0 0 0 0 rgba(251,191,36,0)',
                            '0 0 12px 2px rgba(251,191,36,0.55)',
                            '0 0 0 0 rgba(251,191,36,0)',
                          ],
                        };
                        cellTransition = { duration: 1.1, repeat: Infinity, ease: CIN_EASE };
                      } else if (isResultSequence) {
                        if (['RESULT_FREEZE', 'DEALING', 'REVEAL', 'SCORE'].includes(phaseStr)) {
                          cellAnimate = {
                            y: 0,
                            scale: 1,
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.14)',
                          };
                          cellTransition = { duration: 0.35, repeat: 0, ease: CIN_EASE };
                        } else if (phaseStr === 'RESULT') {
                          const hit = outcomeRow?.winStatus === true;
                          cellAnimate = {
                            scale: [1, 1.12, 1],
                            boxShadow: hit
                              ? [
                                  '0 0 0 0 rgba(52,211,153,0)',
                                  '0 0 22px 4px rgba(52,211,153,0.65)',
                                  '0 0 0 0 rgba(52,211,153,0)',
                                ]
                              : [
                                  '0 0 0 0 rgba(251,113,133,0)',
                                  '0 0 22px 4px rgba(251,113,133,0.55)',
                                  '0 0 0 0 rgba(251,113,133,0)',
                                ],
                          };
                          cellTransition = { duration: 0.55, repeat: 0, ease: CIN_EASE };
                        } else {
                          cellAnimate = {
                            y: [0, -2, 0],
                            scale: [1, 1.05, 1],
                            boxShadow: [
                              '0 0 0 0 rgba(34,211,238,0)',
                              '0 0 14px 2px rgba(34,211,238,0.28)',
                              '0 0 0 0 rgba(34,211,238,0)',
                            ],
                          };
                          cellTransition = { duration: 1.4, repeat: Infinity, ease: CIN_EASE };
                        }
                      } else {
                        cellAnimate = {
                          y: [0, -4, 0],
                          scale: [1, 1.06, 1],
                          boxShadow: [
                            '0 0 0 0 rgba(34,211,238,0)',
                            '0 0 20px 1px rgba(34,211,238,0.4)',
                            '0 0 0 0 rgba(34,211,238,0)',
                          ],
                        };
                        cellTransition = { duration: 2.2, repeat: Infinity, ease: CIN_EASE };
                      }
                    }
                    const winStep =
                      isResultSequence &&
                      outcomeVectorWin.length > idx &&
                      parseVectorWinStep(outcomeVectorWin[idx]);
                    const showStepBadge =
                      isResultSequence &&
                      ['SCORE', 'RESULT', 'MARTINGALE_UPDATE', 'FINAL_HOLD'].includes(phaseStr) &&
                      winStep !== null;
                    return (
                      <div key={`vf-wrap-${activeRow.id}-${idx}`} className={dim}>
                        <div className="flex flex-col items-center gap-0.5">
                          <motion.div
                            layout
                            key={`vf-${activeRow.id}-${idx}-${activeIdx}`}
                            className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-sm font-black ${iaRealVectorCellToneClasses(t, isLightMode, isActive)}`}
                            animate={cellAnimate}
                            transition={cellTransition}
                          >
                            {t}
                          </motion.div>
                          {showStepBadge ? (
                            <span
                              className={`text-[8px] font-black uppercase tracking-tight ${
                                winStep === true
                                  ? 'text-emerald-400'
                                  : winStep === false
                                    ? 'text-rose-400'
                                    : 'text-white/35'
                              }`}
                            >
                              {winStep === true ? 'WIN' : winStep === false ? 'LOSS' : '—'}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {suppressStoryText ? (
                  <span className="sr-only">Esperando resultado del proveedor</span>
                ) : (
                  <>
                    <p
                      className={`text-center text-xs font-black uppercase tracking-[0.28em] ${isLightMode ? 'text-slate-500' : 'text-white/55'}`}
                    >
                      Esperando resultado…
                    </p>
                    {status === 'WAITING_RESULT' ? (
                      <p
                        className={`text-center text-[10px] font-medium normal-case tracking-normal mt-1 ${isLightMode ? 'text-amber-800/90' : 'text-amber-200/75'}`}
                      >
                        Sin cierre automático: el estado se mantiene hasta NEW_RESULT del proveedor.
                      </p>
                    ) : null}
                  </>
                )}
                </div>
                {/*
                  Vector arriba; teatro de cartas debajo — todo bajo `iaRealEngineState.status` (sin gamePhase).
                */}
              </motion.div>
            )}
            <IaRealCardTheater
              status={status}
              phaseVisual={phaseVisual ?? null}
              outcomeRow={outcomeRow ?? null}
              activeRow={activeRow ?? null}
              cycleStartTs={cycleStartTs}
              augmentSignalRow={rowForAugment}
            />

            {uiPhase === 'RESULT_SHOW' &&
            (status === 'RESULT_SEQUENCE' || status === 'SUCCESS' || status === 'FAILED') &&
            outcomeRow &&
            showResultDetailsPanel ? (
              <motion.div
                key={`res-inner-${outcomeRow.id}`}
                role="region"
                aria-live="polite"
                aria-label="Resultado de mesa"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="w-full max-w-xl mx-auto pointer-events-auto px-1"
                data-layer="ia-real-result"
                data-z="30"
              >
                {(() => {
                  const rawForExtract = resolveOutcomeRowResultPayload(outcomeRow) ?? outcomeRow?.rawResult;
                  const meta = extractMesaInfoFlexible(rawForExtract ?? {});
                  const scoresLbl = extractScoreLabelsFromResultRaw(rawForExtract ?? {});
                  const gan = meta.ganador ? String(meta.ganador) : '—';
                  const gSide = normalizeGanadorSide(meta.ganador);
                  const cardsP = Array.isArray(meta.cartas_player) ? meta.cartas_player : [];
                  const cardsB = Array.isArray(meta.cartas_banker) ? meta.cartas_banker : [];
                  const hasCardTheater = cardsP.length > 0 || cardsB.length > 0;
                  const vf = extractVectorForecastFromActiveRow(activeRow ?? outcomeRow);
                  const winIdx = winnerVectorIndexFromGanador(vf, meta.ganador);
                  const activeIdx = Number(effectiveStepIndex) || 0;
                  const seq = status === 'RESULT' || status === 'RESULT_SEQUENCE';
                  const pv = phaseVisual;
                  const showScoresPhase =
                    !seq || !pv || ['SCORE', 'RESULT', 'MARTINGALE_UPDATE', 'FINAL_HOLD'].includes(pv);
                  const showWinnerPhase =
                    !seq || !pv || ['RESULT', 'MARTINGALE_UPDATE', 'FINAL_HOLD'].includes(pv);
                  const showBannerPhase =
                    !seq || !pv || ['RESULT', 'MARTINGALE_UPDATE', 'FINAL_HOLD'].includes(pv);
                  const hit = outcomeRow?.winStatus === true;
                  const winFlash = !showWinnerPhase
                    ? ''
                    : gSide === 'PLAYER'
                      ? 'shadow-[0_0_28px_rgba(34,211,238,0.55)] border-cyan-400/50'
                      : gSide === 'BANKER'
                        ? 'shadow-[0_0_28px_rgba(251,113,133,0.5)] border-rose-400/45'
                        : '';

                  return (
                    <motion.div
                      className="space-y-4 origin-center"
                      initial={false}
                      animate={
                        seq && pv === 'RESULT' ? { scale: [1, 1.018, 1] } : { scale: 1 }
                      }
                      transition={{ duration: 0.45, ease: CIN_EASE }}
                    >
                      {seq && pv === 'RESULT' && gSide !== 'OTHER' ? (
                        suppressStoryText ? (
                          <span className="sr-only">
                            Resultado: {gSide === 'PLAYER' ? 'PLAYER' : gSide === 'BANKER' ? 'BANKER' : 'TIE'}
                          </span>
                        ) : (
                          <motion.div
                            className="w-full"
                            initial={false}
                            animate={{ opacity: winnerHeroVisible ? 1 : 0 }}
                            transition={{ duration: 0.48, ease: CIN_EASE }}
                          >
                            <motion.p
                              className={`text-center text-3xl sm:text-4xl font-black tracking-[0.14em] ${
                                gSide === 'PLAYER'
                                  ? 'text-cyan-200 drop-shadow-[0_0_34px_rgba(34,211,238,0.95)]'
                                  : gSide === 'BANKER'
                                    ? 'text-rose-200 drop-shadow-[0_0_34px_rgba(251,113,133,0.92)]'
                                    : 'text-emerald-200 drop-shadow-[0_0_30px_rgba(52,211,153,0.92)]'
                              }`}
                              initial={{ scale: 1, opacity: 1 }}
                              animate={{ scale: [1, 1.2, 1], opacity: 1 }}
                              transition={{ duration: 0.68, ease: CIN_EASE, times: [0, 0.45, 1] }}
                            >
                              {gSide === 'PLAYER' ? 'PLAYER' : gSide === 'BANKER' ? 'BANKER' : 'TIE'}
                            </motion.p>
                          </motion.div>
                        )
                      ) : null}
                      <motion.div
                        className={`rounded-2xl border px-4 py-3 text-left ${isLightMode ? 'bg-white border-slate-200' : `bg-black/55 border-white/10 ${winFlash}`} ${!showWinnerPhase ? 'opacity-80' : ''}`}
                        initial={false}
                        animate={
                          showWinnerPhase && gSide !== 'OTHER'
                            ? {
                                boxShadow: [
                                  '0 0 0 0 rgba(0,0,0,0)',
                                  gSide === 'PLAYER'
                                    ? '0 0 32px 2px rgba(34,211,238,0.35)'
                                    : '0 0 32px 2px rgba(251,113,133,0.32)',
                                  gSide === 'PLAYER'
                                    ? '0 0 22px 0 rgba(34,211,238,0.22)'
                                    : '0 0 22px 0 rgba(251,113,133,0.2)',
                                ],
                              }
                            : { boxShadow: '0 0 0 0 rgba(0,0,0,0)' }
                        }
                        transition={{
                          duration: 0.72,
                          ease: CIN_EASE,
                          delay: seq && pv === 'RESULT' ? 0.08 : 0,
                        }}
                      >
                        <p className="armani-label-dynamic mb-1 opacity-60">Ganador</p>
                        <motion.p
                          className={`text-2xl font-black font-mono ${
                            gSide === 'PLAYER'
                              ? isLightMode
                                ? 'text-cyan-700'
                                : 'text-cyan-200'
                              : gSide === 'BANKER'
                                ? isLightMode
                                  ? 'text-rose-800'
                                  : 'text-rose-200'
                                : isLightMode
                                  ? 'text-slate-900'
                                  : 'text-white'
                          }`}
                          initial={{ scale: 1.08, filter: 'brightness(1.35)' }}
                          animate={{
                            scale: showWinnerPhase ? 1 : 0.98,
                            filter: showWinnerPhase ? 'brightness(1)' : 'brightness(0.85)',
                          }}
                          transition={{
                            duration: 0.52,
                            ease: CIN_EASE,
                            delay: seq && pv === 'RESULT' ? 0.08 : 0,
                          }}
                        >
                          {gan}
                        </motion.p>

                        <div className="mt-3 space-y-2">
                          {/* Chips solo si no hay cartas en teatro (misma fuente meta; evita duplicar con neon cards). */}
                          {!hasCardTheater && (cardsP.length > 0 || cardsB.length > 0) ? (
                            <div className="flex flex-col gap-2 text-[11px] font-mono">
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className={`opacity-60 w-12 ${gSide === 'PLAYER' ? 'text-cyan-400' : ''}`}>Player</span>
                                {cardsP.map((c, i) => (
                                  <motion.span
                                    key={`cp-${i}`}
                                    initial={{ opacity: 0, rotateY: -40 }}
                                    animate={{ opacity: 1, rotateY: 0 }}
                                    transition={{ delay: 0.12 + i * 0.06, duration: 0.35 }}
                                    className={`rounded-md px-2 py-0.5 border ${
                                      gSide === 'PLAYER'
                                        ? isLightMode
                                          ? 'border-cyan-400 bg-cyan-500/10 text-cyan-900'
                                          : 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
                                        : 'border-white/10'
                                    }`}
                                  >
                                    {String(c)}
                                  </motion.span>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className={`opacity-60 w-12 ${gSide === 'BANKER' ? 'text-rose-400' : ''}`}>Banker</span>
                                {cardsB.map((c, i) => (
                                  <motion.span
                                    key={`cb-${i}`}
                                    initial={{ opacity: 0, rotateY: 40 }}
                                    animate={{ opacity: 1, rotateY: 0 }}
                                    transition={{ delay: 0.22 + (cardsP.length + i) * 0.06, duration: 0.35 }}
                                    className={`rounded-md px-2 py-0.5 border ${
                                      gSide === 'BANKER'
                                        ? isLightMode
                                          ? 'border-rose-400 bg-rose-500/10 text-rose-900'
                                          : 'border-rose-400/50 bg-rose-500/15 text-rose-100'
                                        : 'border-white/10'
                                    }`}
                                  >
                                    {String(c)}
                                  </motion.span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {(scoresLbl.puntajePlayer || scoresLbl.puntajeBanker) && showScoresPhase ? (
                            <motion.p
                              className="mt-1 text-sm font-mono opacity-90"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.45, ease: CIN_EASE }}
                            >
                              {scoresLbl.puntajePlayer != null ? `Player ${scoresLbl.puntajePlayer}` : ''}
                              {scoresLbl.puntajePlayer != null && scoresLbl.puntajeBanker != null ? ' · ' : ''}
                              {scoresLbl.puntajeBanker != null ? `Banker ${scoresLbl.puntajeBanker}` : ''}
                            </motion.p>
                          ) : null}
                        </div>
                      </motion.div>

                      {vf.length > 0 ? (
                        <div className="flex justify-center flex-wrap gap-2 pointer-events-none">
                          {vf.map((t, idx) => {
                            const dim = iaRealVectorResultDimClass(idx, activeIdx, winIdx);
                            const pulseWin = showWinnerPhase && winIdx >= 0 && idx === winIdx;
                            return (
                              <motion.div
                                key={`vfr-${idx}`}
                                initial={{ scale: 0.85, opacity: 0 }}
                                animate={{
                                  scale: pulseWin ? [1, 1.12, 1.05] : 1,
                                  opacity: 1,
                                }}
                                transition={{
                                  delay: 0.35 + idx * 0.05,
                                  duration: pulseWin ? 0.55 : 0.3,
                                  ease: CIN_EASE,
                                }}
                                className={`${dim}`}
                              >
                                <div
                                  className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center text-xs font-black transition-[transform,box-shadow] duration-300 ${iaRealVectorCellToneClasses(
                                    t,
                                    isLightMode,
                                    idx === activeIdx,
                                    showWinnerPhase && winIdx >= 0 && idx === winIdx,
                                  )}`}
                                >
                                  {t}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : null}

                      <AnimatePresence>
                        {showBannerPhase && hit ? (
                          suppressStoryText ? (
                            <span key="ok-sr" className="sr-only">
                              Señal acertada
                            </span>
                          ) : (
                            <motion.p
                              key="ok"
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.35 }}
                              className="text-center text-lg font-black text-emerald-400 tracking-wide drop-shadow-[0_0_14px_rgba(52,211,153,0.55)]"
                            >
                              SEÑAL ACERTADA
                            </motion.p>
                          )
                        ) : null}
                        {showBannerPhase && !hit ? (
                          suppressStoryText ? (
                            <span key="fail-sr" className="sr-only">
                              Señal fallida
                            </span>
                          ) : (
                            <motion.p
                              key="fail"
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.35 }}
                              className="text-center text-lg font-black text-rose-400 tracking-wide drop-shadow-[0_0_14px_rgba(251,113,133,0.45)]"
                            >
                              SEÑAL FALLIDA
                            </motion.p>
                          )
                        ) : null}
                      </AnimatePresence>
                    </motion.div>
                  );
                })()}
              </motion.div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
