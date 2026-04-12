/**
 * IA Real + relay: helpers for state-driven dashboard (no VISOR / SIMULACION).
 */

import {
  forecastStepIndexFromContador,
  pickContadorMartingalaFromSignalRaw,
} from './providerMartingaleRead.js';

/**
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {string[]}
 */
export function extractVectorForecastFromRawSignal(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  if (Array.isArray(raw.vector_forecast)) return raw.vector_forecast.map((x) => String(x));
  const d =
    raw.data != null && typeof raw.data === 'object' && !Array.isArray(raw.data)
      ? /** @type {Record<string, unknown>} */ (raw.data)
      : null;
  const inner =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;
  const sig =
    inner?.signal != null && typeof inner.signal === 'object' && !Array.isArray(inner.signal)
      ? /** @type {Record<string, unknown>} */ (inner.signal)
      : d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
        ? /** @type {Record<string, unknown>} */ (d.signal)
        : null;
  const vf = sig && Array.isArray(sig.vector_forecast) ? sig.vector_forecast : null;
  if (vf) return vf.map((x) => String(x));
  return [];
}

/**
 * @param {{ rawSignal?: Record<string, unknown> | null, recommendation?: string }} row
 * @returns {string[]}
 */
export function extractVectorForecastFromActiveRow(row) {
  if (!row) return [];
  return extractVectorForecastFromRawSignal(row.rawSignal ?? null);
}

/**
 * @param {unknown} rawResult
 * @returns {{ ganador?: string, cartas_player?: unknown[], cartas_banker?: unknown[] }}
 */
export function extractMesaInfoFromResultRaw(rawResult) {
  if (!rawResult || typeof rawResult !== 'object' || Array.isArray(rawResult)) return {};
  const r = /** @type {Record<string, unknown>} */ (rawResult);
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
      : scoreDetail;
  if (!mesaInfo || typeof mesaInfo !== 'object') return {};
  return {
    ganador: mesaInfo.ganador != null ? String(mesaInfo.ganador) : undefined,
    cartas_player: Array.isArray(mesaInfo.cartas_player) ? mesaInfo.cartas_player : undefined,
    cartas_banker: Array.isArray(mesaInfo.cartas_banker) ? mesaInfo.cartas_banker : undefined,
    puntaje_player: mesaInfo.puntaje_player != null ? String(mesaInfo.puntaje_player) : undefined,
    puntaje_banker: mesaInfo.puntaje_banker != null ? String(mesaInfo.puntaje_banker) : undefined,
  };
}

/** @param {string | undefined} rec */
export function formatRecommendationDisplay(rec) {
  const s = String(rec ?? '').trim();
  if (!s || s === 'UNKNOWN') return '—';
  return s;
}

/** @param {unknown} token — vector_forecast cell (P, B, PLAYER, etc.) */
export function normalizeForecastCellLetter(token) {
  const s = String(token ?? '').trim().toUpperCase();
  if (!s) return '';
  if (s.startsWith('P') || s.includes('PLAY')) return 'P';
  if (s.startsWith('B') || s.includes('BANK')) return 'B';
  if (s.startsWith('T') || s.includes('TIE') || s === 'E') return 'T';
  const c = s.slice(0, 1);
  if (c === 'P' || c === 'B' || c === 'T') return c;
  return '';
}

/**
 * PLAYER vs BANKER for center prediction styling (same mapping as vector).
 * @param {string | undefined} rec
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | 'OTHER'}
 */
export function recommendationSide(rec) {
  const u = String(rec ?? '').trim().toUpperCase();
  if (!u || u === 'UNKNOWN') return 'OTHER';
  if (u === 'PLAYER' || u === 'P' || u.startsWith('PLAY')) return 'PLAYER';
  if (u === 'BANKER' || u === 'B' || u.startsWith('BANK')) return 'BANKER';
  if (u === 'TIE' || u === 'T' || u.startsWith('TIE')) return 'TIE';
  return 'OTHER';
}

/**
 * 0-based index into `vector_forecast` from provider `contador_martingala` (no local increments).
 * Same index rule as `predictionSideFromVectorAndContador` / core-api relay.
 * @param {{ martingale?: unknown, rawSignal?: Record<string, unknown> | null } | null | undefined} row
 * @param {number} len
 */
export function forecastStepIndexFromProviderRow(row, len) {
  if (!len) return 0;
  const fromRaw = row?.rawSignal != null ? pickContadorMartingalaFromSignalRaw(row.rawSignal) : null;
  const fromStore = Number(row?.martingale);
  const rawNum =
    fromRaw != null && String(fromRaw).trim() !== '' && Number.isFinite(Number(fromRaw))
      ? Number(fromRaw)
      : null;
  /** Store (merge NEW_RESULT) gana sobre contador congelado en rawSignal. */
  const contador =
    Number.isFinite(fromStore) && fromStore >= 1 ? fromStore : rawNum != null ? rawNum : 1;
  const idx = forecastStepIndexFromContador(contador);
  return Math.min(idx, len - 1);
}

/**
 * @deprecated use forecastStepIndexFromProviderRow — kept for call sites
 */
export function iaRealActiveShotIndex(row, len) {
  return forecastStepIndexFromProviderRow(row, len);
}

/** @param {unknown} ganador */
export function normalizeGanadorSide(ganador) {
  const u = String(ganador ?? '').trim().toUpperCase();
  if (!u || u === '—') return 'OTHER';
  if (u.includes('TIE') || u.includes('EMPATE') || u === 'T') return 'TIE';
  if (u.includes('PLAY') || u === 'P') return 'PLAYER';
  if (u.includes('BANK')) return 'BANKER';
  return 'OTHER';
}

/**
 * Real-only: prediction vs mesa ganador (no RNG).
 * @param {string | undefined} recommendation
 * @param {string | undefined} ganadorRaw
 */
export function doesPredictionMatchGanador(recommendation, ganadorRaw) {
  const pred = recommendationSide(recommendation);
  const g = normalizeGanadorSide(ganadorRaw);
  if (pred === 'OTHER' || g === 'OTHER') return false;
  if (pred === 'TIE' && g === 'TIE') return true;
  if (pred === 'TIE' || g === 'TIE') return pred === g;
  return pred === g;
}

/**
 * Index of the vector cell whose letter matches the resolved ganador (P/B/T), or -1.
 * @param {string[]} vf
 * @param {string | undefined} ganadorRaw
 */
export function winnerVectorIndexFromGanador(vf, ganadorRaw) {
  const g = normalizeGanadorSide(ganadorRaw);
  const want = g === 'PLAYER' ? 'P' : g === 'BANKER' ? 'B' : g === 'TIE' ? 'T' : '';
  if (!want || !vf?.length) return -1;
  return vf.findIndex((t) => normalizeForecastCellLetter(t) === want);
}

/**
 * @param {unknown} rawResult
 */
export function extractScoreLabelsFromResultRaw(rawResult) {
  const meta = extractMesaInfoFromResultRaw(rawResult);
  const r =
    rawResult != null && typeof rawResult === 'object' && !Array.isArray(rawResult)
      ? /** @type {Record<string, unknown>} */ (rawResult)
      : {};
  const sc = r.scoreDetail && typeof r.scoreDetail === 'object' ? /** @type {Record<string, unknown>} */ (r.scoreDetail) : {};
  const puntP = meta.puntaje_player ?? sc.puntaje_player ?? sc.playerScore;
  const puntB = meta.puntaje_banker ?? sc.puntaje_banker ?? sc.bankerScore;
  return {
    puntajePlayer: puntP != null ? String(puntP) : null,
    puntajeBanker: puntB != null ? String(puntB) : null,
  };
}

/**
 * Vector cell: P = cyan/blue, B = rose/red (system tones). Optional active emphasis.
 * @param {unknown} token
 * @param {boolean} isLightMode
 * @param {boolean} isActive
 * @param {boolean} [isOutcomeMatch] — result phase: cell letter matches mesa ganador
 */
/**
 * Waiting phase only: visually de-emphasize vector cells before the active martingale step (“past”)
 * and slightly soften cells after (“future”). Does not change engine state.
 * @param {number} idx
 * @param {number} activeIdx
 */
export function iaRealVectorMaturityDimClass(idx, activeIdx) {
  if (idx < activeIdx) return ' opacity-[0.38] saturate-[0.7] ';
  if (idx > activeIdx) return ' opacity-[0.62] ';
  return '';
}

/**
 * Result phase: dim cells that are neither the winning resolution cell nor the active step (context only).
 * @param {number} idx
 * @param {number} activeIdx
 * @param {number} winIdx
 */
export function iaRealVectorResultDimClass(idx, activeIdx, winIdx) {
  const isWin = winIdx >= 0 && idx === winIdx;
  const isActive = idx === activeIdx;
  if (isWin || isActive) return '';
  return ' opacity-45 ';
}

export function iaRealVectorCellToneClasses(token, isLightMode, isActive, isOutcomeMatch = false) {
  const L = normalizeForecastCellLetter(token);
  const emphasis = isActive ? ' scale-105 z-[1] ring-2 ring-offset-0 ' : '';
  const outcomeRing = isOutcomeMatch
    ? ' ring-2 ring-emerald-400/95 shadow-[0_0_22px_rgba(52,211,153,0.55)] z-[2] '
    : '';

  if (L === 'P') {
    const base = isLightMode
      ? 'border-cyan-500 text-cyan-800 bg-cyan-500/12'
      : 'border-cyan-400/85 text-cyan-100 bg-cyan-500/18';
    const glow = isActive
      ? isLightMode
        ? ' ring-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.45)] '
        : ' ring-cyan-300/90 shadow-[0_0_20px_rgba(34,211,238,0.5)] '
      : '';
    return `${base}${emphasis}${glow}${outcomeRing}`;
  }
  if (L === 'B') {
    const base = isLightMode
      ? 'border-rose-500/95 text-rose-900 bg-rose-500/10'
      : 'border-rose-400/80 text-rose-100 bg-rose-500/16';
    const glow = isActive
      ? isLightMode
        ? ' ring-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.4)] '
        : ' ring-rose-400/90 shadow-[0_0_20px_rgba(251,113,133,0.45)] '
      : '';
    return `${base}${emphasis}${glow}${outcomeRing}`;
  }
  if (L === 'T') {
    const base = isLightMode
      ? 'border-slate-400 text-slate-700 bg-slate-500/10'
      : 'border-white/25 text-white/80 bg-white/5';
    return `${base}${emphasis}${outcomeRing}`;
  }
  const neutral = isLightMode
    ? 'border-slate-300 text-slate-600 bg-slate-500/8'
    : 'border-white/20 text-white/70 bg-white/5';
  return `${neutral}${emphasis}${outcomeRing}`;
}

/**
 * Center prediction text: blue glow for PLAYER, rose glow for BANKER.
 * @param {string | undefined} rec
 * @param {boolean} isLightMode
 */
export function iaRealPredictionToneClasses(rec, isLightMode) {
  const side = recommendationSide(rec);
  if (side === 'PLAYER') {
    return isLightMode
      ? 'text-cyan-800 drop-shadow-[0_0_10px_rgba(8,145,178,0.35)]'
      : 'text-cyan-100 drop-shadow-[0_0_16px_rgba(34,211,238,0.55)]';
  }
  if (side === 'BANKER') {
    return isLightMode
      ? 'text-rose-900 drop-shadow-[0_0_10px_rgba(190,18,60,0.22)]'
      : 'text-rose-100 drop-shadow-[0_0_16px_rgba(251,113,133,0.5)]';
  }
  if (side === 'TIE') {
    return isLightMode ? 'text-slate-800' : 'text-white/90';
  }
  return isLightMode ? 'text-slate-800' : 'text-white/90';
}
