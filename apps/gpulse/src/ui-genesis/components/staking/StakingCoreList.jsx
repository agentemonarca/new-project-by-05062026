import React from 'react';
import { StakingCoreCard } from './StakingCoreCard.jsx';

/**
 * @param {{
 *   cores: import('../../types/miningCore.js').MiningCore[],
 *   claimCore: (core: import('../../types/miningCore.js').MiningCore) => Promise<void>,
 *   claimingId: string | null,
 *   hasSession: boolean,
 *   onWithdraw: () => void,
 *   hideInlineFinancialActions?: boolean,
 *   onGoToWallet?: () => void,
 * }} props
 */
export function StakingCoreList({
  cores,
  claimCore,
  claimingId,
  hasSession,
  onWithdraw,
  hideInlineFinancialActions = false,
  onGoToWallet,
}) {
  const claimThreshold = 0.0001;

  if (cores.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-blue-500/20 bg-slate-950/40 px-6 py-12 text-center">
        <p className="text-sm text-slate-500">Aún no hay núcleos de staking. Activa un programa para ver tu participación aquí.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-white">Núcleos de staking</h2>
        <p className="mt-1 text-sm text-slate-500">Cada bloqueo es un nodo independiente con su propia generación y estado.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {cores.map((core) => (
          <StakingCoreCard
            key={core.id}
            core={core}
            hasSession={hasSession}
            claiming={claimingId === core.id}
            canClaim={hasSession && core.accumulated > claimThreshold}
            onClaim={() => claimCore(core)}
            onWithdraw={onWithdraw}
            hideInlineFinancialActions={hideInlineFinancialActions}
            onGoToWallet={onGoToWallet}
          />
        ))}
      </div>
    </section>
  );
}
