import React, { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { StakingHeader } from './StakingHeader.jsx';
import { StakingEngineHero } from './StakingEngineHero.jsx';
import { StakingSummary } from './StakingSummary.jsx';
import { StakingLiveGeneration } from './StakingLiveGeneration.jsx';
import { StakingPrograms } from './StakingPrograms.jsx';
import { StakingEngineActiveLocks } from './StakingEngineActiveLocks.jsx';
import { StakingCoreList } from './StakingCoreList.jsx';
import { StakingBinaryEngine } from './StakingBinaryEngine.jsx';
import { StakingDirectBonus } from './StakingDirectBonus.jsx';
import { StakingMiningBoostSection } from './StakingMiningBoostSection.jsx';
import { StakingTeamVisibility } from './StakingTeamVisibility.jsx';
import { StakingImpact } from './StakingImpact.jsx';
import { StakingHistory } from './StakingHistory.jsx';
import { StakingActions } from './StakingActions.jsx';
import ProtocolDisclaimer from '../ProtocolDisclaimer.jsx';
import { RuleHint } from '../RuleHint.jsx';
import { coreRemainingUsdt, getStakingLockedAig } from '../../types/miningCore.js';
import { usdToAig } from '../../../utils/pricing.js';
import { staggerContainer, fadeUpBlur } from '../../motion/variants.js';
import { useCore } from '../../core/CoreContext.jsx';
import { useStakingEngineStore } from '../../stores/stakingEngineStore.js';

const STAKING_DISCLAIMER =
  'El staking representa participación en el protocolo mediante bloqueo de activos. Las recompensas dependen de la actividad del sistema y pueden variar.';

/**
 * @param {{
 *   onStake: () => void,
 *   onWithdraw?: () => void,
 *   hideNonWalletFinancialActions?: boolean,
 *   onGoToWallet?: () => void,
 *   economy?: {
 *     userEconomicallyActive: boolean,
 *     userHasActiveStaking: boolean,
 *     accountFrozen: boolean,
 *     holdingPctAig: number,
 *   } | null,
 * }} props
 */
export function StakingPage({
  onStake,
  onWithdraw = () => {},
  hideNonWalletFinancialActions = false,
  onGoToWallet,
  economy = null,
}) {
  const { cores, claimCore, claimingId, hasSession } = useCore();
  const [batchClaiming, setBatchClaiming] = useState(false);
  const engineStakings = useStakingEngineStore((s) => s.activeEngineStakings);

  const stakingCores = useMemo(() => cores.filter((c) => c.type === 'staking'), [cores]);

  const rateUsdtPerSecond = useMemo(() => {
    return stakingCores.reduce((s, c) => {
      const headroom = coreRemainingUsdt(c);
      return s + (headroom > 0 ? c.ratePerSecond : 0);
    }, 0);
  }, [stakingCores]);

  const rateAigPerSecond = usdToAig(rateUsdtPerSecond);

  const participationActive = useMemo(
    () => stakingCores.some((c) => coreRemainingUsdt(c) > 0),
    [stakingCores],
  );

  const totalLockedAig = useMemo(
    () => stakingCores.reduce((s, c) => s + getStakingLockedAig(c), 0),
    [stakingCores],
  );

  const userHasActiveStaking = useMemo(
    () => (participationActive && Boolean(hasSession)) || engineStakings.some((r) => !r.claimed),
    [participationActive, hasSession, engineStakings],
  );

  const userEconomicallyActive = useMemo(
    () =>
      economy?.userEconomicallyActive ??
      Boolean(hasSession && userHasActiveStaking),
    [economy?.userEconomicallyActive, hasSession, userHasActiveStaking],
  );

  const totalClaimable = useMemo(() => stakingCores.reduce((s, c) => s + c.accumulated, 0), [stakingCores]);

  const claimThreshold = 0.0001;

  const onClaimAll = useCallback(async () => {
    if (!hasSession || totalClaimable < claimThreshold) return;
    setBatchClaiming(true);
    try {
      for (const c of stakingCores) {
        if (c.accumulated > claimThreshold) {
          await claimCore(c);
        }
      }
    } finally {
      setBatchClaiming(false);
    }
  }, [stakingCores, claimCore, hasSession, totalClaimable]);

  const claiming = Boolean(batchClaiming || claimingId);

  return (
    <motion.div className="space-y-8" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUpBlur}>
        <StakingHeader />
      </motion.div>

      <motion.div variants={fadeUpBlur} className="-mt-2">
        <RuleHint
          variant="inline"
          message="El staking activa tus ingresos cuando la cuenta cumple las condiciones del protocolo (bloqueo, holding y economía activa)."
          linkText="ℹ️ Ver cómo funciona"
          modalTitle="Staking y economía activa"
          modalContent={
            <div className="space-y-3">
              <p>
                La participación en staking puede desbloquear o mantener el estado de “economía activa”, según los productos
                que tengas contratados y las reglas vigentes en la interfaz.
              </p>
              <p className="text-[11px] text-slate-500">
                Las recompensas dependen de la actividad del sistema; no se garantizan importes fijos.
              </p>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <StakingEngineHero
          totalLockedAig={totalLockedAig}
          rateUsdtPerSecond={rateUsdtPerSecond}
          userHasActiveStaking={userHasActiveStaking}
          userEconomicallyActive={userEconomicallyActive}
          hasSession={hasSession}
        />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <StakingSummary
          stakingCores={stakingCores}
          rateUsdtPerSecond={rateUsdtPerSecond}
          rateAigPerSecond={rateAigPerSecond}
          participationActive={participationActive && hasSession}
        />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <StakingLiveGeneration
          rateUsdtPerSecond={rateUsdtPerSecond}
          rateAigPerSecond={rateAigPerSecond}
          economicActive={userEconomicallyActive}
        />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <StakingPrograms onActivate={onStake} />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <StakingEngineActiveLocks />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <StakingCoreList
          cores={stakingCores}
          claimCore={claimCore}
          claimingId={claimingId}
          hasSession={hasSession}
          onWithdraw={onWithdraw}
          hideInlineFinancialActions={hideNonWalletFinancialActions}
          onGoToWallet={onGoToWallet}
        />
      </motion.div>

      <motion.div variants={fadeUpBlur} className="grid gap-6 lg:grid-cols-2">
        <StakingBinaryEngine userEconomicallyActive={userEconomicallyActive} />
        <StakingDirectBonus userEconomicallyActive={userEconomicallyActive} />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <StakingTeamVisibility />
      </motion.div>

      <motion.div variants={fadeUpBlur} className="grid gap-6 lg:grid-cols-2">
        <StakingMiningBoostSection userEconomicallyActive={userEconomicallyActive} />
        <StakingImpact />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <div className="flex flex-col justify-end rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-xs text-slate-500">
          <p>
            Cada programa ajusta el peso relativo de tu participación. Los valores mostrados son contabilidad del protocolo,
            no promesa de resultado.
          </p>
        </div>
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <StakingHistory cores={stakingCores} />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <StakingActions
          onStake={onStake}
          onClaimAll={onClaimAll}
          claimDisabled={!hasSession || totalClaimable < claimThreshold}
          claiming={claiming}
          hideClaim={hideNonWalletFinancialActions}
          onGoToWallet={onGoToWallet}
        />
      </motion.div>

      <ProtocolDisclaimer variant="compact" compactMessage={STAKING_DISCLAIMER} />
    </motion.div>
  );
}
