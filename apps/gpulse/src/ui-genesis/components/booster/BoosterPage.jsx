import React, { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BoosterHeader } from './BoosterHeader.jsx';
import { BoosterLiveGenerationCard } from './BoosterLiveGenerationCard.jsx';
import { BoosterProgressCard } from './BoosterProgressCard.jsx';
import { BoosterHistoryList } from './BoosterHistoryList.jsx';
import { BoosterActions } from './BoosterActions.jsx';
import { BoosterImpact } from './BoosterImpact.jsx';
import ProtocolDisclaimer from '../ProtocolDisclaimer.jsx';
import { usdToAig } from '../../../utils/pricing.js';
import { staggerContainer, fadeUpBlur } from '../../motion/variants.js';
import { useCore } from '../../core/CoreContext.jsx';

const BOOSTER_DISCLAIMER =
  'Este módulo representa una participación en la aceleración del protocolo. Las recompensas dependen de la actividad del sistema y no están garantizadas.';

/**
 * Vista BOOSTER — cores desde CoreContext.
 * @param {{
 *   onInject: () => void,
 *   hideNonWalletFinancialActions?: boolean,
 *   onGoToWallet?: () => void,
 * }} props
 */
export function BoosterPage({ onInject, hideNonWalletFinancialActions = false, onGoToWallet }) {
  const { cores, claimCore, claimingId, hasSession } = useCore();
  const [batchClaiming, setBatchClaiming] = useState(false);

  const boosterCores = useMemo(() => cores.filter((c) => c.type === 'booster'), [cores]);

  const rateUsdtPerSecond = useMemo(() => {
    return boosterCores.reduce((s, c) => {
      const headroom = Math.max(0, c.maxGeneration - c.totalGenerated);
      return s + (headroom > 0 ? c.ratePerSecond : 0);
    }, 0);
  }, [boosterCores]);

  const rateAigPerSecond = usdToAig(rateUsdtPerSecond);

  const { generatedAgg, capAgg, progressAgg, liveField } = useMemo(() => {
    let g = 0;
    let cap = 0;
    for (const c of boosterCores) {
      g += c.totalGenerated + c.accumulated;
      cap += c.maxGeneration;
    }
    const progress = cap > 0 ? Math.min(1, g / cap) : 0;
    const live = boosterCores.some((c) => {
      const headroom = Math.max(0, c.maxGeneration - c.totalGenerated);
      return headroom > 0;
    });
    return { generatedAgg: g, capAgg: cap, progressAgg: progress, liveField: live };
  }, [boosterCores]);

  const totalClaimable = useMemo(
    () => boosterCores.reduce((s, c) => s + c.accumulated, 0),
    [boosterCores],
  );

  const claimThreshold = 0.0001;

  const onClaimAig = useCallback(async () => {
    if (!hasSession || totalClaimable < claimThreshold) return;
    setBatchClaiming(true);
    try {
      for (const c of boosterCores) {
        if (c.accumulated > claimThreshold) {
          await claimCore(c);
        }
      }
    } finally {
      setBatchClaiming(false);
    }
  }, [boosterCores, claimCore, hasSession, totalClaimable]);

  const claiming = Boolean(batchClaiming || claimingId);

  return (
    <motion.div
      className="space-y-8"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpBlur}>
        <BoosterHeader />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <BoosterLiveGenerationCard rateUsdtPerSecond={rateUsdtPerSecond} rateAigPerSecond={rateAigPerSecond} />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <BoosterProgressCard
          generatedUsdt={generatedAgg}
          capUsdt={capAgg}
          progress01={progressAgg}
          live={liveField && hasSession}
        />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <BoosterHistoryList cores={boosterCores} />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <BoosterActions
          onInject={onInject}
          onClaimAig={onClaimAig}
          claimDisabled={!hasSession || totalClaimable < claimThreshold}
          claiming={claiming}
          hideClaim={hideNonWalletFinancialActions}
          onGoToWallet={onGoToWallet}
        />
      </motion.div>

      <motion.div variants={fadeUpBlur} className="grid gap-6 lg:grid-cols-2">
        <BoosterImpact />
        <div className="flex flex-col justify-end rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-xs text-slate-500">
          <p>
            La aceleración se aplica sobre la generación del protocolo según tus aportes activos. Revisa cada inyección en
            el historial.
          </p>
        </div>
      </motion.div>

      <ProtocolDisclaimer variant="compact" compactMessage={BOOSTER_DISCLAIMER} />
    </motion.div>
  );
}
