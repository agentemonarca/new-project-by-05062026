import { formatForecastCell } from './supplierIntelExtract.js';

/** @param {unknown} v */
export function normalizeOutcomeCell(v) {
  return formatForecastCell(v);
}

/**
 * Últimos hasta 6 resultados reales (P/B/T); huecos como '*'.
 * @param {unknown} wins
 * @returns {('P'|'B'|'T'|'*')[]}
 */
export function buildSixBeadPatternFromWins(wins) {
  if (!Array.isArray(wins) || wins.length === 0) {
    return ['*', '*', '*', '*', '*', '*'];
  }
  const last = wins.slice(-6).map((w) => normalizeOutcomeCell(w));
  /** @type {('P'|'B'|'T'|'*')[]} */
  const slots = [];
  const empty = 6 - last.length;
  for (let i = 0; i < empty; i += 1) slots.push('*');
  for (let i = 0; i < last.length; i += 1) {
    const c = last[i];
    if (c === 'P' || c === 'B' || c === 'T') slots.push(c);
    else slots.push('*');
  }
  return slots;
}

/**
 * Predicción legible + confianza heurística (datos reales: recomendación + martingala).
 * @param {{ recommendation?: unknown, martingala?: number }} row
 */
export function computePredictionFromRow(row) {
  const rec = row?.recommendation ?? null;
  const mg = Number(row?.martingala ?? 0);
  let side = null;
  if (rec != null && typeof rec === 'object' && !Array.isArray(rec)) {
    const o = /** @type {Record<string, unknown>} */ (rec);
    const raw = o.pred ?? o.prediccion ?? o.forecast ?? o.recommendation ?? o.vector_forecast;
    side = formatForecastCell(raw ?? o);
  } else {
    side = formatForecastCell(rec);
  }
  if (side === '?' || side === '') side = null;

  let confidence = null;
  if (side != null) {
    const base = 52;
    const boost = Number.isFinite(mg) && mg > 0 ? Math.min(38, mg * 6) : 0;
    confidence = Math.min(96, Math.round(base + boost));
  }

  return {
    side: side === 'P' || side === 'B' || side === 'T' ? side : null,
    label: side ?? '—',
    confidence,
  };
}

/**
 * Índice 0..5 del paso visual durante reparto (para resaltar perla).
 * @param {number} dealStep 1..N
 */
export function beadHighlightIndexFromDealStep(dealStep) {
  if (typeof dealStep !== 'number' || dealStep < 1) return -1;
  return Math.min(dealStep - 1, 5);
}
