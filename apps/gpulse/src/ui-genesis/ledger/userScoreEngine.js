/**
 * @typedef {{ score: number, level: 'Beginner' | 'Advanced' | 'Pro' }} UserScoreResult
 */

/**
 * Single scoring path from CoreContext fields (energy, totalYield, network, staking, multiplier, session).
 * Does not re-run mining/booster formulas — uses values already on `core`.
 *
 * @param {Record<string, unknown>} core
 * @returns {UserScoreResult}
 */
export function calculateUserScore(core) {
  const energy = Math.max(0, Math.min(100, Number(core.energy ?? 0)));
  const totalYield = Number(core.totalYield ?? 0);
  const yieldNorm = Math.max(0, Math.min(1, totalYield / 1.2)) * 100;
  const net = Math.max(0, Math.min(1, Number(core.networkBoost ?? 0))) * 100;
  const stake = Math.max(0, Math.min(1, Number(core.stakingYield ?? 0))) * 100;
  const multBonus = Math.max(0, Math.min(100, (Number(core.multiplier ?? 1) - 1) * 55));
  const session = core.hasSession ? 100 : 35;

  const score = Math.round(
    0.38 * energy + 0.22 * yieldNorm + 0.15 * net + 0.12 * stake + 0.09 * multBonus + 0.04 * session,
  );
  const clamped = Math.max(0, Math.min(100, score));

  let level = 'Beginner';
  if (clamped >= 72) level = 'Pro';
  else if (clamped >= 38) level = 'Advanced';

  return { score: clamped, level };
}
