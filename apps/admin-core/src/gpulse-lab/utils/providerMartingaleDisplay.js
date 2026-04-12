/**
 * UI helpers: martingale vectors from proveedor only (vector_forecast, vector_resultado, vector_win).
 */

import {
  forecastStepIndexFromContador,
  recommendationFromForecastCell,
} from '../../utils/forecastMartingaleStep.js';
import { padForecastVector } from '../engine/executionEngine.js';

const STEPS = 6;

/**
 * @param {unknown} cell — elemento de vector_win[i]
 * @returns {'WIN' | 'LOSS' | null}
 */
export function winOutcomeLabelFromCell(cell) {
  if (cell === undefined || cell === null || cell === '') return null;
  if (cell === true) return 'WIN';
  if (cell === false) return 'LOSS';
  const s = String(cell).trim().toUpperCase();
  if (s === 'W' || s === 'WIN' || s === '1' || s === 'TRUE' || s === 'SI' || s === 'SÍ') return 'WIN';
  if (s === 'L' || s === 'LOSS' || s === '0' || s === 'FALSE' || s === 'NO') return 'LOSS';
  const n = Number(cell);
  if (n === 1) return 'WIN';
  if (n === 0 && String(cell).trim() !== '') return 'LOSS';
  return null;
}

/**
 * @param {{
 *   vector_forecast: unknown,
 *   vector_resultado?: unknown[] | null,
 *   vector_win?: unknown[] | null,
 *   martingala: unknown,
 *   martingalaSignal?: unknown,
 * }} row — fila mesa useLabStore
 */
export function buildMartingaleStepRows(row) {
  const vf = row?.vector_forecast;
  if (!Array.isArray(vf) || vf.length === 0) {
    return { rows: [], activeIdx: 0, contador: 0, paddedForecast: [] };
  }

  const vrRaw = Array.isArray(row.vector_resultado) ? row.vector_resultado : null;
  const vwRaw = Array.isArray(row.vector_win) ? row.vector_win : null;

  /** Sin `vector_resultado` aún, o array vacío: no acortar a 0 (evita rejilla vacía / T1 congelado). */
  const capLen = (arr) => {
    if (arr == null) return STEPS;
    if (arr.length === 0) return STEPS;
    return Math.min(arr.length, STEPS);
  };

  /** Alineación UI: misma longitud efectiva para forecast / resultado / win (sin celdas fantasma). */
  const minLength = Math.min(vf.length, capLen(vrRaw), capLen(vwRaw), STEPS);

  if (minLength <= 0) {
    return { rows: [], activeIdx: 0, contador: 0, paddedForecast: [] };
  }

  const displayVectorForecast = vf.slice(0, minLength);
  const displayVectorResultado = vrRaw != null ? vrRaw.slice(0, minLength) : [];
  const displayVectorWin = vwRaw != null ? vwRaw.slice(0, minLength) : [];

  const padded = padForecastVector(displayVectorForecast);
  /** Tras NEW_RESULT: `martingala` viene del resultado; antes: igual que `martingalaSignal`. */
  const cm = row.martingala ?? row.martingalaSignal;
  let activeIdx = forecastStepIndexFromContador(cm);
  activeIdx = Math.max(0, Math.min(activeIdx, minLength - 1));

  const rows = [];
  for (let i = 0; i < minLength; i += 1) {
    const predCell = padded[i];
    const res = displayVectorResultado[i];
    const winCell = displayVectorWin[i];
    const winLabel = winOutcomeLabelFromCell(winCell);
    rows.push({
      step: i + 1,
      index0: i,
      predLabel: recommendationFromForecastCell(predCell),
      rawPred: predCell,
      resultado: res !== undefined && res !== null && String(res).trim() !== '' ? String(res) : null,
      resultadoShort: recommendationFromForecastCell(res) ?? (res != null ? String(res) : null),
      winLabel,
      isActive: activeIdx === i,
      hasResultado: res !== undefined && res !== null && String(res).trim() !== '',
    });
  }

  const paddedForecast = padded.slice(0, minLength);

  return {
    rows,
    activeIdx,
    contador: Number.isFinite(Number(cm)) ? Number(cm) : 0,
    paddedForecast,
  };
}

export const MARTINGALE_STEPS = STEPS;
