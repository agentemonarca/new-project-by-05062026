import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  extractMesaInfoFlexible,
  resolveContadorMartingalaForUi,
  resolveOutcomeRowResultPayload,
} from '../../utils/iaRealEngineUi.js';
import { parseBaccaratCardToken } from '../../utils/parseBaccaratCardToken.js';
import { BaccaratNeonCard } from './BaccaratNeonCard.jsx';

const PLACEHOLDER_SLOTS = 2;
const CIN_EASE = [0.4, 0, 0.2, 1];
/** SYNC: dorsos — loop suave ~2s (motion repeat, no timers) */
const WAIT_DEAL_LOOP_S = 2;
/** WAITING_RESULT: nueva animación por cambio de martingale (T1–T6) */
const WAIT_STEP_DEAL_S = 0.4;
const WAIT_STEP_STAGGER = 0.1;
/** DEALING: 200–300ms per card (visual only; driven by phaseVisual) */
const DEAL_MS = 0.26;
const DEAL_STAGGER = 0.09;
/** REVEAL: 3D flip duration */
const REVEAL_FLIP_MS = 0.4;
/** RESULT: carta 1 → 0ms, carta 2 → 300ms, carta 3 → 600ms (orden global intercalado) */
const RESULT_REVEAL_STEP_MS = 300;

/** Interleaved reveal order: P0→0, B0→1, P1→2, … */
function interleavedOrder(side, idx) {
  return side === 'p' ? idx * 2 : idx * 2 + 1;
}

/** Relay a veces manda cartas como string u objeto indexado; sin esto `cartas_player?.length` falla y no hay tokens. */
function coerceCardList(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
  if (typeof raw === 'object') {
    const o = /** @type {Record<string, unknown>} */ (raw);
    return Object.keys(o)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => String(o[k] ?? '').trim())
      .filter(Boolean);
  }
  const s = String(raw).trim();
  return s ? [s] : [];
}

/**
 * IA Real: card backs while waiting; cinematic phases from `phaseVisual` during RESULT_SEQUENCE.
 *
 * Cartas y fases solo desde `outcomeRow` / `activeRow` (Zustand `externalSignalsStore` vía App); sin admin feed.
 *
 * @param {{ status?: string, outcomeRow?: object | null, phaseVisual?: string | null, activeRow?: object | null, cycleStartTs?: number | null, augmentSignalRow?: object | null }} props
 */
export function IaRealCardTheater({
  status,
  outcomeRow,
  phaseVisual = null,
  activeRow = null,
  cycleStartTs = null,
  augmentSignalRow = null,
}) {
  const DEBUG_CARD_THEATER =
    String(import.meta.env.VITE_DEBUG_IA_CARD_THEATER ?? '').trim() === '1' ||
    String(import.meta.env.VITE_DEBUG_IA_RESULT_FRONT ?? '').trim() === '1';

  const isWait = status === 'WAITING_RESULT' || status === 'SYNC';
  /** Paso T1–T6 solo desde fila Zustand (`martingale` / `rawSignal.contador_martingala`). */
  const sourceRowForMartingale = augmentSignalRow ?? activeRow ?? null;
  const step = useMemo(
    () => resolveContadorMartingalaForUi(sourceRowForMartingale),
    [sourceRowForMartingale],
  );

  const isSeq = status === 'RESULT' || status === 'RESULT_SEQUENCE';
  const isLegacy = status === 'SUCCESS' || status === 'FAILED';

  /** No depender de `gamePhase`: solo estados de resultado del motor IA Real. */
  const isResultPhase = isSeq || isLegacy;

  /** FASE 5: cartas solo desde `rawResult` del proveedor (sin enriquecer con admin feed). */
  const resultMesaMeta = useMemo(() => {
    if (!outcomeRow) return null;
    const rawPayload = resolveOutcomeRowResultPayload(outcomeRow) ?? outcomeRow.rawResult;
    if (rawPayload == null) return null;
    return extractMesaInfoFlexible(rawPayload);
  }, [outcomeRow]);

  const playerTokens = useMemo(
    () => coerceCardList(resultMesaMeta?.cartas_player),
    [resultMesaMeta],
  );
  const bankerTokens = useMemo(
    () => coerceCardList(resultMesaMeta?.cartas_banker),
    [resultMesaMeta],
  );

  /** Dealing T1–T6: animación de “tiros” solo en espera activa de resultado. */
  const isBettingDealBurst = status === 'WAITING_RESULT';

  /** Result UI: cartas reales cuando hay fase de resultado y datos en `rawResult` (via `resultMesaMeta`). */
  const showRealResultCards = !isWait && isResultPhase;

  const pv = phaseVisual != null ? String(phaseVisual) : '';

  useEffect(() => {
    if (!outcomeRow) return;
    const rawResult = resolveOutcomeRowResultPayload(outcomeRow) ?? outcomeRow.rawResult;
    if (rawResult == null) return;
    console.log('🎴 CARTAS EXTRAIDAS', extractMesaInfoFlexible(rawResult));
  }, [outcomeRow]);

  useEffect(() => {
    if (!DEBUG_CARD_THEATER) return;
    if (!outcomeRow?.rawResult) return;
    console.log('🧾 RAW RESULT', outcomeRow.rawResult);
    const rawResolved = resolveOutcomeRowResultPayload(outcomeRow) ?? outcomeRow.rawResult;
    console.log('🧾 META', extractMesaInfoFlexible(rawResolved));
    console.log('🧾 THEATER', {
      showRealResultCards,
      isResultPhase,
      isWait,
      phaseVisual: pv,
      resultMesaMeta,
      playerTokensLen: playerTokens.length,
      bankerTokensLen: bankerTokens.length,
    });
  }, [
    DEBUG_CARD_THEATER,
    outcomeRow?.rawResult,
    outcomeRow,
    showRealResultCards,
    isResultPhase,
    isWait,
    pv,
    resultMesaMeta,
    playerTokens.length,
    bankerTokens.length,
  ]);

  /** En resultado: solo ranuras con cartas reales del proveedor; sin relleno ·/♠. En espera: dorsos. */
  const slotsP = isWait ? PLACEHOLDER_SLOTS : playerTokens.length;
  const slotsB = isWait ? PLACEHOLDER_SLOTS : bankerTokens.length;

  /** Rostros legacy por `phaseVisual` en fases de revelado/score. */
  const legacyRevealFaces =
    !showRealResultCards &&
    (isLegacy ||
      (isSeq && pv && ['REVEAL', 'SCORE', 'RESULT', 'MARTINGALE_UPDATE', 'FINAL_HOLD'].includes(pv)));

  const isFreeze = isSeq && pv === 'RESULT_FREEZE';
  const isDealing = isSeq && pv === 'DEALING';
  const isReveal = isSeq && pv === 'REVEAL';
  const revealCharge = isSeq && pv === 'REVEAL';
  const holdAmbient = isSeq && pv === 'FINAL_HOLD';

  const showSyncWaitLoop = isWait && !isBettingDealBurst;

  /** Layout fijo en RESULT App: sin freeze/dealing cinematográfico por slot. */
  const simpleResultLayout = showRealResultCards;

  if (!isWait && !isResultPhase) return null;

  return (
    <motion.div
      className="pointer-events-none w-full max-w-2xl mx-auto px-2 mb-3"
      data-layer="ia-real-card-theater"
      data-game-step={step}
      data-z="28"
      data-ganador={resultMesaMeta?.ganador ?? undefined}
      style={{ perspective: '1200px' }}
      animate={
        simpleResultLayout
          ? { y: 0, opacity: 1, scale: 1, filter: 'brightness(1)' }
          : isWait
            ? { y: 0, opacity: 1 }
            : isFreeze
              ? { scale: 0.96, opacity: 0.88, filter: 'brightness(0.82)', y: 0 }
              : isDealing
                ? { scale: [1, 1.02, 1], filter: ['brightness(0.92)', 'brightness(1)', 'brightness(0.95)'] }
                : revealCharge
                  ? { scale: [1.02, 1], filter: ['brightness(1)', 'brightness(1.08)', 'brightness(1)'] }
                  : holdAmbient
                    ? { opacity: [0.94, 1, 0.94] }
                    : { scale: 1, opacity: 1, rotateZ: 0, filter: 'brightness(1)' }
      }
      transition={{
        duration: simpleResultLayout ? 0.25 : isFreeze ? 0.35 : isDealing ? 0.55 : revealCharge ? 0.48 : holdAmbient ? 4 : 0.35,
        repeat: holdAmbient ? Infinity : 0,
        ease: CIN_EASE,
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <motion.p
          className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40"
          animate={{
            opacity: isWait ? [0.4, 0.65, 0.4] : isFreeze ? 0.38 : [0.4, 0.7, 0.45],
          }}
          transition={{
            duration: isWait ? WAIT_DEAL_LOOP_S : isFreeze ? 0 : 1.6,
            repeat: isFreeze ? 0 : Infinity,
            ease: CIN_EASE,
          }}
        >
          {isWait
            ? 'Mano en juego · cartas ocultas'
            : simpleResultLayout
              ? resultMesaMeta?.ganador
                ? `Resultado · ${String(resultMesaMeta.ganador)}`
                : 'Resultado'
              : isFreeze
                ? 'Momento decisivo…'
                : 'Revelación'}
        </motion.p>
        <div className="flex flex-wrap justify-center items-end gap-4 sm:gap-10">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400/90">Player</span>
            <div className="flex justify-center pl-2" style={{ gap: 0 }}>
              {Array.from({ length: slotsP }).map((_, i) => {
                const tok = playerTokens[i];
                const parsed = tok != null ? parseBaccaratCardToken(tok, i) : null;
                const order = interleavedOrder('p', i);
                const showFace = Boolean(tok) && showRealResultCards;
                const showFaceLegacy = Boolean(tok) && legacyRevealFaces;
                const faceUp = showFace || showFaceLegacy;
                return (
                  <div
                    key={`p-${i}`}
                    className={i > 0 ? '-ml-6 sm:-ml-8' : ''}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <motion.div
                      key={
                        isBettingDealBurst
                          ? `card-${step}-${i}`
                          : `p-${i}-${pv}-${isWait ? 'w' : 's'}`
                      }
                      style={{ transformStyle: 'preserve-3d', perspective: 900 }}
                      initial={
                        simpleResultLayout
                          ? { y: 6, opacity: 0.88 }
                          : isBettingDealBurst
                            ? { y: -30, opacity: 0 }
                            : isWait
                              ? false
                              : isDealing
                                ? { y: -36, opacity: 0, rotateZ: -6, filter: 'blur(7px)' }
                                : isReveal && faceUp
                                  ? { rotateY: 78, opacity: 0.85 }
                                  : false
                      }
                      animate={
                        simpleResultLayout
                          ? { y: 0, opacity: 1 }
                          : isBettingDealBurst
                            ? { y: 0, opacity: 1 }
                            : showSyncWaitLoop
                              ? { y: [14, 0, 2, 14], opacity: [0, 1, 1, 0.88] }
                              : {
                                  y: 0,
                                  opacity: 1,
                                  rotateZ: 0,
                                  filter: 'blur(0px)',
                                  rotateY: faceUp ? 0 : 0,
                                }
                      }
                      transition={
                        simpleResultLayout
                          ? { duration: 0.32, delay: order * (RESULT_REVEAL_STEP_MS / 1000), ease: CIN_EASE }
                          : isBettingDealBurst
                            ? {
                                duration: WAIT_STEP_DEAL_S,
                                delay: order * WAIT_STEP_STAGGER,
                                ease: CIN_EASE,
                              }
                            : showSyncWaitLoop
                              ? {
                                  duration: WAIT_DEAL_LOOP_S,
                                  repeat: Infinity,
                                  delay: order * 0.12,
                                  ease: CIN_EASE,
                                  times: [0, 0.2, 0.72, 1],
                                }
                              : {
                                  duration: isDealing ? DEAL_MS : isReveal && faceUp ? REVEAL_FLIP_MS : 0.35,
                                  delay: isDealing ? order * DEAL_STAGGER : isReveal && faceUp ? order * 0.04 : 0,
                                  ease: CIN_EASE,
                                }
                      }
                    >
                      <BaccaratNeonCard
                        displayRank={parsed?.displayRank ?? '·'}
                        suit={parsed?.suit ?? '♠'}
                        isRed={parsed?.isRed ?? false}
                        isRevealed={faceUp}
                        isDealt={isWait || isResultPhase}
                      />
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
          <span className="hidden sm:block text-white/25 text-sm font-black italic pb-8">VS</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400/90">Banker</span>
            <div className="flex justify-center pl-2">
              {Array.from({ length: slotsB }).map((_, j) => {
                const tok = bankerTokens[j];
                const parsed = tok != null ? parseBaccaratCardToken(tok, j + 4) : null;
                const order = interleavedOrder('b', j);
                const showFace = Boolean(tok) && showRealResultCards;
                const showFaceLegacy = Boolean(tok) && legacyRevealFaces;
                const faceUp = showFace || showFaceLegacy;
                return (
                  <div
                    key={`b-${j}`}
                    className={j > 0 ? '-ml-6 sm:-ml-8' : ''}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <motion.div
                      key={
                        isBettingDealBurst
                          ? `card-${step}-${j + 4}`
                          : `b-${j}-${pv}-${isWait ? 'w' : 's'}`
                      }
                      style={{ transformStyle: 'preserve-3d', perspective: 900 }}
                      initial={
                        simpleResultLayout
                          ? { y: 6, opacity: 0.88 }
                          : isBettingDealBurst
                            ? { y: -30, opacity: 0 }
                            : isWait
                              ? false
                              : isDealing
                                ? { y: -36, opacity: 0, rotateZ: 6, filter: 'blur(7px)' }
                                : isReveal && faceUp
                                  ? { rotateY: -78, opacity: 0.85 }
                                  : false
                      }
                      animate={
                        simpleResultLayout
                          ? { y: 0, opacity: 1 }
                          : isBettingDealBurst
                            ? { y: 0, opacity: 1 }
                            : showSyncWaitLoop
                              ? { y: [14, 0, 2, 14], opacity: [0, 1, 1, 0.88] }
                              : {
                                  y: 0,
                                  opacity: 1,
                                  rotateZ: 0,
                                  filter: 'blur(0px)',
                                  rotateY: faceUp ? 0 : 0,
                                }
                      }
                      transition={
                        simpleResultLayout
                          ? { duration: 0.32, delay: order * (RESULT_REVEAL_STEP_MS / 1000), ease: CIN_EASE }
                          : isBettingDealBurst
                            ? {
                                duration: WAIT_STEP_DEAL_S,
                                delay: order * WAIT_STEP_STAGGER,
                                ease: CIN_EASE,
                              }
                            : showSyncWaitLoop
                              ? {
                                  duration: WAIT_DEAL_LOOP_S,
                                  repeat: Infinity,
                                  delay: order * 0.12,
                                  ease: CIN_EASE,
                                  times: [0, 0.2, 0.72, 1],
                                }
                              : {
                                  duration: isDealing ? DEAL_MS : isReveal && faceUp ? REVEAL_FLIP_MS : 0.35,
                                  delay: isDealing ? order * DEAL_STAGGER : isReveal && faceUp ? order * 0.04 : 0,
                                  ease: CIN_EASE,
                                }
                      }
                    >
                      <BaccaratNeonCard
                        displayRank={parsed?.displayRank ?? '·'}
                        suit={parsed?.suit ?? '♠'}
                        isRed={parsed?.isRed ?? false}
                        isRevealed={faceUp}
                        isDealt={isWait || isResultPhase}
                      />
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
