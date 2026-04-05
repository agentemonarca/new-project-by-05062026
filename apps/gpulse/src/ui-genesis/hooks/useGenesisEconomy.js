import { useMemo } from 'react';
import { useStakingEngineStore } from '../stores/stakingEngineStore.js';
import { coreRemainingUsdt } from '../types/miningCore.js';

/**
 * Global AiGenesis economy gate: active staking + min AIG % + not frozen.
 * @param {{
 *   hasSession: boolean,
 *   accountFrozen: boolean,
 *   miningCores: import('../types/miningCore.js').MiningCore[] | undefined,
 * }} input
 */
export function useGenesisEconomy({ hasSession, accountFrozen, miningCores }) {
  const hasOpenEngineStake = useStakingEngineStore((s) =>
    s.activeEngineStakings.some((r) => !r.claimed),
  );

  return useMemo(() => {
    const cores = miningCores ?? [];
    const stakingCores = cores.filter((c) => c.type === 'staking');
    const participationActive = stakingCores.some((c) => coreRemainingUsdt(c) > 0);
    const userHasActiveStaking =
      (Boolean(hasSession) && participationActive) || hasOpenEngineStake;
    const userEconomicallyActive = Boolean(
      hasSession && userHasActiveStaking && !accountFrozen,
    );
    return {
      stakingCores,
      userHasActiveStaking,
      userEconomicallyActive,
    };
  }, [hasSession, accountFrozen, miningCores, hasOpenEngineStake]);
}

/**
 * Binary "pending" volume: unmatched leg (display-only).
 * @param {number} leftPts
 * @param {number} rightPts
 */
export function pendingBinaryVolume(leftPts, rightPts) {
  return Math.max(0, Math.abs((Number(leftPts) || 0) - (Number(rightPts) || 0)));
}
