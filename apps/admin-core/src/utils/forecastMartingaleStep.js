/**
 * Winx: `contador_martingala` 1-based sobre 6 celdas.
 * idx = clamp(contador - 1, 0..5); contador 0 o ausente → idx 0.
 *
 * @param {unknown} contador
 * @returns {number} 0..5
 */
export function forecastStepIndexFromContador(contador) {
  if (contador == null || contador === '') return 0;
  const n = Number(contador);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n <= 1) return 0;
  return Math.max(0, Math.min(5, Math.floor(n) - 1));
}

/**
 * Celda cruda en `idx` (sin normalizar P/B/T).
 * @param {unknown} vector
 * @param {number} idx
 * @returns {unknown}
 */
export function mapForecastAtStep(vector, idx) {
  if (!Array.isArray(vector)) return null;
  const i = Number(idx);
  if (!Number.isFinite(i)) return null;
  const cell = vector[i];
  return cell || null;
}

/**
 * @param {unknown} cell
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | null}
 */
export function recommendationFromForecastCell(cell) {
  if (cell == null) return null;
  const s = String(cell).trim().toUpperCase();
  if (s === '') return null;
  if (s === 'P' || s.startsWith('PLAY')) return 'PLAYER';
  if (s === 'B' || s.startsWith('BANK')) return 'BANKER';
  if (s === 'E' || s === 'T' || s.startsWith('TIE')) return 'TIE';
  return null;
}

/**
 * WIN / LOSS from `vector_win[last]` (proveedor). `null` = no derivable.
 * @param {unknown} vectorWin
 * @returns {boolean | null}
 */
export function winStatusFromVectorWinLastArray(vectorWin) {
  if (!Array.isArray(vectorWin) || vectorWin.length === 0) return null;
  const last = vectorWin[vectorWin.length - 1];
  if (last === true) return true;
  if (last === false) return false;
  const s = String(last).trim().toUpperCase();
  if (s === 'W' || s === 'WIN' || s === '1' || s === 'TRUE' || s === 'SI' || s === 'SÍ') return true;
  if (s === 'L' || s === 'LOSS' || s === '0' || s === 'FALSE' || s === 'NO') return false;
  const n = Number(last);
  if (n === 1) return true;
  if (n === 0 && String(last).trim() !== '') return false;
  return null;
}
