import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LivingBackground } from '../backgrounds/LivingBackground.jsx';
import { HologramBackground } from '../backgrounds/HologramBackground.jsx';
import { ChatWidgetPlaceholder } from '../widgets/ChatWidgetPlaceholder.jsx';
import { CoreProvider } from '../core/CoreContext.jsx';
import { LedgerProvider } from '../ledger/LedgerContext.jsx';
import { useMiningCores } from '../hooks/useMiningCores.js';
import { HologramEntity } from '../components/HologramEntity.jsx';
import { GenesisToast } from '../components/GenesisToast.jsx';
import { SuccessModal } from '../modals/SuccessModal.jsx';
import { ErrorModal } from '../modals/ErrorModal.jsx';
import { PurchaseModal } from '../modals/PurchaseModal.jsx';
import { ProcessingModal } from '../modals/ProcessingModal.jsx';
import { fadeUpBlur } from '../motion/variants.js';
import { pathToNav, navToPath, normalizeGenesisNav } from '../navigation/genesisPaths.js';
import { GenesisDashboardLayout } from './GenesisDashboardLayout.jsx';
import { useGenesisDashboardStore } from '../stores/genesisDashboardStore.js';
import { useGenesisRealtime } from '../hooks/useGenesisRealtime.js';
import { useGenesisPolling } from '../hooks/useGenesisPolling.js';
import { useGenesisWebSocketPlaceholder } from '../hooks/useGenesisWebSocketPlaceholder.js';
import { getTxExplorerUrl, getDevMockBearer } from '../api/genesisConfig.js';
import { useWallet } from '../../context/WalletContext.jsx';
import { useRuntimeTrace } from '../../utils/runtimeDiagnostics.js';
import { useGenesisEconomy } from '../hooks/useGenesisEconomy.js';
import { useBinaryEngineStore } from '../binary/binaryEngineStore.js';
import { TermsAcceptanceModal } from '../modals/TermsAcceptanceModal.jsx';
import { MiningWarningModal } from '../modals/MiningWarningModal.jsx';
import { PaymentFlowModal } from '../modals/PaymentFlowModal.jsx';
import { useTermsAcceptanceStore } from '../stores/termsAcceptanceStore.js';
import { usePaymentLedgerStore } from '../stores/paymentLedgerStore.js';
import { useGpulseMembershipStore } from '../stores/gpulseMembershipStore.js';
import { useSimulationModeStore } from '../stores/simulationModeStore.js';
import { useStakingEngineStore } from '../stores/stakingEngineStore.js';
import { buildFullSimulationDataset } from '../simulation/buildSimulationDataset.js';
import { useAigPrice, AigPriceContext } from '@/hooks/useAigPrice.js';
import { useUSDValue } from '@/hooks/useUsdValue.js';
import { usdToAig } from '../../utils/pricing.js';

const SHOW_HOLOGRAM = false;

/** Ledger net (USDT) required to unlock claims + live system actions on the main dashboard. */
const MIN_PROTOCOL_HOLDING_USDT = 50;
/** AIG share of (AIG + ledger USDT) below this ⇒ account treated as frozen (UX gate). */
const MIN_AIG_HOLDING_PCT = 7;

const TOPBAR_COPY = {
  dashboard: { title: 'Inicio', subtitle: 'Vista unificada del protocolo' },
  mining: { title: 'Minería', subtitle: 'Motores del protocolo' },
  booster: { title: 'AiG Booster', subtitle: 'Aceleración' },
  staking: { title: 'Staking', subtitle: 'Participación bloqueada' },
  network: { title: 'Red Binaria', subtitle: 'Volumen y referidos' },
  marketplace: { title: 'Marketplace', subtitle: 'Listados y AIG' },
  gpulse: { title: 'GPulse Oracle', subtitle: 'Shell principal' },
  'gpulse-lobby': { title: 'GPulse Oracle', subtitle: 'Lobby predictivo' },
  'genesis-lobby': { title: 'Genesis Lobby', subtitle: 'Núcleo del ecosistema' },
  wallet: { title: 'Portfolio', subtitle: 'Balances y actividad del protocolo' },
  profile: { title: 'Perfil', subtitle: 'Cuenta y sesión' },
  history: { title: 'Historial operativo', subtitle: 'Explorador financiero' },
  support: { title: 'Soporte VIP', subtitle: 'Tickets y asistencia prioritaria' },
  promo: { title: 'Promo', subtitle: 'Campañas y beneficios' },
  p2p: { title: 'P2P', subtitle: 'Intercambio entre pares' },
  topg: { title: 'Top G', subtitle: 'Ranking y reconocimiento' },
  nft: { title: 'NFT', subtitle: 'Hub y enlaces a protocolo' },
};

/** Premium dashboard mock when API / session not loaded */
const MOCK_FINANCE = {
  aigBalance: 8820,
};

export function GenesisDashboardPage({
  onOpenPurchase: onOpenPurchaseProp,
  onOpenWithdraw,
  onOpenMiningWarning,
  enableRealtime = true,
  enablePolling = true,
  simulateDeposit = import.meta.env.VITE_SIMULATE_DEPOSIT === '1',
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [nav, setNav] = useState(() => {
    if (typeof window === 'undefined') return 'genesis-lobby';
    if (import.meta.env.VITE_GENESIS_INITIAL_NAV) {
      return normalizeGenesisNav(import.meta.env.VITE_GENESIS_INITIAL_NAV);
    }
    return pathToNav(window.location.pathname);
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [paymentFlowProduct, setPaymentFlowProduct] = useState(
    /** @type {null | 'booster' | 'mining' | 'gpulse'} */ (null),
  );

  const { address: walletAddress, expectedChainId } = useWallet();

  const authToken = useGenesisDashboardStore((s) => s.authToken);
  const sessionAuth = useGenesisDashboardStore((s) => s.sessionAuth);
  const wallet = useGenesisDashboardStore((s) => s.wallet);
  const network = useGenesisDashboardStore((s) => s.network);
  const loading = useGenesisDashboardStore((s) => s.loading);
  const storeError = useGenesisDashboardStore((s) => s.error);
  const claimLoading = useGenesisDashboardStore((s) => s.claimLoading);
  const depositLoading = useGenesisDashboardStore((s) => s.depositLoading);
  const loadDashboardData = useGenesisDashboardStore((s) => s.loadDashboardData);
  const claim = useGenesisDashboardStore((s) => s.claim);
  const deposit = useGenesisDashboardStore((s) => s.deposit);
  const simulateDepositFn = useGenesisDashboardStore((s) => s.simulateDeposit);

  const [successOpen, setSuccessOpen] = useState(false);
  const [successMeta, setSuccessMeta] = useState({ message: '', txHash: null, explorerUrl: null });
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const mockBearer = getDevMockBearer();
  const hasSession = Boolean(authToken || mockBearer || sessionAuth);
  const isSimulationMode = useSimulationModeStore((s) => s.isSimulationMode);
  const [simNoiseTick, setSimNoiseTick] = useState(0);

  useEffect(() => {
    if (!isSimulationMode) return undefined;
    const id = window.setInterval(() => setSimNoiseTick((n) => n + 1), 48000);
    return () => clearInterval(id);
  }, [isSimulationMode]);

  const simulationDataset = useMemo(
    () => (isSimulationMode ? buildFullSimulationDataset(0.04) : null),
    [isSimulationMode, simNoiseTick],
  );

  const effectiveHasSession = hasSession || isSimulationMode;
  const effectiveWallet = simulationDataset?.wallet ?? wallet;
  const effectiveNetwork = simulationDataset?.network ?? network;

  const acceptedTerms = useTermsAcceptanceStore((s) => s.acceptedTerms);
  const needsTermsAcceptance = Boolean(hasSession && !acceptedTerms && !isSimulationMode);
  const [miningWarningOpen, setMiningWarningOpen] = useState(false);
  const openMiningWarning = useCallback(() => {
    setMiningWarningOpen(true);
    onOpenMiningWarning?.();
  }, [onOpenMiningWarning]);

  const miningLive = useMiningCores({ claim, hasSession: effectiveHasSession });
  const mining = useMemo(
    () => ({
      cores: miningLive.cores,
      totalPower: miningLive.summary.totalRatePerSecond,
      totalAccumulated: miningLive.summary.totalAccumulated,
      totalGeneration: miningLive.summary.totalGeneration,
      claimCore: miningLive.claimCore,
      claimingId: miningLive.claimingId,
    }),
    [
      miningLive.cores,
      miningLive.summary.totalAccumulated,
      miningLive.summary.totalGeneration,
      miningLive.summary.totalRatePerSecond,
      miningLive.claimCore,
      miningLive.claimingId,
    ],
  );

  const onPaymentFlowComplete = useCallback(
    (detail) => {
      useBinaryEngineStore.getState().applyPurchaseBinaryVolume(detail.binaryVolumePts, { product: detail.product });
      usePaymentLedgerStore.getState().appendActivation(detail);
      miningLive.applyProductActivation({ product: detail.product, totalUsdtEq: detail.totalUsdtEquivalent });
      if (detail.product === 'gpulse') {
        useGpulseMembershipStore.getState().activate();
      }
      loadDashboardData().catch(() => {});
      setToastMessage('Activación completada.');
      setToastOpen(true);
    },
    [miningLive.applyProductActivation, loadDashboardData],
  );

  useGenesisRealtime(Boolean(enableRealtime && hasSession && !isSimulationMode));
  useGenesisPolling(Boolean(enablePolling && hasSession && !isSimulationMode), 5000);
  useGenesisWebSocketPlaceholder(false);

  useEffect(() => {
    if (!hasSession) return undefined;
    loadDashboardData().catch(() => {});
    return undefined;
  }, [hasSession, authToken, mockBearer, sessionAuth, loadDashboardData]);

  const directClaim = Number(effectiveWallet?.directClaimableUsdt ?? 0);
  const ledgerNet = Number(effectiveWallet?.ledgerNetUsdt ?? 0);
  const leftPts = effectiveNetwork?.leftMonth ?? 0;
  const rightPts = effectiveNetwork?.rightMonth ?? 0;

  const ingestApiUpdate = useBinaryEngineStore((s) => s.ingestApiUpdate);
  useEffect(() => {
    if (!effectiveHasSession) return;
    ingestApiUpdate(leftPts, rightPts);
  }, [effectiveHasSession, leftPts, rightPts, ingestApiUpdate]);

  useEffect(() => {
    if (!isSimulationMode) {
      useStakingEngineStore.setState((s) => ({
        activeEngineStakings: s.activeEngineStakings.filter((r) => !String(r.id).startsWith('sim-engine-')),
      }));
      return;
    }
    useStakingEngineStore.setState((s) => {
      if (s.activeEngineStakings.some((r) => String(r.id).startsWith('sim-engine-'))) return s;
      return {
        activeEngineStakings: [
          ...s.activeEngineStakings,
          {
            id: 'sim-engine-m6',
            planId: 'm6',
            planLabel: '6m · sim',
            investedUsdt: 12000,
            rewardsUsdt: Math.round(simulationDataset?.stakingDailyUsdt ?? 45),
            endsAt: Date.now() + 120 * 86400000,
            claimed: false,
          },
        ],
      };
    });
  }, [isSimulationMode, simulationDataset?.stakingDailyUsdt]);

  const [claimAllBusy, setClaimAllBusy] = useState(false);

  useRuntimeTrace(
    'GenesisDashboardPage',
    () => ({
      nav,
      hasSession,
      loading,
      storeError: storeError ?? null,
      coresLen: mining?.cores?.length ?? 0,
      claimAllBusy,
      ledgerNet,
      address: walletAddress ?? null,
    }),
    [nav, hasSession, loading, storeError, mining?.cores?.length, claimAllBusy, ledgerNet, walletAddress],
  );

  const openPurchase = useCallback(() => {
    if (onOpenPurchaseProp) onOpenPurchaseProp();
    else setPurchaseOpen(true);
  }, [onOpenPurchaseProp]);

  const openPaymentFlow = useCallback((/** @type {'booster'|'mining'|'gpulse'|'staking'} */ product) => {
    setPaymentFlowProduct(product);
  }, []);

  const closePaymentFlow = useCallback(() => setPaymentFlowProduct(null), []);

  const navigateTo = useCallback(
    (next) => {
      const id = normalizeGenesisNav(next);
      setNav(id);
      navigate(navToPath(id));
    },
    [navigate],
  );

  const openMarketplace = useCallback(() => {
    navigate('/marketplace');
  }, [navigate]);

  useEffect(() => {
    if (import.meta.env.VITE_GENESIS_INITIAL_NAV) return;
    setNav(pathToNav(location.pathname));
  }, [location.pathname]);

  const runClaim = async (type) => {
    if (!hasSession) {
      setErrorMessage('Conecta tu wallet e inicia sesión API primero.');
      setErrorOpen(true);
      return;
    }
    try {
      const data = await claim(type);
      const tx = data?.txHash ?? null;
      setSuccessMeta({
        message:
          type === 'direct'
            ? 'Direct bonus rewards claimed.'
            : type === 'mining'
              ? 'Mining rewards claimed.'
              : 'Binary rewards claimed.',
        txHash: tx,
        explorerUrl: tx ? getTxExplorerUrl(tx) : null,
      });
      setSuccessOpen(true);
      setToastMessage(
        tx ? 'Claim rewards submitted — see transaction below.' : 'Claim rewards completed successfully.',
      );
      setToastOpen(true);
    } catch (e) {
      setErrorMessage(String(e?.message || e));
      setErrorOpen(true);
    }
  };

  const onPurchaseConfirm = async (payload) => {
    setPurchaseOpen(false);
    const amount = String(payload?.usdt || '').trim();
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage('Enter a valid amount');
      setErrorOpen(true);
      return;
    }
    try {
      if (simulateDeposit) {
        const { txHash } = await simulateDepositFn({ usdt: amount });
        setSuccessMeta({
          message: 'Simulated deposit complete.',
          txHash,
          explorerUrl: getTxExplorerUrl(txHash),
        });
        setSuccessOpen(true);
        setToastMessage('Simulated deposit successful.');
        setToastOpen(true);
        return;
      }
      if (!walletAddress) {
        setErrorMessage('Connect your wallet to deposit');
        setErrorOpen(true);
        return;
      }
      const { txHash } = await deposit({
        userAddress: walletAddress,
        amountEther: amount,
        expectedChainId: expectedChainId != null ? BigInt(expectedChainId) : undefined,
      });
      setSuccessMeta({
        message: 'Deposit verified and credited.',
        txHash,
        explorerUrl: getTxExplorerUrl(txHash),
      });
      setSuccessOpen(true);
      setToastMessage('Deposit successful.');
      setToastOpen(true);
    } catch (e) {
      setErrorMessage(String(e?.message || e));
      setErrorOpen(true);
    }
  };

  const showStatsSkeleton = Boolean(
    effectiveHasSession && loading && !effectiveWallet && !isSimulationMode,
  );
  const showFatalError = Boolean(
    hasSession && !loading && !wallet && storeError && !isSimulationMode,
  );

  const aigDisplay =
    isSimulationMode && simulationDataset != null
      ? simulationDataset.aigBalance
      : hasSession && wallet != null
        ? Math.max(0, directClaim + ledgerNet * 0.1)
        : MOCK_FINANCE.aigBalance;

  const portfolioDenAig = aigDisplay + ledgerNet;
  const holdingPctAig =
    effectiveHasSession && portfolioDenAig > 1e-9 ? (aigDisplay / portfolioDenAig) * 100 : 100;
  const accountFrozen =
    effectiveHasSession && portfolioDenAig > 1e-9 && holdingPctAig < MIN_AIG_HOLDING_PCT;
  const referralActive = effectiveHasSession && Boolean(effectiveWallet);

  const { userHasActiveStaking, userEconomicallyActive } = useGenesisEconomy({
    hasSession: effectiveHasSession,
    accountFrozen,
    miningCores: miningLive.cores,
  });

  const claimAllFromDashboard = useCallback(async () => {
    if (isSimulationMode) {
      setToastMessage('Simulación: claim desactivado (sin API real).');
      setToastOpen(true);
      return;
    }
    if (!hasSession || !userEconomicallyActive || ledgerNet < MIN_PROTOCOL_HOLDING_USDT) return;
    const threshold = 0.0001;
    setClaimAllBusy(true);
    try {
      for (const c of miningLive.cores) {
        if (c.accumulated > threshold) {
          await miningLive.claimCore(c);
        }
      }
      await Promise.allSettled([claim('mining'), claim('direct'), claim('binary')]);
      setToastMessage('Claim all completed.');
      setToastOpen(true);
    } catch (e) {
      setErrorMessage(String(e?.message || e));
      setErrorOpen(true);
    } finally {
      setClaimAllBusy(false);
    }
  }, [
    isSimulationMode,
    hasSession,
    userEconomicallyActive,
    ledgerNet,
    miningLive.cores,
    miningLive.claimCore,
    claim,
  ]);

  const miningUsdtAccum = useMemo(
    () =>
      miningLive.cores.filter((c) => c.type === 'mining').reduce((s, c) => s + c.accumulated, 0),
    [miningLive.cores],
  );

  const binaryTotal = leftPts + rightPts;

  const topbar = TOPBAR_COPY[nav] ?? TOPBAR_COPY['genesis-lobby'];
  const isGpulseLobby = nav === 'gpulse-lobby';
  const isGenesisLobby = nav === 'genesis-lobby';
  const isImmersiveShell = isGpulseLobby || isGenesisLobby;

  const aigTicker = useAigPrice();
  const aigUsdLobby = useUSDValue(aigDisplay);
  const totalLobbyBalanceUsd = useMemo(() => ledgerNet + aigUsdLobby, [ledgerNet, aigUsdLobby]);
  /** Central reward (AIG): protocol slice of AIG balance + 2% of ledger USDT converted at oracle (not a raw USDT×0.02 as AIG). */
  const centralRewardBalanceAig = useMemo(
    () =>
      effectiveHasSession
        ? Math.max(0, aigDisplay * 0.1 + usdToAig(Math.max(0, ledgerNet) * 0.02))
        : 0,
    [effectiveHasSession, aigDisplay, ledgerNet, aigTicker.price],
  );
  const miningInvestedTotal = useMemo(
    () =>
      miningLive.cores.filter((c) => c.type === 'mining').reduce((s, c) => s + (Number(c.contribution) || 0), 0),
    [miningLive.cores],
  );

  const networkForCore = useMemo(() => ({ leftPts, rightPts }), [leftPts, rightPts]);

  const claimUiForCore = useMemo(
    () => ({
      claimAllBusy: claimAllBusy || Boolean(claimLoading),
      onClaimAll: claimAllFromDashboard,
      minHoldingUsdt: MIN_PROTOCOL_HOLDING_USDT,
      ledgerNetUsdt: ledgerNet,
      directClaimUsdt: directClaim,
      accountFrozen,
    }),
    [claimAllBusy, claimLoading, claimAllFromDashboard, ledgerNet, directClaim, accountFrozen],
  );

  const walletHintsForCore = useMemo(() => ({ directClaimUsdt: directClaim }), [directClaim]);

  const shellForCore = useMemo(
    () => ({
      onNavigate: navigateTo,
      onOpenMarketplace: openMarketplace,
      onOpenPurchase: openPurchase,
    }),
    [navigateTo, openMarketplace, openPurchase],
  );

  const stakingEconomy = useMemo(
    () => ({
      userEconomicallyActive,
      userHasActiveStaking,
      accountFrozen,
      holdingPctAig,
    }),
    [userEconomicallyActive, userHasActiveStaking, accountFrozen, holdingPctAig],
  );

  return (
    <div className="relative isolate min-h-screen min-h-[100dvh] overflow-x-hidden font-display text-slate-200">
      {SHOW_HOLOGRAM && <HologramBackground />}
      <LivingBackground />
      {SHOW_HOLOGRAM && <HologramEntity />}
      <div className="relative z-[2] min-h-screen min-h-[100dvh]">
      {needsTermsAcceptance ? <TermsAcceptanceModal /> : null}
      <AigPriceContext.Provider value={aigTicker}>
      <CoreProvider
        mining={mining}
        network={networkForCore}
        aigBalance={aigDisplay}
        hasSession={effectiveHasSession}
        economicActive={!effectiveHasSession || userEconomicallyActive}
        claimUi={claimUiForCore}
        walletHints={walletHintsForCore}
        shell={shellForCore}
      >
        <LedgerProvider hasSession={effectiveHasSession}>
          {!needsTermsAcceptance ? (
            <GenesisDashboardLayout
              nav={nav}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              isSidebarCollapsed={isSidebarCollapsed}
              setIsSidebarCollapsed={setIsSidebarCollapsed}
              navigateTo={navigateTo}
              onOpenMiningWarning={openMiningWarning}
              onOpenWithdraw={onOpenWithdraw}
              hasSession={effectiveHasSession}
              isSimulationMode={isSimulationMode}
              topbarTitle={topbar.title}
              topbarSubtitle={topbar.subtitle}
              walletAddress={
                walletAddress ||
                (isSimulationMode ? '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' : null)
              }
              isImmersiveShell={isImmersiveShell}
              isGpulseLobby={isGpulseLobby}
              isGenesisLobby={isGenesisLobby}
              userEconomicallyActive={userEconomicallyActive}
              userHasActiveStaking={userHasActiveStaking}
              holdingPctAig={holdingPctAig}
              accountFrozen={accountFrozen}
              minHoldingPct={MIN_AIG_HOLDING_PCT}
              minProtocolHoldingUsdt={MIN_PROTOCOL_HOLDING_USDT}
              ledgerNet={ledgerNet}
              showFatalError={showFatalError}
              storeError={storeError}
              loadDashboardData={loadDashboardData}
              totalLobbyBalanceUsd={totalLobbyBalanceUsd}
              miningInvestedTotal={miningInvestedTotal}
              binaryTotal={binaryTotal}
              referralActive={referralActive}
              openPurchase={openPurchase}
              openPaymentFlow={openPaymentFlow}
              openMarketplace={openMarketplace}
              claimAllFromDashboard={claimAllFromDashboard}
              claimLoading={claimLoading}
              claimAllBusy={claimAllBusy}
              directClaim={directClaim}
              leftPts={leftPts}
              rightPts={rightPts}
              miningUsdtAccum={miningUsdtAccum}
              aigDisplay={aigDisplay}
              loading={loading}
              walletLoaded={Boolean(wallet || isSimulationMode)}
              stakingEconomy={stakingEconomy}
              centralRewardBalanceAig={centralRewardBalanceAig}
            />
          ) : null}
        </LedgerProvider>
      </CoreProvider>
      </AigPriceContext.Provider>
      {!needsTermsAcceptance && nav !== 'support' && nav !== 'gpulse-lobby' && nav !== 'genesis-lobby' ? (
        <ChatWidgetPlaceholder />
      ) : null}

      {!needsTermsAcceptance ? (
        <>
          <PurchaseModal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} onConfirm={onPurchaseConfirm} />
          <PaymentFlowModal
            open={paymentFlowProduct != null}
            productId={paymentFlowProduct || 'booster'}
            onClose={closePaymentFlow}
            onComplete={onPaymentFlowComplete}
            balanceUsdt={ledgerNet}
            balanceAig={aigDisplay}
            hasSession={effectiveHasSession}
            userEconomicallyActive={userEconomicallyActive}
            accountFrozen={accountFrozen}
            holdingPctAig={holdingPctAig}
            minHoldingPct={MIN_AIG_HOLDING_PCT}
          />
          <ProcessingModal open={depositLoading} />
          <MiningWarningModal
            open={miningWarningOpen}
            onClose={() => setMiningWarningOpen(false)}
            onConfirm={() => setMiningWarningOpen(false)}
          />
        </>
      ) : null}

      <GenesisToast open={toastOpen} message={toastMessage} onClose={() => setToastOpen(false)} />

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        message={successMeta.message}
        txHash={successMeta.txHash}
        explorerUrl={successMeta.explorerUrl}
      />
      <ErrorModal open={errorOpen} onClose={() => setErrorOpen(false)} message={errorMessage} />
      </div>
    </div>
  );
}
