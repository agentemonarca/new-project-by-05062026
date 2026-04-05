/**
 * G_Pulse core — pure functions over neural history (mesa / shot / side).
 * Independent module; safe to evolve without touching React.
 */

function normalizeHistory(history) {
  return Array.isArray(history) ? history.filter(Boolean) : [];
}

function entryTimeMs(entry) {
  const t = entry?.timestamp;
  if (t == null) return 0;
  if (typeof t.toMillis === 'function') return Number(t.toMillis()) || 0;
  if (typeof t === 'number') return t;
  if (typeof t?.seconds === 'number') return t.seconds * 1000;
  return 0;
}

function isWinningEntry(entry) {
  return Number(entry?.shot) > 0;
}

function sideNorm(entry) {
  return String(entry?.side || '').toLowerCase();
}

/** Cadence + regularity of events (0–1). */
function calcRhythm(history) {
  const arr = normalizeHistory(history);
  if (arr.length === 0) return 0;
  if (arr.length === 1) return 0.35;
  const times = arr.map(entryTimeMs).filter((ms) => ms > 0).sort((a, b) => a - b);
  if (times.length < 2) {
    return Math.min(1, arr.length / 12);
  }
  const gaps = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push(times[i] - times[i - 1]);
  }
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (mean <= 0) return Math.min(1, arr.length / 12);
  const variance = gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length;
  const cv = Math.sqrt(variance) / mean;
  const regularity = Math.max(0, 1 - Math.min(1, cv));
  const density = Math.min(1, arr.length / 18);
  return Math.min(1, 0.55 * regularity + 0.45 * density);
}

/** Side alternation / noise in outcomes (0–1). */
function calcVolatility(history) {
  const arr = normalizeHistory(history);
  if (arr.length < 2) return 0;
  let flips = 0;
  for (let i = 1; i < arr.length; i++) {
    const a = sideNorm(arr[i - 1]);
    const b = sideNorm(arr[i]);
    if (!a || !b || a === 'fail' || b === 'fail') continue;
    if (a !== b) flips += 1;
  }
  const denom = Math.max(1, arr.length - 1);
  return Math.min(1, flips / denom);
}

/** Recent success bias (newest-first list as in App state) (0–1). */
function calcMomentum(history) {
  const arr = normalizeHistory(history).slice(0, 10);
  if (arr.length === 0) return 0;
  const wins = arr.filter(isWinningEntry).length;
  return wins / arr.length;
}

/** Strength of current run (wins vs losses from latest entry) (0–1). */
function calcStreak(history) {
  const arr = normalizeHistory(history);
  if (arr.length === 0) return 0;
  const latestWin = isWinningEntry(arr[0]);
  let run = 0;
  for (const e of arr) {
    if (isWinningEntry(e) === latestWin) run += 1;
    else break;
  }
  return Math.min(1, run / 8);
}

/** Fail / anomaly density in the recent window (0–1). */
function calcPressure(history) {
  const arr = normalizeHistory(history).slice(0, 12);
  if (arr.length === 0) return 0;
  const fails = arr.filter((e) => Number(e?.shot) === 0).length;
  return Math.min(1, fails / arr.length);
}

const defaultWeights = {
  rhythm: 0.2,
  volatility: 0.15,
  momentum: 0.2,
  streak: 0.25,
  pressure: 0.2,
};

/**
 * @param {unknown} history - Neural ledger rows: { shot, side, mesa, ronda, timestamp?, id? }[]
 * @returns {{
 *   rhythm: number,
 *   volatility: number,
 *   momentum: number,
 *   streak: number,
 *   pressure: number,
 *   score: number,
 *   zone: 'cold' | 'neutral' | 'hot',
 *   phase: 'rupture' | 'warning' | 'stable',
 *   suggestion: 'enter' | 'watch' | 'wait',
 *   confidence: number,
 * }}
 */
export function computeGPulse(history, weights = defaultWeights) {
  const w = weights || defaultWeights;
  const rhythm = calcRhythm(history);
  const volatility = calcVolatility(history);
  const momentum = calcMomentum(history);
  const streak = calcStreak(history);
  const pressure = calcPressure(history);
  const score =
    rhythm * w.rhythm +
    volatility * w.volatility +
    momentum * w.momentum +
    streak * w.streak +
    pressure * w.pressure;

  let zone;
  if (score < 0.3) zone = 'cold';
  else if (score < 0.6) zone = 'neutral';
  else zone = 'hot';

  let phase;
  if (momentum > 0.7 && volatility > 0.6) {
    phase = 'rupture';
  } else if (momentum > 0.5) {
    phase = 'warning';
  } else {
    phase = 'stable';
  }

  let suggestion;
  if (zone === 'hot' && phase === 'stable') {
    suggestion = 'enter';
  } else if (zone === 'neutral') {
    suggestion = 'watch';
  } else {
    suggestion = 'wait';
  }

  let confidence = score;
  if (phase === 'warning') {
    confidence *= 0.8;
  }
  if (phase === 'rupture') {
    confidence *= 0.6;
  }

  return {
    rhythm,
    volatility,
    momentum,
    streak,
    pressure,
    score,
    zone,
    phase,
    suggestion,
    confidence,
  };
}
