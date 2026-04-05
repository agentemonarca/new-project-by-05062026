/**
 * @typedef {'mining' | 'booster' | 'staking'} MiningCoreType
 */

/**
 * Independent liquidity contribution tracked as a "Core" with its own generation lifecycle.
 * @typedef {Object} MiningCore
 * @property {string} id
 * @property {MiningCoreType} type
 * @property {number} contribution — principal USDT (informational)
 * @property {number} ratePerSecond — protocol accounting rate (USDT/s)
 * @property {number} accumulated — claimable USDT in buffer
 * @property {number} totalGenerated — USDT already realized toward cap
 * @property {number} maxGeneration — USDT cap for this core lifecycle
 * @property {number} progress — 0–1 visual progress toward cap
 * @property {number} startTime — epoch ms when core started
 * @property {number} [lockedAig] — staking: AIG bloqueado (solo UI)
 * @property {number} [lockDurationDays] — staking: duración del programa en días; 0 = flexible
 * @property {number} [lockStartTime] — staking: inicio del bloqueo (epoch ms); por defecto startTime
 */

/** Rough protocol display factor: AIG per 1 USDT for equivalent line (UI only). */
export const USDT_TO_AIG_DISPLAY = 0.92;

/**
 * @param {MiningCore} core
 * @returns {number}
 */
export function coreRemainingUsdt(core) {
  return Math.max(0, core.maxGeneration - core.totalGenerated - core.accumulated);
}

/**
 * @param {MiningCore} core
 * @returns {number}
 */
export function coreProgress01(core) {
  if (!core.maxGeneration || core.maxGeneration <= 0) return 0;
  return Math.min(1, (core.totalGenerated + core.accumulated) / core.maxGeneration);
}

/**
 * Maps core engine type to existing claim API channel until per-core IDs are supported server-side.
 * @param {MiningCoreType} t
 * @returns {'direct' | 'mining' | 'binary'}
 */
export function coreTypeToClaimChannel(t) {
  if (t === 'mining') return 'mining';
  if (t === 'booster') return 'direct';
  return 'binary';
}

/**
 * @param {import('./miningCore.js').MiningCore} core
 */
export function getStakingLockedAig(core) {
  if (core.type !== 'staking') return 0;
  if (typeof core.lockedAig === 'number') return core.lockedAig;
  return Math.max(0, Math.round(core.contribution / 16));
}

/**
 * @param {import('./miningCore.js').MiningCore} core
 */
export function isStakingFlexible(core) {
  return core.type === 'staking' && (core.lockDurationDays ?? 0) <= 0;
}

/**
 * Días restantes del bloqueo fijo; `null` si flexible.
 * @param {import('./miningCore.js').MiningCore} core
 * @param {number} [now]
 */
export function stakingLockRemainingDays(core, now = Date.now()) {
  if (core.type !== 'staking') return null;
  const total = core.lockDurationDays ?? 0;
  if (total <= 0) return null;
  const start = core.lockStartTime ?? core.startTime;
  const end = start + total * 86400000;
  return Math.max(0, Math.ceil((end - now) / 86400000));
}

/**
 * Progreso temporal del bloqueo (0–1): transcurrido / duración.
 * @param {import('./miningCore.js').MiningCore} core
 * @param {number} [now]
 */
export function stakingLockTimeProgress01(core, now = Date.now()) {
  if (core.type !== 'staking') return 0;
  const total = core.lockDurationDays ?? 0;
  if (total <= 0) return 0;
  const start = core.lockStartTime ?? core.startTime;
  const elapsed = Math.max(0, now - start);
  return Math.min(1, elapsed / (total * 86400000));
}

/**
 * Etiqueta corta del programa de staking.
 * @param {import('./miningCore.js').MiningCore} core
 */
export function stakingProgramLabel(core) {
  if (core.type !== 'staking') return '—';
  const d = core.lockDurationDays ?? 0;
  if (d <= 0) return 'Flexible';
  if (d === 30) return '30 días';
  if (d === 60) return '60 días';
  if (d === 90) return '90 días';
  return `${d} días`;
}
