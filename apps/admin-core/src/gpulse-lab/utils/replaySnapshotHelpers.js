/**
 * @param {unknown} snapshot
 */
export function extractCardsFromReplaySnapshot(snapshot) {
  const mi = snapshot?.supplierMesaInfoFull;
  if (mi == null || typeof mi !== 'object' || Array.isArray(mi)) {
    return {
      playerCards: [],
      bankerCards: [],
      puntaje_player: null,
      puntaje_banker: null,
    };
  }
  const m = /** @type {Record<string, unknown>} */ (mi);
  const pc = m.cartas_player ?? m.player_cards;
  const pb = m.cartas_banker ?? m.banker_cards;
  return {
    playerCards: Array.isArray(pc) ? pc : [],
    bankerCards: Array.isArray(pb) ? pb : [],
    puntaje_player: m.puntaje_player ?? null,
    puntaje_banker: m.puntaje_banker ?? null,
  };
}

/**
 * Interleaved P1,B1,P2,B2,P3,B3…
 * @param {unknown[]} playerCards
 * @param {unknown[]} bankerCards
 */
export function buildDealSequence(playerCards, bankerCards) {
  const p = Array.isArray(playerCards) ? playerCards : [];
  const b = Array.isArray(bankerCards) ? bankerCards : [];
  const maxLen = Math.max(p.length, b.length);
  /** @type {{ side: 'P'|'B', card: unknown, idx: number }[]} */
  const seq = [];
  for (let i = 0; i < maxLen; i += 1) {
    if (p[i] !== undefined) seq.push({ side: 'P', card: p[i], idx: i });
    if (b[i] !== undefined) seq.push({ side: 'B', card: b[i], idx: i });
  }
  return seq;
}
