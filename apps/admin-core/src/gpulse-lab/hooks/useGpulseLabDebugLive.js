import { useEffect, useMemo, useState } from 'react';
import {
  createEmptyMesaState,
  getEffectiveMesaId,
  LAB_LIFECYCLE_STATES,
  useLabStore,
} from '../store/useLabStore.js';

/** @param {unknown} w */
function winnerToPlayerBanker(w) {
  if (w == null) return null;
  const u = String(w).toUpperCase();
  if (u === 'P' || u.includes('PLAY')) return 'PLAYER';
  if (u === 'B' || u.includes('BANK')) return 'BANKER';
  if (u === 'T' || u.includes('TIE') || u.includes('EMP')) return 'TIE';
  return null;
}

/** @param {unknown} raw */
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

/**
 * Misma telemetría que el antiguo overlay DEBUG LIVE en CenterPanel.
 * @returns {{
 *   lifecycleState: string,
 *   mesaId: string | null,
 *   round: unknown,
 *   signalTs: number | null,
 *   providerCloseTs: number | null,
 *   now: number,
 *   remainingMs: number | null,
 *   elapsedMs: number | null,
 *   winner: 'PLAYER' | 'BANKER' | 'TIE' | null,
 * }}
 */
export function useGpulseLabDebugLive() {
  const mesas = useLabStore((s) => s.mesas);
  const selectedMesaId = useLabStore((s) => s.selectedMesaId);
  const lifecycleState = useLabStore((s) => s.lifecycleState);
  const providerCloseTs = useLabStore((s) => s.providerCloseTs);
  const cycleStartedAt = useLabStore((s) => s.cycleStartedAt);
  const labSignalTs = useLabStore((s) => s.signalTs);

  const effectiveId = useMemo(() => getEffectiveMesaId(mesas, selectedMesaId), [mesas, selectedMesaId]);
  const row = useMemo(
    () => (effectiveId ? mesas[effectiveId] : createEmptyMesaState()),
    [mesas, effectiveId],
  );

  const mesaInfo = row.supplierMesaInfoFull;
  const ganador = row.ganador;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const needsTick =
      lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED ||
      lifecycleState === LAB_LIFECYCLE_STATES.RESULT_RECEIVED ||
      (typeof providerCloseTs === 'number' && Number.isFinite(providerCloseTs) && providerCloseTs > Date.now());
    if (!needsTick) return undefined;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [lifecycleState, providerCloseTs]);

  const signalTs = row.intelSignalTs ?? labSignalTs ?? cycleStartedAt ?? null;

  const timeEngine = useMemo(() => {
    const currentNow = now;
    let remainingMs = null;
    if (typeof providerCloseTs === 'number' && Number.isFinite(providerCloseTs) && providerCloseTs > currentNow) {
      remainingMs = Math.max(0, providerCloseTs - currentNow);
    }
    const waitingForResult =
      lifecycleState === LAB_LIFECYCLE_STATES.SIGNAL_DETECTED &&
      (ganador == null || String(ganador).trim() === '');
    const waitingStart = waitingForResult && signalTs != null ? signalTs : null;
    const elapsedMs = waitingStart != null ? Math.max(0, currentNow - waitingStart) : null;
    return {
      now: currentNow,
      remainingMs,
      elapsedMs,
    };
  }, [now, lifecycleState, providerCloseTs, signalTs, ganador]);

  const winnerForTable = useMemo(() => {
    const n = normalizeMesaInfo(mesaInfo);
    if (n?.winner != null) return n.winner;
    const mi = mesaInfo && typeof mesaInfo === 'object' && !Array.isArray(mesaInfo) ? mesaInfo : null;
    const raw = mi?.ganador ?? mi?.winner ?? mi?.resultado ?? ganador;
    return winnerToPlayerBanker(raw);
  }, [mesaInfo, ganador]);

  return {
    lifecycleState,
    mesaId: effectiveId,
    round: row.round,
    signalTs,
    providerCloseTs,
    now: timeEngine.now,
    remainingMs: timeEngine.remainingMs,
    elapsedMs: timeEngine.elapsedMs,
    winner: winnerForTable,
  };
}
