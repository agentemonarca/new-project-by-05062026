/**
 * Agrega métricas de sesión desde `externalSignalsStore.history` (señales asentadas del proveedor).
 * Paridad con la UI de distribución: índices 1–6 = aciertos en T1–T6, 7 = FAIL, 0 sin uso.
 *
 * @param {unknown} extHistory
 * @returns {{
 *   wins: number,
 *   losses: number,
 *   total: number,
 *   distribution: number[],
 *   precisionPct: number,
 *   affinity: number,
 * }}
 */
export function buildStatsFromHistory(extHistory) {
  const settled = Array.isArray(extHistory)
    ? extHistory.filter((h) => h && (h.status === 'won' || h.status === 'lost'))
    : [];
  let wins = 0;
  let losses = 0;
  const distribution = Array(8).fill(0);
  for (const row of settled) {
    if (row.status === 'won') {
      wins += 1;
      const mg = Math.max(1, Math.min(6, Number(row.martingale) || 1));
      distribution[mg] += 1;
    } else if (row.status === 'lost') {
      losses += 1;
      distribution[7] += 1;
    }
  }
  const total = wins + losses;
  const precisionPct = total > 0 ? (wins / total) * 100 : 0;
  return {
    wins,
    losses,
    total,
    distribution,
    precisionPct,
    affinity: total > 0 ? wins / total : 0,
  };
}

/**
 * Patrones simples sobre historial asentado (anomalías operativas).
 * @param {unknown} extHistory
 * @returns {{ lossStreak: number, winStreak: number, alternating: boolean, lastOutcomes: string[] }}
 */
export function detectHistoryAnomalies(extHistory) {
  const settled = Array.isArray(extHistory)
    ? extHistory.filter((h) => h && (h.status === 'won' || h.status === 'lost'))
    : [];
  const lastOutcomes = settled.slice(0, 12).map((r) => (r.status === 'won' ? 'W' : 'L'));
  let lossStreak = 0;
  let winStreak = 0;
  if (settled.length) {
    const head = settled[0].status;
    for (const r of settled) {
      if (r.status !== head) break;
      if (head === 'lost') lossStreak += 1;
      else winStreak += 1;
    }
  }
  let flips = 0;
  for (let i = 1; i < lastOutcomes.length; i++) {
    if (lastOutcomes[i] !== lastOutcomes[i - 1]) flips += 1;
  }
  const alternating = lastOutcomes.length >= 4 && flips >= lastOutcomes.length - 2;
  return { lossStreak, winStreak, alternating, lastOutcomes };
}

/**
 * Adapta filas del relay al formato esperado por `computeGPulse` (shot / side / timestamp).
 * @param {unknown} extHistory
 * @param {number} [limit]
 * @returns {Array<{ id?: string, mesa?: string, shot: number, side: string, timestamp: number | { toMillis: () => number } }>}
 */
export function historyRowsForGpulse(extHistory, limit = 32) {
  if (!Array.isArray(extHistory) || !extHistory.length) return [];
  const settled = extHistory.filter((h) => h && (h.status === 'won' || h.status === 'lost'));
  const slice = settled.slice(0, Math.max(1, limit));
  return slice.map((h) => {
    const ts = Number(h.settledAt ?? h.receivedAt ?? Date.now()) || Date.now();
    const won = h.status === 'won';
    const shot = won ? Math.max(1, Math.min(6, Number(h.martingale) || 1)) : 0;
    const rec = String(h.recommendation || '').toUpperCase();
    const side = won
      ? rec.includes('BANKER')
        ? 'banker'
        : rec.includes('PLAYER')
          ? 'player'
          : 'player'
      : 'fail';
    return {
      id: h.id,
      mesa: String(h.mesa ?? ''),
      shot,
      side,
      timestamp: { toMillis: () => ts },
    };
  });
}
