/**
 * Read-only helpers for provider martingale / vector fields (aligned with core-api `signalNormalize.js`).
 */

/** @param {...unknown} vals */
function pickFirst(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return v;
  }
  return null;
}

/**
 * Index into `vector_forecast` for `contador_martingala` (6 steps → indices 0–5).
 * Mirror: backend `forecastStepIndexFromContador`.
 * @param {unknown} contador
 */
export function forecastStepIndexFromContador(contador) {
  if (contador == null || contador === '') return 0;
  const n = Number(contador);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n <= 1) return 0;
  return Math.max(0, Math.min(5, Math.floor(n) - 1));
}

/**
 * @param {unknown} cell
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | null}
 */
export function forecastCellToSide(cell) {
  if (cell == null) return null;
  const s = String(cell).trim().toUpperCase();
  if (s === '') return null;
  if (s === 'P' || s.startsWith('PLAY')) return 'PLAYER';
  if (s === 'B' || s.startsWith('BANK')) return 'BANKER';
  if (s === 'E' || s === 'T' || s.startsWith('TIE')) return 'TIE';
  return null;
}

/**
 * Prediction = vector_forecast[ index(contador_martingala) ].
 * @param {unknown[]} vector
 * @param {unknown} contadorMartingala
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | null}
 */
export function predictionSideFromVectorAndContador(vector, contadorMartingala) {
  if (!Array.isArray(vector) || vector.length === 0) return null;
  const idx = forecastStepIndexFromContador(contadorMartingala);
  const safeIdx = Math.min(idx, vector.length - 1);
  return forecastCellToSide(vector[safeIdx]);
}

/** Single place for UI: side from NEW_SIGNAL `rawSignal` only (no store `recommendation`). */
export function predictionSideFromRawSignal(rawSignal) {
  if (!rawSignal || typeof rawSignal !== 'object' || Array.isArray(rawSignal)) return null;
  const r = /** @type {Record<string, unknown>} */ (rawSignal);
  const vf = extractVectorForecastArrayFromSignalRaw(r);
  const cm = pickContadorMartingalaFromSignalRaw(r);
  const contador = cm != null && String(cm).trim() !== '' ? cm : vf.length > 0 ? 1 : null;
  if (contador == null) return null;
  return predictionSideFromVectorAndContador(vf, contador);
}

/** @param {'PLAYER' | 'BANKER' | 'TIE' | null | undefined} side */
export function formatPredictionSideLabel(side) {
  if (side === 'PLAYER' || side === 'BANKER' || side === 'TIE') return side;
  return '—';
}

/** @returns {boolean | null} */
export function parseVectorWinStep(token) {
  if (token === true) return true;
  if (token === false) return false;
  if (token == null) return null;
  const s = String(token).trim().toUpperCase();
  if (s === 'W' || s === 'WIN' || s === '1' || s === 'TRUE' || s === 'SI' || s === 'SÍ') return true;
  if (s === 'L' || s === 'LOSS' || s === '0' || s === 'FALSE' || s === 'NO') return false;
  const n = Number(token);
  if (n === 1) return true;
  if (n === 0 && String(token).trim() !== '') return false;
  return null;
}

/** Fixed martingale depth for UI (provider 6-step cycle). */
export const PROVIDER_MARTINGALE_STEPS = 6;

/**
 * `contador_martingala` from nested signal / mesa_info.martingala (Winx-style).
 * @param {Record<string, unknown>} r
 */
export function pickContadorMartingalaFromSignalRaw(r) {
  const d =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  const d2 =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;
  const sig =
    d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
      ? /** @type {Record<string, unknown>} */ (d.signal)
      : null;
  const sig2 =
    d2?.signal != null && typeof d2.signal === 'object' && !Array.isArray(d2.signal)
      ? /** @type {Record<string, unknown>} */ (d2.signal)
      : null;

  const fromMart = (s) => {
    if (s == null || typeof s !== 'object' || Array.isArray(s)) return null;
    const m = /** @type {Record<string, unknown>} */ (s).martingala;
    const block = m != null && typeof m === 'object' && !Array.isArray(m) ? m : null;
    return block?.contador_martingala ?? /** @type {Record<string, unknown>} */ (s).contador_martingala;
  };

  return pickFirst(
    fromMart(sig2),
    fromMart(sig),
    sig2?.contador_martingala,
    sig?.contador_martingala,
    d2?.contador_martingala,
    d?.contador_martingala,
    r.contador_martingala,
    r.contadorMartingala,
    sig2?.martingale,
    sig?.martingale,
    r.martingale,
    r.martinGale,
  );
}

/**
 * Full `vector_forecast` array from NEW_SIGNAL-shaped raw (nested paths).
 * @param {Record<string, unknown>} r
 * @returns {unknown[]}
 */
export function extractVectorForecastArrayFromSignalRaw(r) {
  if (Array.isArray(r.vector_forecast)) return r.vector_forecast;
  const d =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  const d2 =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;
  const sig =
    d2?.signal != null && typeof d2.signal === 'object' && !Array.isArray(d2.signal)
      ? /** @type {Record<string, unknown>} */ (d2.signal)
      : d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
        ? /** @type {Record<string, unknown>} */ (d.signal)
        : null;
  const vf = sig && Array.isArray(sig.vector_forecast) ? sig.vector_forecast : null;
  return vf || [];
}

/** @param {Record<string, unknown> | null | undefined} mart */
function readMartingalaBlock(mart) {
  if (mart == null || typeof mart !== 'object' || Array.isArray(mart)) return null;
  return /** @type {Record<string, unknown>} */ (mart);
}

/**
 * From NEW_RESULT raw: `mesa_info.martingala` (and nested envelopes).
 * Same mesa_info resolution as `extractMesaInfoFromResultRaw` (incl. `scoreDetail` fallback).
 * @param {Record<string, unknown>} r
 */
export function pickMartingalaBlockFromResultRaw(r) {
  const scoreDetail =
    r.scoreDetail != null && typeof r.scoreDetail === 'object' && !Array.isArray(r.scoreDetail)
      ? /** @type {Record<string, unknown>} */ (r.scoreDetail)
      : null;
  const nested =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  const deep =
    nested?.data != null && typeof nested.data === 'object' && !Array.isArray(nested.data)
      ? /** @type {Record<string, unknown>} */ (nested.data)
      : null;
  const results = deep?.results != null && typeof deep.results === 'object' ? deep.results : nested?.results;
  const mesaInfo =
    results?.mesa_info != null && typeof results.mesa_info === 'object' && !Array.isArray(results.mesa_info)
      ? /** @type {Record<string, unknown>} */ (results.mesa_info)
      : r.mesa_info != null && typeof r.mesa_info === 'object' && !Array.isArray(r.mesa_info)
        ? /** @type {Record<string, unknown>} */ (r.mesa_info)
        : scoreDetail;
  if (!mesaInfo || typeof mesaInfo !== 'object') return null;
  return readMartingalaBlock(mesaInfo.martingala);
}

/**
 * @param {Record<string, unknown>} r — NEW_RESULT body
 * @returns {{ vector_resultado: string[], vector_win: (string|number|boolean)[] }}
 */
export function extractVectorResultadoAndWinFromResultRaw(r) {
  const mart = pickMartingalaBlockFromResultRaw(r);
  if (!mart) return { vector_resultado: [], vector_win: [] };
  const vr = mart.vector_resultado;
  const vw = mart.vector_win;
  const vector_resultado = Array.isArray(vr) ? vr.map((x) => String(x)) : [];
  const vector_win = Array.isArray(vw) ? [...vw] : [];
  return { vector_resultado, vector_win };
}

/**
 * WIN / LOSS from `vector_win[last]` when present.
 * @returns {boolean | null} null = not derivable from vector_win
 */
export function winStatusFromVectorWinLast(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  const { vector_win } = extractVectorResultadoAndWinFromResultRaw(r);
  if (vector_win.length === 0) return null;
  const last = vector_win[vector_win.length - 1];
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
