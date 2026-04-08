import React, { useEffect, useMemo, useState } from 'react';
import { normSide } from '../../utils/signalFormatter.js';

/** ms entre cada carta y entre fases score/ganador (alineado con spec FASE 5). */
export const VISTALAB_CARD_REVEAL_TICK_MS = 300;

/** Margen antes de pasar a RESULT (timer en panel). */
const BEFORE_RESULT_PAD_MS = 200;

/**
 * @param {unknown} row
 */
export function extractMesaCardsFromResult(row) {
  if (!row || typeof row !== 'object') {
    return { player: [], banker: [], puntaje_player: null, puntaje_banker: null, ganador: null };
  }
  const r = /** @type {Record<string, unknown>} */ (row);
  const mi = r.mesa_info && typeof r.mesa_info === 'object' ? /** @type {Record<string, unknown>} */ (r.mesa_info) : null;
  const sd = r.scoreDetail && typeof r.scoreDetail === 'object' ? /** @type {Record<string, unknown>} */ (r.scoreDetail) : null;
  const p = mi?.cartas_player ?? sd?.cartas_player;
  const b = mi?.cartas_banker ?? sd?.cartas_banker;
  const toStrArr = (x) => (Array.isArray(x) ? x.map((c) => String(c)) : []);
  const ganRaw = mi?.ganador ?? sd?.ganador ?? r.ganador;
  return {
    player: toStrArr(p),
    banker: toStrArr(b),
    puntaje_player: mi?.puntaje_player ?? sd?.puntaje_player ?? null,
    puntaje_banker: mi?.puntaje_banker ?? sd?.puntaje_banker ?? null,
    ganador: ganRaw != null && String(ganRaw).trim() !== '' ? String(ganRaw) : null,
  };
}

/**
 * Tiempo en CARD_REVEAL antes de `setPhase(RESULT)` (debe coincidir con la animación interna).
 * @param {unknown} row
 */
export function computeFullCardRevealBeforeResultMs(row) {
  const { player, banker } = extractMesaCardsFromResult(row);
  const pSlots = Math.max(player.length, 1);
  const bSlots = Math.max(banker.length, 1);
  const maxStep = pSlots + bSlots + 2;
  return maxStep * VISTALAB_CARD_REVEAL_TICK_MS + BEFORE_RESULT_PAD_MS;
}

/**
 * Revelación progresiva PLAYER → BANKER → puntajes → ganador (solo vista; no calcula match).
 *
 * @param {{
 *   activeResult: Record<string, unknown> | null,
 *   visible: boolean,
 * }} props
 */
export default function VistaLabCardReveal({ activeResult, visible }) {
  const { player, banker, puntaje_player, puntaje_banker, ganador } = useMemo(
    () => extractMesaCardsFromResult(activeResult),
    [activeResult],
  );

  const [revealStep, setRevealStep] = useState(0);

  const pLen = player.length;
  const bLen = banker.length;
  const pSlots = Math.max(pLen, 1);
  const bSlots = Math.max(bLen, 1);
  const maxStep = pSlots + bSlots + 2;

  const recvKey = activeResult && typeof activeResult === 'object' && activeResult.recvId != null ? String(activeResult.recvId) : '';

  useEffect(() => {
    if (!visible || !activeResult) {
      setRevealStep(0);
      return;
    }
    setRevealStep(0);
    const ids = [];
    let delay = 0;
    for (let s = 1; s <= maxStep; s += 1) {
      delay += VISTALAB_CARD_REVEAL_TICK_MS;
      const step = s;
      ids.push(setTimeout(() => setRevealStep(step), delay));
    }
    return () => ids.forEach(clearTimeout);
  }, [visible, recvKey, maxStep]);

  if (!visible || !activeResult) return null;

  const playerStarted = revealStep >= 1;
  const playerCardsShown = pLen === 0 ? (playerStarted ? [] : null) : player.slice(0, Math.min(revealStep, pLen));

  const bankerStarted = revealStep > pSlots;
  const bankerCardsShown =
    bLen === 0 ? (bankerStarted ? [] : null) : banker.slice(0, Math.min(Math.max(revealStep - pSlots, 0), bLen));

  const showScore = revealStep > pSlots + bSlots;
  const showWinner = revealStep > pSlots + bSlots + 1;

  const pp = puntaje_player != null && String(puntaje_player).trim() !== '' ? String(puntaje_player) : null;
  const pb = puntaje_banker != null && String(puntaje_banker).trim() !== '' ? String(puntaje_banker) : null;
  const winnerNorm = normSide(ganador);

  const cardChip = (c, i, side) => (
    <span
      key={`${side}-${i}`}
      className={
        side === 'player'
          ? 'inline-flex min-w-[2.25rem] items-center justify-center rounded-md border border-sky-500/45 bg-sky-500/12 px-2 py-1 text-xs font-semibold text-sky-100 shadow-sm'
          : 'inline-flex min-w-[2.25rem] items-center justify-center rounded-md border border-rose-500/45 bg-rose-500/12 px-2 py-1 text-xs font-semibold text-rose-100 shadow-sm'
      }
    >
      {c}
    </span>
  );

  return (
    <div
      className="rounded-xl border border-white/[0.1] bg-black/40 p-4"
      data-testid="vistalab-card-reveal"
    >
      <p className="text-center text-sm font-bold tracking-wide text-[#EAECEF]">🃏 CARTAS REVELADAS</p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400/95">Player</p>
          <div className="mt-2 flex min-h-[2.25rem] flex-wrap gap-2">
            {playerCardsShown === null ? (
              <span className="text-xs text-[#5E6673]">⋯</span>
            ) : playerCardsShown.length === 0 && pLen === 0 ? (
              <span className="text-xs text-sky-200/60">—</span>
            ) : (
              playerCardsShown.map((c, i) => cardChip(c, i, 'player'))
            )}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400/95">Banker</p>
          <div className="mt-2 flex min-h-[2.25rem] flex-wrap gap-2">
            {bankerCardsShown === null ? (
              <span className="text-xs text-[#5E6673]">⋯</span>
            ) : bankerCardsShown.length === 0 && bLen === 0 ? (
              <span className="text-xs text-rose-200/60">—</span>
            ) : (
              bankerCardsShown.map((c, i) => cardChip(c, i, 'banker'))
            )}
          </div>
        </div>

        {showScore ? (
          <div className="border-t border-white/[0.08] pt-3 font-mono text-xs text-[#EAECEF]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#848E9C]">Puntaje</p>
            <p className="mt-1">
              <span className="text-sky-400/90">PLAYER</span> <span className="tabular-nums">{pp ?? '—'}</span>
              <span className="mx-2 text-[#5E6673]">·</span>
              <span className="text-rose-400/90">BANKER</span> <span className="tabular-nums">{pb ?? '—'}</span>
            </p>
          </div>
        ) : null}

        {showWinner ? (
          <div
            className={`rounded-lg border px-3 py-2 text-center text-sm font-bold ${
              ganador == null
                ? 'border-white/10 bg-white/5 text-[#848E9C]'
                : winnerNorm === 'PLAYER'
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-100'
                  : winnerNorm === 'BANKER'
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-100'
                    : winnerNorm === 'TIE'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                      : 'border-white/10 bg-white/5 text-[#EAECEF]'
            }`}
            data-testid="vistalab-card-reveal-winner"
          >
            Ganador: {ganador != null ? winnerNorm : '—'}
          </div>
        ) : null}
      </div>
    </div>
  );
}
