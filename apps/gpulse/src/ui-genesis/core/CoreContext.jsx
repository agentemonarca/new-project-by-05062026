import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useRuntimeTrace } from '../../utils/runtimeDiagnostics.js';
import {
  calculateEnergy,
  calculateTotalYield,
  reactorStateFromEnergy,
  multiplierFromBooster,
  networkBoostFromNetwork,
  powerFromMining,
  stakingYieldFromStaking,
  usdtPerSecondToAigPerSecond,
} from './energyEngine.js';

const CoreContext = createContext(null);

/**
 * Single source of truth for the energy layer. Pass normalized `mining` once; no duplicate summaries.
 * When `economicActive` is false, displayed USDT/s and AIG/s yields are zero (global gate).
 *
 * @param {{
 *   children: React.ReactNode,
 *   mining: {
 *     cores: import('../types/miningCore.js').MiningCore[],
 *     totalPower: number,
 *     totalAccumulated: number,
 *     totalGeneration: number,
 *     claimCore: (core: import('../types/miningCore.js').MiningCore) => Promise<void>,
 *     claimingId: string | null,
 *   },
 *   booster?: { multiplier?: number },
 *   network: { leftPts: number, rightPts: number },
 *   staking?: { stakingYield?: number },
 *   aigBalance: number,
 *   hasSession: boolean,
 *   economicActive?: boolean,
 *   claimUi?: {
 *     claimAllBusy: boolean,
 *     onClaimAll: () => Promise<void>,
 *     minHoldingUsdt: number,
 *     ledgerNetUsdt: number,
 *     directClaimUsdt?: number,
 *     accountFrozen?: boolean,
 *   },
 *   walletHints?: { directClaimUsdt?: number },
 *   shell?: {
 *     onNavigate: (id: string) => void,
 *     onOpenMarketplace: () => void,
 *     onOpenPurchase: () => void,
 *   },
 * }} props
 */
export function CoreProvider({
  children,
  mining,
  booster,
  network,
  staking,
  aigBalance,
  hasSession,
  economicActive = true,
  claimUi,
  walletHints,
  shell,
}) {
  const cores = mining?.cores ?? [];
  const leftPts = network?.leftPts ?? 0;
  const rightPts = network?.rightPts ?? 0;
  const totalPower = mining?.totalPower ?? 0;

  const claimCore = useCallback(
    async (core) => {
      if (typeof mining?.claimCore === 'function') {
        return mining.claimCore(core);
      }
    },
    [mining?.claimCore],
  );

  const power = useMemo(() => powerFromMining(cores), [cores]);

  const multiplier = useMemo(
    () => (booster?.multiplier != null ? booster.multiplier : multiplierFromBooster(cores)),
    [booster?.multiplier, cores],
  );

  const networkBoost = useMemo(
    () => networkBoostFromNetwork(leftPts, rightPts),
    [leftPts, rightPts],
  );

  const stakingYield = useMemo(
    () => (staking?.stakingYield != null ? staking.stakingYield : stakingYieldFromStaking(cores)),
    [staking?.stakingYield, cores],
  );

  const energy = useMemo(
    () => calculateEnergy({ power, multiplier, networkBoost }),
    [power, multiplier, networkBoost],
  );

  /** Dimensionless yield factor; effective USDT/s = totalPower × totalYield */
  const totalYield = useMemo(
    () => calculateTotalYield({ energy, stakingYield }),
    [energy, stakingYield],
  );

  const totalYieldUsdtPerSecondRaw = useMemo(
    () => Math.max(0, totalPower * totalYield),
    [totalPower, totalYield],
  );

  const totalYieldUsdtPerSecond = useMemo(
    () => (economicActive ? totalYieldUsdtPerSecondRaw : 0),
    [economicActive, totalYieldUsdtPerSecondRaw],
  );

  const totalYieldAigPerSecond = useMemo(
    () => usdtPerSecondToAigPerSecond(totalYieldUsdtPerSecond),
    [totalYieldUsdtPerSecond],
  );

  const reactorState = useMemo(() => reactorStateFromEnergy(energy), [energy]);

  const value = useMemo(
    () => ({
      hasSession,
      economicActive,
      mining,
      cores,
      totalPower,
      claimCore,
      claimingId: mining?.claimingId ?? null,
      energy,
      totalYield,
      power,
      multiplier,
      networkBoost,
      stakingYield,
      aigBalance,
      totalYieldUsdtPerSecond,
      totalYieldAigPerSecond,
      totalYieldUsdtPerSecondRaw,
      rawTotalRatePerSecond: totalPower,
      reactorState,
      network: network ?? { leftPts: 0, rightPts: 0 },
      leftPts,
      rightPts,
      claimUi: claimUi ?? null,
      walletHints: walletHints ?? null,
      directClaimUsdt: claimUi?.directClaimUsdt ?? walletHints?.directClaimUsdt ?? 0,
      shell: shell ?? null,
    }),
    [
      hasSession,
      economicActive,
      mining,
      cores,
      totalPower,
      claimCore,
      energy,
      totalYield,
      power,
      multiplier,
      networkBoost,
      stakingYield,
      aigBalance,
      totalYieldUsdtPerSecond,
      totalYieldAigPerSecond,
      totalYieldUsdtPerSecondRaw,
      reactorState,
      network,
      leftPts,
      rightPts,
      claimUi,
      walletHints,
      shell,
    ],
  );

  useRuntimeTrace(
    'CoreProvider',
    () => ({
      hasSession,
      coresLen: mining?.cores?.length ?? 0,
      totalPower: mining?.totalPower ?? null,
      aigBalance,
      energy,
      totalYieldUsdtPerSecond,
      hasClaimAll: typeof claimUi?.onClaimAll === 'function',
    }),
    [
      hasSession,
      mining?.cores?.length,
      mining?.totalPower,
      aigBalance,
      energy,
      totalYieldUsdtPerSecond,
      claimUi?.onClaimAll,
    ],
  );

  return <CoreContext.Provider value={value}>{children}</CoreContext.Provider>;
}

/** @returns {NonNullable<React.ContextType<typeof CoreContext>>} */
export function useCore() {
  const ctx = useContext(CoreContext);
  if (!ctx) {
    throw new Error('useCore must be used within CoreProvider');
  }
  return ctx;
}

/** Safe for routes outside CoreProvider (e.g. standalone marketplace). */
export function useOptionalCore() {
  return useContext(CoreContext);
}
