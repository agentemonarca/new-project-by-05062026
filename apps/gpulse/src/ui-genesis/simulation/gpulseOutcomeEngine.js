/**
 * GPulse emulator: baccarat-style rounds with believable win clustering (85–92% perceived)
 * and guardrails against long loss streaks. Not for production trading — simulation only.
 */

import { getSimOutcomeRng } from '../../utils/gpulseRngPolicy.js';

const WINDOW = 12;
const MAX_CONSECUTIVE_LOSSES = 3;
const RANDOM_WIN_P = 0.65;
/** Band used to resample the soft floor each regulation cycle */
const TARGET_MIN = 0.85;
const TARGET_MAX = 0.92;

/**
 * @typedef {'WIN' | 'LOSS'} GpulseSimResult
 * @typedef {'PLAYER' | 'BANKER'} GpulseSimSide
 * @typedef {{
 *   result: GpulseSimResult,
 *   side: GpulseSimSide,
 *   winRate: number,
 * }} GpulseOutcomeSnapshot
 */

/**
 * @typedef {{
 *   results: GpulseSimResult[],
 *   roundCount: number,
 *   regulatorTarget: number | null,
 * }} GpulseOutcomeEngineState
 */

/**
 * @returns {GpulseOutcomeEngineState}
 */
export function createGpulseOutcomeEngineState() {
  return {
    results: [],
    roundCount: 0,
    regulatorTarget: null,
  };
}

/**
 * Count trailing LOSS in `results`.
 * @param {GpulseSimResult[]} results
 */
function countTrailingLosses(results) {
  let n = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] === 'LOSS') n++;
    else break;
  }
  return n;
}

/**
 * Wins in the last up-to-12 results.
 * @param {GpulseSimResult[]} results
 */
function winsInWindow(results) {
  const w = results.slice(-WINDOW);
  return w.filter((r) => r === 'WIN').length;
}

/**
 * Random side (vary presentation; uncorrelated from win draw to reduce obvious coupling).
 * @returns {GpulseSimSide}
 */
function randomSide() {
  const rng = getSimOutcomeRng();
  return rng() < 0.5 ? 'PLAYER' : 'BANKER';
}

/**
 * One simulation step: updates rolling history, enforces streak cap + soft target band.
 *
 * @param {GpulseOutcomeEngineState} state
 * @returns {{ outcome: GpulseOutcomeSnapshot, nextState: GpulseOutcomeEngineState }}
 */
export function advanceGpulseOutcome(state) {
  const history = state.results.slice(-WINDOW);
  const n = history.length;
  const wins = winsInWindow(history);
  const rateBefore = n === 0 ? null : wins / n;

  /** New regulation target every 12 rounds (plus initial) — avoids a single fixed threshold */
  let regulatorTarget = state.regulatorTarget;
  const rng = getSimOutcomeRng();
  if (state.roundCount % 12 === 0) {
    regulatorTarget = TARGET_MIN + rng() * (TARGET_MAX - TARGET_MIN);
  }

  const streakLoss = countTrailingLosses(history);
  const mustBreakStreak = streakLoss >= MAX_CONSECUTIVE_LOSSES;

  let isWin;
  if (mustBreakStreak) {
    isWin = true;
  } else if (rateBefore != null && regulatorTarget != null && rateBefore < regulatorTarget) {
    isWin = true;
  } else {
    isWin = rng() < RANDOM_WIN_P;
  }

  /** Rare nudge: at very high rate, still allow natural losses via 65% branch above; no hard cap */

  const result = isWin ? /** @type {const} */ ('WIN') : /** @type {const} */ ('LOSS');
  const side = randomSide();

  const nextResults = [...state.results, result].slice(-WINDOW);
  const nw = winsInWindow(nextResults);
  const winRate = nextResults.length === 0 ? 0 : nw / nextResults.length;

  const nextState = {
    results: nextResults,
    roundCount: state.roundCount + 1,
    regulatorTarget,
  };

  return {
    outcome: { result, side, winRate },
    nextState,
  };
}

/**
 * Convenience: stateless single draw from implicit fresh history (testing only).
 * @returns {GpulseOutcomeSnapshot}
 */
export function drawGpulseOutcomeDemo() {
  const { outcome } = advanceGpulseOutcome(createGpulseOutcomeEngineState());
  return outcome;
}
