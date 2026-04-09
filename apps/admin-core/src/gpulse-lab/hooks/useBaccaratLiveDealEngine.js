import { useEffect, useMemo, useState } from 'react';
import { LAB_LIFECYCLE_STATES } from '../store/useLabStore.js';
import { buildDealSequence } from '../utils/replaySnapshotHelpers.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fingerprint(pc, pb) {
  try {
    return JSON.stringify({ p: pc, b: pb });
  } catch {
    return `${(pc ?? []).length}-${(pb ?? []).length}`;
  }
}

/**
 * Reparto secuencial P1→B1→P2→B2→… desde datos reales; 300 ms entre cartas (primera inmediata).
 *
 * @param {{
 *   mesaId: string | null,
 *   round: unknown,
 *   playerCards: unknown[],
 *   bankerCards: unknown[],
 *   lifecycleState: string,
 * }} opts
 */
export function useBaccaratLiveDealEngine({ mesaId, round, playerCards, bankerCards, lifecycleState }) {
  const fullP = Array.isArray(playerCards) ? playerCards : [];
  const fullB = Array.isArray(bankerCards) ? bankerCards : [];
  const seq = useMemo(() => buildDealSequence(fullP, fullB), [fullP, fullB]);

  const dealKey = useMemo(
    () => `${mesaId ?? ''}|${round ?? ''}|${fingerprint(fullP, fullB)}`,
    [mesaId, round, fullP, fullB],
  );

  const shouldAnimate = useMemo(() => {
    if (seq.length === 0) return false;
    return (
      lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED ||
      lifecycleState === LAB_LIFECYCLE_STATES.WAITING_RESULT ||
      lifecycleState === LAB_LIFECYCLE_STATES.BETTING_CLOSED ||
      lifecycleState === LAB_LIFECYCLE_STATES.STREAM_INTERRUPTED ||
      lifecycleState === LAB_LIFECYCLE_STATES.RESULT_RECEIVED
    );
  }, [lifecycleState, seq.length]);

  const [visibleP, setVisibleP] = useState(fullP);
  const [visibleB, setVisibleB] = useState(fullB);
  const [dealStep, setDealStep] = useState(seq.length);
  const [isDealing, setIsDealing] = useState(false);

  useEffect(() => {
    if (seq.length === 0) {
      setVisibleP([]);
      setVisibleB([]);
      setDealStep(0);
      setIsDealing(false);
      return;
    }

    if (!shouldAnimate) {
      setVisibleP([...fullP]);
      setVisibleB([...fullB]);
      setDealStep(seq.length);
      setIsDealing(false);
      return;
    }

    let cancelled = false;
    setIsDealing(true);
    setDealStep(0);
    // Do not clear visible arrays here — it caused a blank frame before the first
    // deal step. Previous cards stay until this run applies step 0 synchronously.

    const run = async () => {
      let pi = 0;
      let bi = 0;
      for (let i = 0; i < seq.length; i += 1) {
        if (cancelled) return;
        if (i > 0) await sleep(300);
        if (cancelled) return;
        const step = seq[i];
        if (step.side === 'P') {
          pi += 1;
        } else {
          bi += 1;
        }
        // Always set both sides from the same indices so we never leave stale
        // cards from the prior hand on one side, and we never flash all-empty.
        setVisibleP(fullP.slice(0, pi));
        setVisibleB(fullB.slice(0, bi));
        setDealStep(i + 1);
      }
      if (!cancelled) {
        setVisibleP([...fullP]);
        setVisibleB([...fullB]);
        setIsDealing(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [dealKey, shouldAnimate]);

  return {
    visiblePlayer: visibleP,
    visibleBanker: visibleB,
    dealStep,
    totalDealSteps: seq.length,
    isDealing,
  };
}
