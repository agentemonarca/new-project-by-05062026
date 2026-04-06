import { coreRemainingUsdt, getStakingLockedAig } from '../types/miningCore.js';
import { usdToAig } from '../../utils/pricing.js';

/**
 * @typedef {import('../types/miningCore.js').MiningCore} MiningCore
 */

const MULT_CAP = 2.85;
const MINING_REF_USDT_S = 0.001;
const STAKING_AIG_CAP = 2500;

// --- Input normalization (used by CoreProvider; single path for module inputs) ---

/**
 * @param {MiningCore[]} cores
 * @returns {number} 0–1
 */
export function powerFromMining(cores) {
  let miningRate = 0;
  for (const c of cores) {
    if (c.type !== 'mining') continue;
    if (coreRemainingUsdt(c) <= 0) continue;
    miningRate += c.ratePerSecond;
  }
  return Math.min(1, miningRate / MINING_REF_USDT_S);
}

/**
 * @param {MiningCore[]} cores
 * @returns {number} ≥ 1
 */
export function multiplierFromBooster(cores) {
  let miningRate = 0;
  let boosterRate = 0;
  for (const c of cores) {
    const ok = coreRemainingUsdt(c) > 0;
    if (!ok) continue;
    if (c.type === 'mining') miningRate += c.ratePerSecond;
    if (c.type === 'booster') boosterRate += c.ratePerSecond;
  }
  const base = Math.max(miningRate, 1e-12);
  const raw = 1 + (boosterRate / base) * 0.88;
  return Math.min(MULT_CAP, Math.max(1, raw));
}

/**
 * @param {number} leftPts
 * @param {number} rightPts
 * @returns {number} 0–1
 */
export function networkBoostFromNetwork(leftPts, rightPts) {
  const t = leftPts + rightPts;
  if (t <= 0) return 0;
  return (2 * Math.min(leftPts, rightPts)) / t;
}

/**
 * @param {MiningCore[]} cores
 * @returns {number} 0–1
 */
export function stakingYieldFromStaking(cores) {
  let locked = 0;
  for (const c of cores) {
    if (c.type !== 'staking') continue;
    locked += getStakingLockedAig(c);
  }
  return Math.min(1, locked / STAKING_AIG_CAP);
}

/**
 * Unified energy score (0–100) from mining / booster / network only.
 * @param {{ power: number, multiplier: number, networkBoost: number }} p
 * @returns {number}
 */
export function calculateEnergy({ power, multiplier, networkBoost }) {
  const p = Math.max(0, Math.min(1, power ?? 0));
  const multNorm = Math.min(1, Math.max(0, ((multiplier ?? 1) - 1) / (MULT_CAP - 1)));
  const nb = Math.max(0, Math.min(1, networkBoost ?? 0));
  const e = 100 * (0.38 * p + 0.37 * multNorm + 0.25 * nb);
  return Math.max(0, Math.min(100, e));
}

/**
 * Yield multiplier from energy + staking participation (pure). Multiply by protocol `totalPower` (USDT/s) for effective rate.
 * @param {{ energy: number, stakingYield: number }} p
 * @returns {number}
 */
export function calculateTotalYield({ energy, stakingYield }) {
  const e = Math.max(0, Math.min(100, energy ?? 0)) / 100;
  const s = Math.max(0, Math.min(1, stakingYield ?? 0));
  return e * (0.82 + 0.18 * s);
}

/**
 * Visual banding for reactor UI (0–100 energy index).
 * idle 0–15 · charging 15–50 · overdrive 50–85 · unstable 85–100
 *
 * @param {number} energy
 * @returns {'idle' | 'charging' | 'overdrive' | 'unstable'}
 */
export function reactorStateFromEnergy(energy) {
  const e = Math.max(0, Math.min(100, Number(energy) || 0));
  if (e < 15) return 'idle';
  if (e < 50) return 'charging';
  if (e < 85) return 'overdrive';
  return 'unstable';
}

/** @param {number} usdtPerSecond */
export function usdtPerSecondToAigPerSecond(usdtPerSecond) {
  return Math.max(0, usdToAig(usdtPerSecond));
}

export const EnergyEngine = {
  calculateEnergy,
  calculateTotalYield,
  reactorStateFromEnergy,
};
