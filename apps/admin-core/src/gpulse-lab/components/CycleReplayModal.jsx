import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import BaccaratTableView from './BaccaratTableView.jsx';
import { LAB_LIFECYCLE_STATES } from '../store/useLabStore.js';
import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';
import { useControlCenterStore } from '../store/useControlCenterStore.js';
import { buildDealSequence, extractCardsFromReplaySnapshot } from '../utils/replaySnapshotHelpers.js';
import { formatForecastCell } from '../utils/supplierIntelExtract.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function predictionLabel(rec) {
  if (rec == null) return '—';
  return formatForecastCell(rec);
}

/**
 * @param {unknown} snapshot
 */
function winnerFromSnapshot(snapshot) {
  const mi = snapshot?.supplierMesaInfoFull;
  const m = mi != null && typeof mi === 'object' && !Array.isArray(mi) ? /** @type {Record<string, unknown>} */ (mi) : null;
  return snapshot?.ganador ?? m?.ganador ?? m?.winner ?? null;
}

export default function CycleReplayModal() {
  const open = useGpulseLabUiStore((s) => s.cycleReplayOpen);
  const closeCycleReplay = useGpulseLabUiStore((s) => s.closeCycleReplay);
  const snapIn = useGpulseLabUiStore((s) => s.cycleReplaySnapshot);
  const mesaIdIn = useGpulseLabUiStore((s) => s.cycleReplayMesaId);
  const mesaKey = mesaIdIn != null && String(mesaIdIn).trim() !== '' ? String(mesaIdIn).trim() : null;
  const replayHistory = useControlCenterStore((s) => (mesaKey ? s.replayHistoryByMesa[mesaKey] : null));

  const [fastMode, setFastMode] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState('');
  const [tableStatus, setTableStatus] = useState(/** @type {string} */ (LAB_LIFECYCLE_STATES.IDLE));
  const [playerVisible, setPlayerVisible] = useState(/** @type {unknown[]} */ ([]));
  const [bankerVisible, setBankerVisible] = useState(/** @type {unknown[]} */ ([]));
  const [winner, setWinner] = useState(/** @type {unknown} */ (null));
  const [betLeft, setBetLeft] = useState(10);
  const abortRef = useRef(false);

  const snapshot = useMemo(() => {
    if (snapIn != null && typeof snapIn === 'object') return snapIn;
    if (Array.isArray(replayHistory) && replayHistory.length > 0) return replayHistory[replayHistory.length - 1];
    return null;
  }, [snapIn, replayHistory]);

  const { playerCards, bankerCards, puntaje_player, puntaje_banker } = useMemo(
    () => extractCardsFromReplaySnapshot(snapshot),
    [snapshot],
  );
  const dealSeq = useMemo(() => buildDealSequence(playerCards, bankerCards), [playerCards, bankerCards]);
  const recommendation = snapshot?.recommendation ?? null;
  const roundStr = snapshot?.round != null ? String(snapshot.round) : '—';

  const runReplay = useCallback(async () => {
    abortRef.current = false;
    const bettingMs = fastMode ? 2000 : 10_000;
    const dealMs = fastMode ? 120 : 300;
    const waitMs = fastMode ? 800 : 1800;

    setPlayerVisible([]);
    setBankerVisible([]);
    setWinner(null);
    setTableStatus(LAB_LIFECYCLE_STATES.SIGNAL_DETECTED);
    setPhaseLabel('1 · SEÑAL — predicción');
    await sleep(fastMode ? 600 : 1200);
    if (abortRef.current) return;

    setTableStatus(LAB_LIFECYCLE_STATES.BETTING_PHASE);
    setPhaseLabel('2 · APUESTAS (10s)');
    setBetLeft(Math.ceil(bettingMs / 1000));
    const step = fastMode ? 200 : 1000;
    let left = bettingMs;
    while (left > 0 && !abortRef.current) {
      setBetLeft(Math.ceil(left / 1000));
      await sleep(Math.min(step, left));
      left -= step;
    }
    setBetLeft(0);
    if (abortRef.current) return;

    setTableStatus(LAB_LIFECYCLE_STATES.WAITING_RESULT);
    setPhaseLabel('3 · ESPERANDO RESULTADO');
    await sleep(waitMs);
    if (abortRef.current) return;

    setPhaseLabel('4 · REPARTO');
    setTableStatus(LAB_LIFECYCLE_STATES.WAITING_RESULT);
    const p = [...playerCards];
    const b = [...bankerCards];
    let pi = 0;
    let bi = 0;
    for (const stepDeal of dealSeq) {
      if (abortRef.current) return;
      await sleep(dealMs);
      if (stepDeal.side === 'P') {
        pi += 1;
        setPlayerVisible(p.slice(0, pi));
      } else {
        bi += 1;
        setBankerVisible(b.slice(0, bi));
      }
    }

    setPhaseLabel('5 · PUNTAJES');
    const w = winnerFromSnapshot(snapshot);
    setWinner(w);
    setTableStatus(LAB_LIFECYCLE_STATES.RESULT_RECEIVED);
    await sleep(fastMode ? 300 : 500);
    if (abortRef.current) return;

    setPhaseLabel('6 · GANADOR');
    setTableStatus(LAB_LIFECYCLE_STATES.CYCLE_COMPLETE);
    await sleep(fastMode ? 400 : 800);
  }, [snapshot, playerCards, bankerCards, dealSeq, fastMode]);

  useEffect(() => {
    if (!open || !snapshot) return undefined;
    abortRef.current = false;
    void runReplay();
    return () => {
      abortRef.current = true;
    };
  }, [open, snapshot, runReplay]);

  const handleClose = () => {
    abortRef.current = true;
    closeCycleReplay();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="replay-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-modal flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
        role="dialog"
        aria-modal
        aria-label="Replay de ciclo"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          className="relative flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 shadow-[0_0_60px_rgba(245,158,11,0.15)]"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] bg-amber-950/20 px-4 py-3">
            <div>
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-amber-200/95">🎥 Casino replay</h3>
              <p className="mt-1 font-mono text-[10px] text-slate-500">
                Mesa {snapshot?.mesaId ?? mesaIdIn ?? '—'} · round {roundStr} · {phaseLabel}
              </p>
              <p className="mt-2 font-mono text-sm text-cyan-200/95">
                Predicción: <span className="font-bold text-white">{predictionLabel(recommendation)}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar replay"
              >
                <X className="h-4 w-4" />
              </button>
              <label className="flex cursor-pointer items-center gap-2 font-mono text-[9px] text-slate-500">
                <input
                  type="checkbox"
                  checked={fastMode}
                  onChange={(e) => setFastMode(e.target.checked)}
                  className="rounded border-white/20 bg-black/40"
                />
                Modo rápido (demo)
              </label>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {!snapshot ? (
              <p className="font-mono text-sm text-rose-300/95">No hay snapshot de replay para esta mesa. Completa al menos un ciclo.</p>
            ) : (
              <>
                {tableStatus === LAB_LIFECYCLE_STATES.BETTING_PHASE ? (
                  <div className="mb-4 flex justify-center font-mono text-3xl font-bold tabular-nums text-emerald-300">
                    {betLeft}s
                  </div>
                ) : null}
                <BaccaratTableView
                  playerCards={playerVisible}
                  bankerCards={bankerVisible}
                  playerScore={
                    tableStatus === LAB_LIFECYCLE_STATES.RESULT_RECEIVED ||
                    tableStatus === LAB_LIFECYCLE_STATES.CYCLE_COMPLETE
                      ? puntaje_player
                      : null
                  }
                  bankerScore={
                    tableStatus === LAB_LIFECYCLE_STATES.RESULT_RECEIVED ||
                    tableStatus === LAB_LIFECYCLE_STATES.CYCLE_COMPLETE
                      ? puntaje_banker
                      : null
                  }
                  winner={
                    tableStatus === LAB_LIFECYCLE_STATES.RESULT_RECEIVED ||
                    tableStatus === LAB_LIFECYCLE_STATES.CYCLE_COMPLETE
                      ? winner
                      : null
                  }
                  status={tableStatus}
                />
                {dealSeq.length === 0 && tableStatus === LAB_LIFECYCLE_STATES.CYCLE_COMPLETE ? (
                  <p className="mt-4 text-center font-mono text-[10px] text-slate-500">
                    Sin cartas en mesa_info — replay parcial (señal / tiempos).
                  </p>
                ) : null}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
