import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Topbar } from '../components/Topbar.jsx';
import { GlassCard } from '../components/GlassCard.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import { AnimatedLoader } from '../components/AnimatedLoader.jsx';
import { DashboardSidebar } from '../layout/DashboardSidebar.jsx';
import { GenesisAuthBar } from '../components/GenesisAuthBar.jsx';
import { ProtocolDisclaimer } from '../components/ProtocolDisclaimer.jsx';
import { MiningCoreSystem } from '../components/MiningCoreSystem.jsx';
import { BoosterPage } from '../components/booster/BoosterPage.jsx';
import { StakingPage } from '../components/staking/StakingPage.jsx';
import { MainDashboardView } from '../components/dashboard/MainDashboardView.jsx';
import { CommunityPage } from '../components/community/CommunityPage.jsx';
import { useCore } from '../core/CoreContext.jsx';
import { LedgerPage } from './LedgerPage.jsx';
import { GenesisWalletPage } from './GenesisWalletPage.jsx';
import { GenesisNftPage } from './GenesisNftPage.jsx';
import { GPulseLobby } from './GPulseLobby.jsx';
import { GenesisLobbyPage } from './GenesisLobbyPage.jsx';
import { GenesisPromoPage } from './GenesisPromoPage.jsx';
import { GenesisP2PMarketplacePage } from './GenesisP2PMarketplacePage.jsx';
import { GenesisTopGPage } from './GenesisTopGPage.jsx';
import { GenesisProfilePage } from './GenesisProfilePage.jsx';
import GenesisSupportPage from './GenesisSupportPage.jsx';
import { fadeUpBlur, pageCrossfade } from '../motion/variants.js';
import { DashboardBreadcrumb } from '../components/DashboardBreadcrumb.jsx';
import { GenesisChromeContextBar } from '../components/GenesisChromeContextBar.jsx';
import { GenesisNotificationCenter } from '../components/GenesisNotificationCenter.jsx';
import { UiModeToggle } from '../components/UiModeToggle.jsx';
import { SimulationModeToggle } from '../components/SimulationModeToggle.jsx';
import { ProviderRelayStatusStrip } from '../../components/ProviderRelayStatusStrip.jsx';
import { useWallet } from '../../context/WalletContext.jsx';
import { useGenesisDashboardStore } from '../stores/genesisDashboardStore.js';
import { DEFAULT_PERMISSIONS } from '../lib/userPermissions.js';

/**
 * Dashboard shell layout — module-scoped so React does not remount the tree on every parent render.
 * (Defining this component inside GenesisDashboardPage created a new component type each render → flicker.)
 */
export function GenesisDashboardLayout({
  nav,
  isSidebarOpen,
  setIsSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  navigateTo,
  onOpenMiningWarning,
  onOpenWithdraw,
  hasSession,
  isSimulationMode = false,
  topbarTitle: _topbarTitle,
  topbarSubtitle: _topbarSubtitle,
  walletAddress,
  isImmersiveShell,
  isGpulseLobby,
  isGenesisLobby,
  userEconomicallyActive,
  userHasActiveStaking,
  holdingPctAig,
  accountFrozen,
  minHoldingPct,
  minProtocolHoldingUsdt,
  ledgerNet,
  showFatalError,
  storeError,
  loadDashboardData,
  totalLobbyBalanceUsd,
  miningInvestedTotal,
  binaryTotal,
  referralActive,
  openPurchase,
  /** @type {undefined | ((product: 'booster' | 'mining' | 'gpulse' | 'staking') => void)} */
  openPaymentFlow,
  openMarketplace,
  claimAllFromDashboard,
  claimLoading,
  claimAllBusy,
  directClaim,
  leftPts,
  rightPts,
  miningUsdtAccum,
  aigDisplay,
  loading,
  walletLoaded,
  stakingEconomy,
  centralRewardBalanceAig = 0,
  /** Permisos granular (sesión); sin sesión se asume acceso completo en navegación. */
  uiPermissions = DEFAULT_PERMISSIONS,
}) {
  const ctx = useCore();
  const navigate = useNavigate();
  const { address: web3Address, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const signOut = useGenesisDashboardStore((s) => s.signOut);

  const onHeaderWeb3Action = useCallback(() => {
    if (web3Address) {
      void signOut();
      disconnectWallet();
    } else {
      void connectWallet().catch(() => {});
    }
  }, [web3Address, connectWallet, disconnectWallet, signOut]);

  const onGoToWallet = useCallback(() => navigateTo('wallet'), [navigateTo]);

  useEffect(() => {
    if (!isSidebarOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSidebarOpen, setIsSidebarOpen]);

  const notificationProps = {
    onNavigate: navigateTo,
    hasSession,
    userHasActiveStaking,
    holdingPctAig,
    minHoldingPct: minHoldingPct,
    accountFrozen,
    userEconomicallyActive,
    leftPts,
    rightPts,
    directClaimUsdt: directClaim,
  };

  return (
    <div className="relative z-10 flex min-h-screen">
      <div
        className={`fixed inset-y-0 left-0 z-40 flex transition-transform duration-300 ease-out will-change-transform md:z-30 md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <DashboardSidebar
          compact={isSidebarCollapsed}
          activeId={nav}
          hasSession={hasSession}
          permissions={uiPermissions}
          onSelect={(id) => {
            if (id === 'marketplace') {
              navigate('/marketplace');
              return;
            }
            navigateTo(id);
            setIsSidebarOpen(false);
          }}
        />
      </div>
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-[35] bg-slate-950/50 backdrop-blur-[2px] transition-opacity md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}
      <div
        className={`flex min-h-0 flex-1 flex-col transition-[padding] duration-300 ease-out ${
          isSidebarCollapsed ? 'md:pl-[4.5rem]' : 'md:pl-[17.5rem]'
        }`}
      >
        <div className="sticky top-0 z-40">
          <Topbar
            onMenu={() => setIsSidebarOpen(true)}
            onToggleSidebarCollapse={() => setIsSidebarCollapsed((c) => !c)}
            sidebarCollapsed={isSidebarCollapsed}
            onLogoClick={() => navigateTo('genesis-lobby')}
            hasSession={hasSession}
            userEconomicallyActive={userEconomicallyActive}
            accountFrozen={accountFrozen}
            walletAddress={walletAddress}
            balanceUsd={totalLobbyBalanceUsd}
            balanceLoading={Boolean(hasSession && loading && !walletLoaded && !isSimulationMode)}
            primaryLabel={web3Address ? 'Disconnect' : 'Connect'}
            primaryDisabled={isConnecting}
            onPrimaryAction={onHeaderWeb3Action}
            trailing={
              <>
                <button
                  type="button"
                  onClick={() => navigate('/onboarding?ref=demo')}
                  className="hidden shrink-0 rounded-lg border border-orange-500/35 bg-orange-500/10 px-2 py-1.5 text-[10px] font-semibold text-orange-100/95 transition hover:bg-orange-500/15 sm:inline-flex"
                  title="Simular entrada con referido (demo)"
                >
                  🔥 Onboarding Preview
                </button>
                <SimulationModeToggle className="shrink-0" />
                <UiModeToggle className="shrink-0" />
                {isImmersiveShell ? <GenesisNotificationCenter {...notificationProps} /> : null}
              </>
            }
          />
          <ProviderRelayStatusStrip variant="bar" />
          {isSimulationMode ? (
            <div className="border-b border-amber-500/35 bg-amber-500/10 px-4 py-2 text-center text-[11px] font-semibold text-amber-100/95 md:text-xs">
              Modo simulación activo · volúmenes, wallet y ledger usan datos ficticios (variación aleatoria).
            </div>
          ) : null}
          {isImmersiveShell ? null : (
            <GenesisChromeContextBar
              hasSession={hasSession}
              userEconomicallyActive={userEconomicallyActive}
              userHasActiveStaking={userHasActiveStaking}
              accountFrozen={accountFrozen}
              holdingPctAig={holdingPctAig}
              minHoldingPct={minHoldingPct}
              rateUsdtPerSecond={ctx.totalYieldUsdtPerSecond}
              navigateTo={navigateTo}
              notificationProps={notificationProps}
              gpulseLobbyActive={isGpulseLobby}
            />
          )}
        </div>
        {isImmersiveShell ? null : (
          <div className="border-b border-white/[0.06] bg-slate-950/35 px-4 py-2 md:px-8">
            <div className="mx-auto max-w-7xl">
              <DashboardBreadcrumb nav={nav} onNavigate={navigateTo} />
            </div>
          </div>
        )}
        <main
          className={`flex min-h-0 flex-1 flex-col overflow-auto ${isImmersiveShell ? 'overflow-hidden p-0' : 'p-4 md:p-8'}`}
        >
          {isImmersiveShell ? null : (
            <div className="mx-auto mb-6 max-w-7xl space-y-4">
              <GenesisAuthBar />
              <ProtocolDisclaimer />
            </div>
          )}

          {showFatalError ? (
            <div className="mx-auto mb-8 flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-rose-500/30 bg-rose-950/30 p-8 text-center backdrop-blur-md">
              <p className="text-sm text-rose-100">{storeError}</p>
              <GradientButton type="button" className="!py-2 !text-xs" onClick={() => loadDashboardData().catch(() => {})}>
                Retry
              </GradientButton>
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={nav}
              role="main"
              aria-live="polite"
              className={
                isImmersiveShell
                  ? 'mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col'
                  : 'mx-auto max-w-7xl space-y-10'
              }
              initial={pageCrossfade.initial}
              animate={pageCrossfade.animate}
              exit={pageCrossfade.exit}
              transition={pageCrossfade.transition}
            >
              {isGpulseLobby ? (
                <GPulseLobby
                  onBackToDashboard={() => navigateTo('dashboard')}
                  onActivateMembership={openPaymentFlow ? () => openPaymentFlow('gpulse') : undefined}
                />
              ) : null}

              {isGenesisLobby ? (
                <GenesisLobbyPage
                  onNavigate={navigateTo}
                  onOpenMarketplace={openMarketplace}
                  hasSession={hasSession}
                  totalBalanceUsd={totalLobbyBalanceUsd}
                  miningActiveDisplay={miningInvestedTotal}
                  networkVolumeTotal={binaryTotal}
                  holdingPct={holdingPctAig}
                  userHasActiveStaking={userHasActiveStaking}
                  accountFrozen={accountFrozen}
                  userEconomicallyActive={userEconomicallyActive}
                  minHoldingPct={minHoldingPct}
                />
              ) : null}

              {hasSession && storeError ? (
                <div className="rounded-xl border border-rose-500/35 bg-rose-950/35 px-4 py-3 text-sm text-rose-100/95 backdrop-blur-md">
                  {storeError}{' '}
                  <button type="button" className="underline" onClick={() => loadDashboardData()}>
                    Reintentar
                  </button>
                </div>
              ) : null}

              {!isImmersiveShell && nav === 'dashboard' ? (
                <MainDashboardView
                  onNavigate={navigateTo}
                  onOpenMarketplace={openMarketplace}
                  walletAddress={walletAddress}
                  accountFrozen={accountFrozen}
                  holdingPct={holdingPctAig}
                  minHoldingPct={minHoldingPct}
                  userHasActiveStaking={userHasActiveStaking}
                  referralActive={referralActive}
                  userEconomicallyActive={userEconomicallyActive}
                  onGoToWallet={onGoToWallet}
                  canViewEarnings={Boolean(uiPermissions?.canViewEarnings)}
                />
              ) : null}

              {nav === 'mining' ? (
                <MiningCoreSystem
                  hideNonWalletFinancialActions={
                    Boolean(hasSession && uiPermissions && !uiPermissions.canExecuteActions)
                  }
                  onGoToWallet={onGoToWallet}
                  onActivatePurchase={openPaymentFlow ? () => openPaymentFlow('mining') : undefined}
                  onOpenMiningWarning={onOpenMiningWarning}
                />
              ) : null}

              {nav === 'booster' ? (
                <BoosterPage
                  onInject={openPaymentFlow ? () => openPaymentFlow('booster') : openPurchase}
                  hideNonWalletFinancialActions={
                    Boolean(hasSession && uiPermissions && !uiPermissions.canExecuteActions)
                  }
                  onGoToWallet={onGoToWallet}
                />
              ) : null}

              {nav === 'staking' ? (
                <StakingPage
                  onStake={openPaymentFlow ? () => openPaymentFlow('staking') : openPurchase}
                  onWithdraw={onGoToWallet}
                  hideNonWalletFinancialActions={
                    Boolean(hasSession && uiPermissions && !uiPermissions.canExecuteActions)
                  }
                  onGoToWallet={onGoToWallet}
                  economy={stakingEconomy}
                />
              ) : null}

              {nav === 'wallet' ? (
                <GenesisWalletPage
                  hasSession={hasSession}
                  showSkeleton={Boolean(hasSession && loading && !walletLoaded)}
                  ledgerNetUsdt={ledgerNet}
                  directClaimUsdt={directClaim}
                  leftPts={leftPts}
                  rightPts={rightPts}
                  totalUsdtAccumMining={miningUsdtAccum}
                  aigBalanceDisplay={aigDisplay}
                  claimAllBusy={claimAllBusy || Boolean(claimLoading)}
                  claimDisabled={
                    !hasSession ||
                    !userEconomicallyActive ||
                    ledgerNet < minProtocolHoldingUsdt ||
                    accountFrozen ||
                    Boolean(uiPermissions && !uiPermissions.canExecuteActions)
                  }
                  accountFrozen={accountFrozen}
                  userEconomicallyActive={userEconomicallyActive}
                  centralRewardBalanceAig={centralRewardBalanceAig}
                  onClaimAll={claimAllFromDashboard}
                  onWithdraw={onOpenWithdraw ?? (() => {})}
                />
              ) : null}

              {nav === 'history' ? <LedgerPage /> : null}

              {nav === 'network' ? (
                <CommunityPage canViewFullNetwork={uiPermissions?.canViewFullNetwork !== false} />
              ) : null}

              {nav === 'profile' ? (
                <GenesisProfilePage
                  walletAddress={walletAddress}
                  hasSession={hasSession}
                  canEditProfile={Boolean(uiPermissions?.canEditProfile)}
                />
              ) : null}

              {nav === 'support' ? <GenesisSupportPage hasSession={hasSession} /> : null}

              {nav === 'promo' ? <GenesisPromoPage /> : null}

              {nav === 'p2p' ? <GenesisP2PMarketplacePage onNavigate={navigateTo} /> : null}

              {nav === 'topg' ? <GenesisTopGPage /> : null}

              {nav === 'nft' ? <GenesisNftPage onNavigate={navigateTo} /> : null}

              {!isImmersiveShell && hasSession && loading ? (
                <div className="flex justify-center py-4">
                  <AnimatedLoader label="Sincronizando datos" />
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
