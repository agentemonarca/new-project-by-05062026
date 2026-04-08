import { useCallback, useEffect, useRef, useState } from 'react';
import { getAdminSignalsLiveSnapshot } from '@/realtime/adminSignalsLiveStore.js';
import {
  LAB_PHASE,
  HUMAN_BETTING_MS,
  HUMAN_FORECAST_MAX_SHOTS,
  HUMAN_LOCKED_MS,
  HUMAN_PAUSE_BETWEEN_SHOTS_MS,
  HUMAN_RESULT_MS,
  HUMAN_SIGNAL_DETECTED_MS,
  PRE_IN_PROGRESS_DWELL_MS,
  SIGNAL_DETECTED_TO_IN_PROGRESS_MS,
  phaseStripOrderFor,
} from '@/lab/vistaLabSharedConstants.js';
import {
  evaluateWaitingHead,
  findMatchingResultForSignal,
  forecastStepMisalignedWithGanador,
  martingaleDataFromSignal,
  resultMatchesSignal,
} from '@/utils/vistaLabCycle.js';
import { computeFullCardRevealBeforeResultMs } from '@/components/lab/VistaLabCardReveal.jsx';

/**
 * Motor de ciclo VistaLab (misma máquina de estados que `VistaLabPanel`).
 * Los efectos leen el buffer actual vía `getAdminSignalsLiveSnapshot()`; `rev` solo fuerza re-ejecución al bump del store.
 * Opcional: `signals` / `results` del mismo snapshot (documentación; no se bifurca la lógica).
 *
 * @param {{
 *   labMode?: 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'full',
 *   rev: number,
 *   connected: boolean,
 *   signals?: unknown[],
 *   results?: unknown[],
 *   autoStart?: boolean,
 * }} [opts]
 */
export function useVistaLabCycle(opts = {}) {
  const labMode = opts.labMode ?? 'phase4';
  const { rev, connected } = opts;
  const autoStart = opts.autoStart ?? false;
  const autoStartedRef = useRef(false);

  /** @typedef {import('@/lab/vistaLabSharedConstants.js').LabPhase} LabPhase */

  const [phase, setPhase] = useState(/** @type {LabPhase} */ (LAB_PHASE.WAITING));
  const [activeSignal, setActiveSignal] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [activeResult, setActiveResult] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [isRunning, setIsRunning] = useState(false);
  const [cooldownCount, setCooldownCount] = useState(/** @type {number | null} */ (null));
  const [labNotice, setLabNotice] = useState(/** @type {string | null} */ (null));
  const [shotIndex, setShotIndex] = useState(0);
  const [bettingRemainingMs, setBettingRemainingMs] = useState(/** @type {number | null} */ (null));

  const isRunningRef = useRef(isRunning);
  const phaseRef = useRef(phase);
  const activeSignalRef = useRef(activeSignal);
  const timersRef = useRef(/** @type {ReturnType<typeof setTimeout>[]} */ ([]));
  const cooldownIntervalRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null));
  const bettingIntervalRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null));
  const waitBarrierRecvIdRef = useRef(/** @type {string | null} */ (null));
  const consumedResultRecvIdRef = useRef(/** @type {string | null} */ (null));
  const lastAppliedResultRecvIdRef = useRef(/** @type {string | null} */ (null));
  const resultSansSignalWarnedRef = useRef(false);
  const handledSignalRecvIdsRef = useRef(/** @type {Set<string>} */ (new Set()));
  const lastCycleSignalRecvIdRef = useRef(/** @type {string | null} */ (null));
  const matchDebugLoggedForSignalRecvIdRef = useRef(/** @type {string | null} */ (null));
  const matchDebugLastLogMsRef = useRef(0);
  const traceOn = import.meta.env.VITE_ADMIN_SIGNALS_TRACE === '1';
  const pendingResultRef = useRef(/** @type {Record<string, unknown> | null} */ (null));

  function normMesa(m) {
    return String(m || '')
      .trim()
      .toLowerCase();
  }

  function normRound(r) {
    return Number(r);
  }

  /** @param {any} signalRow @param {any[]} resultsBuf */
  function debugMatch(signalRow, resultsBuf) {
    if (!import.meta.env.DEV) return;
    const now = Date.now();
    if (now - matchDebugLastLogMsRef.current < 1000) return;
    matchDebugLastLogMsRef.current = now;
    console.log('MATCHING DEBUG', { signal: signalRow, topResults: resultsBuf.slice(0, 3) });
  }

  /** @param {any} signalRow @param {any[]} resultsBuf */
  function debugCompare(signalRow, resultsBuf) {
    if (!import.meta.env.DEV) return;
    const top = resultsBuf.slice(0, 3);
    if (!signalRow || top.length === 0) return;
    for (const r of top) {
      const sameMesa = normMesa(signalRow?.mesa) === normMesa(r?.mesa);
      const sameRound = Number.isFinite(normRound(signalRow?.round)) && Number.isFinite(normRound(r?.round))
        ? normRound(signalRow?.round) === normRound(r?.round)
        : false;
      console.log('COMPARE', {
        signalMesa: signalRow?.mesa,
        resultMesa: r?.mesa,
        signalRound: signalRow?.round,
        resultRound: r?.round,
        sameMesa,
        sameRound,
      });
    }
  }

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    activeSignalRef.current = activeSignal;
  }, [activeSignal]);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
    if (cooldownIntervalRef.current != null) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
    if (bettingIntervalRef.current != null) {
      clearInterval(bettingIntervalRef.current);
      bettingIntervalRef.current = null;
    }
  }, []);

  const resetCycle = useCallback(() => {
    setActiveSignal(null);
    setActiveResult(null);
    setCooldownCount(null);
    setPhase(LAB_PHASE.WAITING);
    setShotIndex(0);
    setBettingRemainingMs(null);
    pendingResultRef.current = null;
    waitBarrierRecvIdRef.current = lastCycleSignalRecvIdRef.current;
    lastCycleSignalRecvIdRef.current = null;
    consumedResultRecvIdRef.current = null;
    lastAppliedResultRecvIdRef.current = null;
    resultSansSignalWarnedRef.current = false;
    clearAllTimers();
  }, [clearAllTimers]);

  const scheduleClosedAndCooldown = useCallback(() => {
    clearAllTimers();
    setPhase(LAB_PHASE.CLOSED);
    const t1 = setTimeout(() => {
      if (!isRunningRef.current) return;
      setPhase(LAB_PHASE.COOLDOWN);
      setCooldownCount(4);
      let s = 4;
      cooldownIntervalRef.current = setInterval(() => {
        if (!isRunningRef.current) {
          if (cooldownIntervalRef.current != null) clearInterval(cooldownIntervalRef.current);
          cooldownIntervalRef.current = null;
          return;
        }
        s -= 1;
        if (s >= 1) setCooldownCount(s);
        if (s === 0) {
          if (cooldownIntervalRef.current != null) clearInterval(cooldownIntervalRef.current);
          cooldownIntervalRef.current = null;
          resetCycle();
        }
      }, 1000);
    }, 1000);
    timersRef.current.push(t1);
  }, [clearAllTimers, resetCycle]);

  const pushT = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      if (!isRunningRef.current) return;
      fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const startBettingCountdown = useCallback(() => {
    if (bettingIntervalRef.current != null) clearInterval(bettingIntervalRef.current);
    const startedAt = Date.now();
    setBettingRemainingMs(HUMAN_BETTING_MS);
    bettingIntervalRef.current = setInterval(() => {
      if (!isRunningRef.current) return;
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, HUMAN_BETTING_MS - elapsed);
      setBettingRemainingMs(remaining);
      if (remaining <= 0) {
        if (bettingIntervalRef.current != null) clearInterval(bettingIntervalRef.current);
        bettingIntervalRef.current = null;
        // Regla de bloqueo: si termina el betting, forzar fase LOCKED.
        if (phaseRef.current === LAB_PHASE.IN_PROGRESS) setPhase(LAB_PHASE.LOCKED);
      }
    }, 100);
  }, []);

  const stopBettingCountdown = useCallback(() => {
    setBettingRemainingMs(null);
    if (bettingIntervalRef.current != null) {
      clearInterval(bettingIntervalRef.current);
      bettingIntervalRef.current = null;
    }
  }, []);

  const runHumanShotLoop = useCallback(
    (shotsTotal) => {
      clearAllTimers();
      pendingResultRef.current = null;
      stopBettingCountdown();
      setActiveResult(null);

      const clampedTotal = Math.max(1, Math.min(HUMAN_FORECAST_MAX_SHOTS, Number(shotsTotal) || HUMAN_FORECAST_MAX_SHOTS));
      setShotIndex(0);

      const runShot = (i) => {
        if (!isRunningRef.current) return;
        setShotIndex(i);
        setPhase(LAB_PHASE.SIGNAL_DETECTED);
        stopBettingCountdown();

        // 2s → BETTING (IN_PROGRESS)
        pushT(() => {
          setPhase(LAB_PHASE.IN_PROGRESS);
          startBettingCountdown();

          // 10s → LOCKED
          pushT(() => {
            stopBettingCountdown();
            setPhase(LAB_PHASE.LOCKED);

            // 2s → RESULT (cards reveal)
            pushT(() => {
              setPhase(LAB_PHASE.RESULT);
              // Si el matcher ya encontró resultado, mostrarlo en RESULT.
              if (pendingResultRef.current != null) setActiveResult(pendingResultRef.current);

              // 3s → PAUSE
              pushT(() => {
                setPhase(LAB_PHASE.PAUSE);

                // 10s → next shot / CLOSED
                pushT(() => {
                  if (i + 1 < clampedTotal) runShot(i + 1);
                  else {
                    setPhase(LAB_PHASE.CLOSED);
                    pushT(() => resetCycle(), 3000);
                  }
                }, HUMAN_PAUSE_BETWEEN_SHOTS_MS);
              }, HUMAN_RESULT_MS);
            }, HUMAN_LOCKED_MS);
          }, HUMAN_BETTING_MS);
        }, HUMAN_SIGNAL_DETECTED_MS);
      };

      runShot(0);
    },
    [clearAllTimers, pushT, resetCycle, startBettingCountdown, stopBettingCountdown],
  );

  const runAfterResult = useCallback(
    (resultRow, signalRow) => {
      const rid = resultRow?.recvId != null ? String(resultRow.recvId) : '';
      if (rid && lastAppliedResultRecvIdRef.current === rid) return;
      if (rid) lastAppliedResultRecvIdRef.current = rid;

      const tsRow = (row) => {
        if (row?.serverTs != null) {
          const n = Number(row.serverTs);
          if (Number.isFinite(n)) return n;
        }
        if (row?.ingestTs != null) {
          const n = Number(row.ingestTs);
          if (Number.isFinite(n)) return n;
        }
        return null;
      };
      const tSig = tsRow(signalRow);
      const tRes = tsRow(resultRow);
      if (tSig != null && tRes != null) {
        const latency = tRes - tSig;
        if (latency < 0) console.warn('LATENCIA NEGATIVA signal→result', { latencyMs: latency });
        else if (import.meta.env.DEV) console.debug('[VistaLab] matchLatencyMs', latency);
      }

      const fc = forecastStepMisalignedWithGanador(
        /** @type {Record<string, unknown>} */ (signalRow),
        /** @type {Record<string, unknown>} */ (resultRow),
      );
      if (fc.misaligned) console.warn('FORECAST DESALINEADO', fc);

      clearAllTimers();
      setActiveResult(resultRow);
      setPhase(LAB_PHASE.CARD_REVEAL);

      const winStatus = resultRow.winStatus === true;

      const beforeResultMs = labMode === 'full' ? computeFullCardRevealBeforeResultMs(resultRow) : 450;

      pushT(() => setPhase(LAB_PHASE.RESULT), beforeResultMs);
      pushT(() => setPhase(winStatus ? LAB_PHASE.EVALUATION_WIN : LAB_PHASE.EVALUATION_LOSS), beforeResultMs + 450);

      pushT(() => {
        const mg = martingaleDataFromSignal(signalRow);
        if (mg.active) {
          setPhase(LAB_PHASE.MARTINGALE);
          pushT(() => scheduleClosedAndCooldown(), 700);
        } else {
          scheduleClosedAndCooldown();
        }
      }, beforeResultMs + 950);
    },
    [clearAllTimers, pushT, scheduleClosedAndCooldown, labMode],
  );

  const beginCycle = useCallback(
    (signalRow) => {
      const rid = signalRow?.recvId != null ? String(signalRow.recvId) : '';
      if (!rid || handledSignalRecvIdsRef.current.has(rid)) return;
      handledSignalRecvIdsRef.current.add(rid);
      lastCycleSignalRecvIdRef.current = rid;
      matchDebugLoggedForSignalRecvIdRef.current = null;
      matchDebugLastLogMsRef.current = 0;

      clearAllTimers();
      setActiveResult(null);
      setActiveSignal(signalRow);
      consumedResultRecvIdRef.current = null;
      lastAppliedResultRecvIdRef.current = null;
      resultSansSignalWarnedRef.current = false;
      pendingResultRef.current = null;
      setBettingRemainingMs(null);
      setPhase(LAB_PHASE.SIGNAL_DETECTED);
      setShotIndex(0);

      if (labMode !== 'full') return;

      // Emulador de flujo humano por tiros (hasta 6).
      const shotsTotal = Array.isArray(signalRow?.forecast6) ? signalRow.forecast6.length : HUMAN_FORECAST_MAX_SHOTS;
      runHumanShotLoop(shotsTotal);
    },
    [clearAllTimers, labMode, runHumanShotLoop],
  );

  useEffect(() => {
    if (labMode === 'full' || labMode === 'phase3' || !isRunning) return;
    if (labMode === 'phase2' || labMode === 'phase4') {
      if (phase !== LAB_PHASE.WAITING && phase !== LAB_PHASE.SIGNAL_DETECTED) return;
    }
    const s = getAdminSignalsLiveSnapshot();
    const head = s.signals[0];
    if (!head || head.recvId == null) {
      setActiveSignal(null);
      setActiveResult(null);
      consumedResultRecvIdRef.current = null;
      setPhase(LAB_PHASE.WAITING);
      return;
    }
    setActiveResult(null);
    consumedResultRecvIdRef.current = null;
    setActiveSignal(head);
    setPhase(LAB_PHASE.SIGNAL_DETECTED);
  }, [rev, isRunning, phase, labMode]);

  useEffect(() => {
    if (labMode !== 'phase2' && labMode !== 'phase4') return;
    if (!isRunning) return;
    if (phase !== LAB_PHASE.SIGNAL_DETECTED) return;
    const t = setTimeout(() => {
      if (!isRunningRef.current) return;
      setPhase(LAB_PHASE.IN_PROGRESS);
    }, SIGNAL_DETECTED_TO_IN_PROGRESS_MS);
    return () => clearTimeout(t);
  }, [phase, isRunning, activeSignal?.recvId, labMode]);

  useEffect(() => {
    if (labMode !== 'full') return;
    if (!isRunning || phase !== LAB_PHASE.WAITING) return;
    const s = getAdminSignalsLiveSnapshot();
    const head = s.signals[0];
    const ev = evaluateWaitingHead(head, { barrierRecvId: waitBarrierRecvIdRef.current });
    if (!ev.ok) return;
    beginCycle(head);
  }, [rev, phase, isRunning, beginCycle, labMode]);

  useEffect(() => {
    if (labMode === 'phase1' || labMode === 'phase3') return;
    if (!isRunning) return;
    // En modo human-flow buscamos match durante BETTING y también si ya está LOCKED.
    const phaseOk = phase === LAB_PHASE.IN_PROGRESS || phase === LAB_PHASE.LOCKED || phase === LAB_PHASE.PAUSE;
    if (!phaseOk) return;
    const s = getAdminSignalsLiveSnapshot();
    const sig = activeSignalRef.current;
    if (!sig) {
      if (s.results.length > 0 && !resultSansSignalWarnedRef.current) {
        resultSansSignalWarnedRef.current = true;
        console.warn('RESULT SIN SIGNAL — IN_PROGRESS sin activeSignal', { bufferResults: s.results.length });
      }
      return;
    }
    resultSansSignalWarnedRef.current = false;

    if (labMode === 'phase4') {
      if (activeResult != null) return;
      debugMatch(sig, s.results);
      if (traceOn) console.log('TRACE: MATCH ATTEMPT', sig, s.results.slice(0, 3));
      const match = findMatchingResultForSignal(sig, s.results, consumedResultRecvIdRef.current);
      if (!match || match.recvId == null) {
        debugCompare(sig, s.results);
        return;
      }
      consumedResultRecvIdRef.current = String(match.recvId);
      setActiveResult(match);
      // Visibilidad inmediata: en fase 4 saltamos directo a RESULT (sin CARD_REVEAL).
      // Mantiene STRICT + matcher sin cambios; solo UI/estado.
      console.log('MATCH FOUND', match);
      clearAllTimers();
      setPhase(LAB_PHASE.RESULT);
      // Luego cerrar y resetear como ciclo corto (fase 4 = diagnóstico).
      pushT(() => setPhase(LAB_PHASE.CLOSED), 1500);
      pushT(() => resetCycle(), 4000);
      return;
    }

    // En modo full (human-flow) NO disparamos la secuencia CARD_REVEAL/EVALUATION;
    // solo capturamos el match y lo mostramos cuando toque (fase RESULT).
    if (labMode === 'full') {
      debugMatch(sig, s.results);
      if (traceOn) console.log('TRACE: MATCH ATTEMPT', sig, s.results.slice(0, 3));
      const match = findMatchingResultForSignal(sig, s.results, consumedResultRecvIdRef.current);
      if (!match || match.recvId == null) {
        debugCompare(sig, s.results);
        return;
      }
      consumedResultRecvIdRef.current = String(match.recvId);
      pendingResultRef.current = match;
      if (phaseRef.current === LAB_PHASE.RESULT) setActiveResult(match);
      return;
    }

    debugMatch(sig, s.results);
    if (traceOn) console.log('TRACE: MATCH ATTEMPT', sig, s.results.slice(0, 3));
    let matched = false;
    for (const r of s.results) {
      if (!r || r.recvId == null) continue;
      const rrid = String(r.recvId);
      if (consumedResultRecvIdRef.current === rrid) continue;
      if (!resultMatchesSignal(sig, r)) continue;
      consumedResultRecvIdRef.current = rrid;
      runAfterResult(r, sig);
      matched = true;
      break;
    }
    if (!matched) debugCompare(sig, s.results);
  }, [rev, phase, isRunning, runAfterResult, activeResult, labMode]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  useEffect(() => {
    if (!labNotice) return undefined;
    const t = setTimeout(() => setLabNotice(null), 8000);
    return () => clearTimeout(t);
  }, [labNotice]);

  const tryKickWaitingCycle = useCallback(() => {
    if (!isRunningRef.current) return;
    if (labMode === 'phase3') {
      setLabNotice(connected ? null : 'Socket desconectado: revisa core-api y el proxy en Vite.');
      return;
    }
    if (labMode === 'phase1' || labMode === 'phase2' || labMode === 'phase4') {
      const s = getAdminSignalsLiveSnapshot();
      const head = s.signals[0];
      if (!head || head.recvId == null) {
        setLabNotice(
          connected
            ? 'Buffer sin señales: espera un evento NEW_SIGNAL en el socket.'
            : 'Socket desconectado: revisa core-api y el proxy en Vite.',
        );
        return;
      }
      setActiveSignal(head);
      setPhase(LAB_PHASE.SIGNAL_DETECTED);
      return;
    }
    if (phaseRef.current !== LAB_PHASE.WAITING) return;
    const s = getAdminSignalsLiveSnapshot();
    const head = s.signals[0];
    const ev = evaluateWaitingHead(head, { barrierRecvId: waitBarrierRecvIdRef.current });
    if (!ev.ok) {
      if (ev.reason === 'NO_HEAD') {
        setLabNotice(
          connected
            ? 'Buffer sin señales: espera un evento NEW_SIGNAL en el socket.'
            : 'Socket desconectado: revisa core-api y el proxy en Vite.',
        );
      } else if (ev.reason === 'BARRIER_SAME_AS_LAST_CYCLE') {
        setLabNotice(
          'La señal al frente del buffer ya cerró un ciclo. Espera una nueva NEW_SIGNAL (o pulsa Start tras llegar una).',
        );
      }
      return;
    }
    beginCycle(head);
  }, [beginCycle, connected, labMode]);

  const start = useCallback(() => {
    if (labMode === 'full') {
      handledSignalRecvIdsRef.current.clear();
    }
    isRunningRef.current = true;
    setIsRunning(true);
    setLabNotice(null);
    queueMicrotask(() => tryKickWaitingCycle());
  }, [tryKickWaitingCycle, labMode]);

  const pause = useCallback(() => {
    isRunningRef.current = false;
    setIsRunning(false);
    stopBettingCountdown();
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    start();
  }, [autoStart, start]);

  const phaseStripOrder = phaseStripOrderFor(labMode, phase);
  const phaseIndexRaw = phaseStripOrder.indexOf(phase);
  const phaseIndex = phaseIndexRaw >= 0 ? phaseIndexRaw : phaseStripOrder.length;

  return {
    phase,
    activeSignal,
    activeResult,
    isRunning,
    cooldownCount,
    labNotice,
    shotIndex,
    bettingRemainingMs,
    start,
    pause,
    phaseStripOrder,
    phaseIndex,
    labMode,
    setLabNotice,
    /** Expuesto para diagnósticos avanzados (misma API que antes en el panel). */
    resultMatchesSignal,
  };
}

// Re-export fases para consumidores que importan el hook como fuente única.
export { LAB_PHASE, SIGNAL_DETECTED_TO_IN_PROGRESS_MS, PRE_IN_PROGRESS_DWELL_MS, phaseStripOrderFor };
