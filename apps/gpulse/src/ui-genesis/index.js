/**
 * AiGenesis + G-Pulse design system (React + Tailwind + Framer Motion).
 *
 * Preview: set VITE_GENESIS_UI=1 and run `pnpm dev` in apps/gpulse.
 *
 * @example
 * import { GlassCard, GenesisDesignPreview } from './ui-genesis';
 */

export { LivingBackground } from './backgrounds/LivingBackground.jsx';
export { GlassCard } from './components/GlassCard.jsx';
export { GlassModal } from './components/GlassModal.jsx';
export { GradientButton } from './components/GradientButton.jsx';
export { NeonInput } from './components/NeonInput.jsx';
export { GlowBadge } from './components/GlowBadge.jsx';
export { AnimatedLoader } from './components/AnimatedLoader.jsx';
export { StatCard } from './components/StatCard.jsx';
export { SidebarItem } from './components/SidebarItem.jsx';
export { Topbar } from './components/Topbar.jsx';
export { GenesisChromeContextBar } from './components/GenesisChromeContextBar.jsx';
export {
  GpulseChromeButton,
  deriveGpulseNavVisualState,
  GPULSE_NAV_STATE,
} from './components/GpulseChromeButton.jsx';
export { GenesisNotificationCenter } from './components/GenesisNotificationCenter.jsx';
export { useGenesisNotificationStore } from './stores/genesisNotificationStore.js';
export {
  NotificationAction,
  NotificationPriority,
  NotificationType,
  NAV_BY_NOTIFICATION_ACTION,
  buildIntelligentNotificationFeed,
  buildUiNotificationsFromEngine,
  evaluateNotificationRules,
  mergeSimilarNotifications,
  mergeRealtimeNotifications,
  intelligentNotificationToUiItem,
  resolveNavId,
} from './notifications/notificationEngine.js';
export { AuthCard } from './components/AuthCard.jsx';
export { WalletConnectButton } from './components/WalletConnectButton.jsx';

export { DashboardSidebar } from './layout/DashboardSidebar.jsx';

export { GPulseStatusWidget } from './widgets/GPulseStatusWidget.jsx';
export { ActivityFeed } from './widgets/ActivityFeed.jsx';
export { ChatWidgetPlaceholder } from './widgets/ChatWidgetPlaceholder.jsx';

export { TermsAcceptanceModal } from './modals/TermsAcceptanceModal.jsx';
export { RulesDetailModal } from './modals/RulesDetailModal.jsx';
export { RuleHint } from './components/RuleHint.jsx';
export { useTermsAcceptanceStore } from './stores/termsAcceptanceStore.js';
export { useUiModeStore } from './stores/uiModeStore.js';
export { useSimulationModeStore } from './stores/simulationModeStore.js';
export { buildFullSimulationDataset, buildSimulationLedgerEvents, simulationJitter } from './simulation/buildSimulationDataset.js';
export {
  createGpulseOutcomeEngineState,
  advanceGpulseOutcome,
  drawGpulseOutcomeDemo,
} from './simulation/gpulseOutcomeEngine.js';
export { SimulationModeToggle } from './components/SimulationModeToggle.jsx';
export { UiModeToggle } from './components/UiModeToggle.jsx';

export { DisclaimerModal } from './modals/DisclaimerModal.jsx';
export { MiningWarningModal } from './modals/MiningWarningModal.jsx';
export { PurchaseModal } from './modals/PurchaseModal.jsx';
export { PaymentFlowModal } from './modals/PaymentFlowModal.jsx';
export {
  PAYMENT_FLOW_PRODUCTS,
  computeTokenBreakdown,
  computeActivationPaymentPlan,
} from './payment/paymentFlowProducts.js';
export {
  getAigPriceUsd,
  usdEquivalentFromDualLegs,
  totalAigVolumeUnits,
  aigUnitsForFullUsdPayment,
  usdValueOfAig,
  assertDualPlanCoversPrice,
} from './payment/dualTokenPayment.js';
export {
  PAYMENT_MODULE_RULES,
  normalizePaymentModule,
  catalogCategoryToModule,
  validateLegsSumMatchesPrice,
  getPaymentSplit,
} from './payment/paymentRuleEngine.js';
export {
  getAigPrice,
  usdToAig,
  aigToUsd,
  validateUsdEquivalence,
  assertPaymentMatchesPrice,
  PRICING_EPS,
} from '../utils/pricing.js';
export { executeDualTokenPayment } from '../utils/dualTokenExecution.js';
export { usePaymentLedgerStore } from './stores/paymentLedgerStore.js';
export { useMerchantDebtStore } from './stores/merchantDebtStore.js';
export { useHybridRetentionStore, selectRetentionProcessing } from './stores/hybridRetentionStore.js';
export { HybridFintechPanel } from './components/HybridFintechPanel.jsx';
export { useGpulseMembershipStore } from './stores/gpulseMembershipStore.js';
export { WithdrawModal } from './modals/WithdrawModal.jsx';
export { ProcessingModal } from './modals/ProcessingModal.jsx';
export { SuccessModal } from './modals/SuccessModal.jsx';
export { ErrorModal } from './modals/ErrorModal.jsx';

export { LoginPage } from './pages/LoginPage.jsx';
export { RegisterPage } from './pages/RegisterPage.jsx';
export { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
export { GenesisDashboardPage } from './pages/GenesisDashboardPage.jsx';
export { GenesisLobby } from './pages/GenesisLobby.jsx';
export { GenesisLobbyPage } from './pages/GenesisLobbyPage.jsx';
export { AdminCorePanelPage } from './pages/AdminCorePanelPage.jsx';
export { AdminCoreApp, ADMIN_APP_RETURN_PATH } from './AdminCoreApp.jsx';
export { AdminCoreLayout } from './layout/AdminCoreLayout.jsx';
export { AdminLayout, AdminPanelRouter, AdminProvider, useAdmin } from '../modules/admin/index.js';
export { useAdminPanelStore } from './stores/adminPanelStore.js';
export { ADMIN_NAV_SECTIONS, ADMIN_MODULE_IDS } from './admin/adminNavConfig.js';

export { GenesisDesignPreview } from './GenesisDesignPreview.jsx';

export * as genesisMotion from './motion/variants.js';

export {
  getApiBaseUrl,
  getBackendBaseUrl,
  getTxExplorerUrl,
  getMasterWalletAddress,
  getDevMockBearer,
} from './api/genesisConfig.js';
export {
  fetchWallet,
  fetchEarnings,
  fetchNetwork,
  postClaim,
  fetchP2POrderbook,
  fetchP2PMyOrders,
  createP2POrder,
  cancelP2POrder,
  takeP2POrder,
  postWalletTransfer,
  postWalletWithdraw,
  fetchLedger,
} from './api/genesisApi.js';
export { safeFetch } from './api/safeFetch.js';
export { FALLBACK_WALLET, FALLBACK_EARNINGS, FALLBACK_NETWORK } from './api/dashboardFallbacks.js';
export {
  fetchCompensationWallet,
  fetchCompensationEarnings,
  fetchCompensationNetwork,
  postCompensationClaim,
  walletLoginWithSigner,
} from './api/compensationClient.js';
export { executeNativeDeposit } from './api/depositFlow.js';
export { useGenesisDashboardStore } from './stores/genesisDashboardStore.js';
export { useGenesisRealtime } from './hooks/useGenesisRealtime.js';
export { useGenesisPolling } from './hooks/useGenesisPolling.js';
export { useGenesisWebSocketPlaceholder } from './hooks/useGenesisWebSocketPlaceholder.js';
export { GenesisToast } from './components/GenesisToast.jsx';
export { ProtocolDisclaimer } from './components/ProtocolDisclaimer.jsx';
export { MiningCoreSystem } from './components/MiningCoreSystem.jsx';
export { MiningCoreCard } from './components/MiningCoreCard.jsx';
export { StatCardSkeleton } from './components/StatCardSkeleton.jsx';
export { AIDecisionCard } from './components/AIDecisionCard.jsx';
export { getAIDecision, buildAIDecisionInputFromCore, inferActivityFromCore } from './core/AIDecisionEngine.js';
export { GenesisAuthBar } from './components/GenesisAuthBar.jsx';
export { GenesisErrorBoundary } from './components/GenesisErrorBoundary.jsx';
