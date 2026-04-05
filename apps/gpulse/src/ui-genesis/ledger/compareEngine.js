import { coreRemainingUsdt } from '../types/miningCore.js';

/**
 * @typedef {import('../types/miningCore.js').MiningCore} MiningCore
 */

/**
 * Compare active mining cores by share of total mining USDT/s.
 * @param {MiningCore[]} cores
 * @returns {{ items: Array<{ id: string, type: string, ratePerSecond: number, contributionPercent: number }>, totalRate: number }}
 */
export function compareMiningCores(cores) {
  const mining = cores.filter((c) => c.type === 'mining' && coreRemainingUsdt(c) > 0);
  const totalRate = mining.reduce((s, c) => s + c.ratePerSecond, 0);
  const denom = totalRate > 0 ? totalRate : 1e-12;
  const items = mining.map((c) => ({
    id: c.id,
    type: c.type,
    ratePerSecond: c.ratePerSecond,
    contributionPercent: (c.ratePerSecond / denom) * 100,
  }));
  return { items, totalRate };
}

/**
 * Aggregate protocol rate by module type (mining / booster / staking).
 * @param {MiningCore[]} cores
 * @returns {{
 *   mining: { rate: number, contributionPercent: number },
 *   booster: { rate: number, contributionPercent: number },
 *   staking: { rate: number, contributionPercent: number },
 *   totalRate: number,
 * }}
 */
export function compareModules(cores) {
  const rates = { mining: 0, booster: 0, staking: 0 };
  for (const c of cores) {
    if (!rates[c.type]) continue;
    if (coreRemainingUsdt(c) <= 0) continue;
    rates[c.type] += c.ratePerSecond;
  }
  const totalRate = rates.mining + rates.booster + rates.staking || 1e-12;
  return {
    mining: { rate: rates.mining, contributionPercent: (rates.mining / totalRate) * 100 },
    booster: { rate: rates.booster, contributionPercent: (rates.booster / totalRate) * 100 },
    staking: { rate: rates.staking, contributionPercent: (rates.staking / totalRate) * 100 },
    totalRate: rates.mining + rates.booster + rates.staking,
  };
}
