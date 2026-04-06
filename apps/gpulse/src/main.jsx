import { Buffer } from 'buffer';
window.Buffer = Buffer;

import { installMockInjectedProviderIsolation } from './utils/mockInjectedIsolation.js';
import { publishWeb3ModeToWindow } from './core/web3/web3Core.js';

installMockInjectedProviderIsolation();
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import MockWeb3DevPanel from './components/MockWeb3DevPanel.jsx';
import { WalletProvider } from './context/WalletContext.jsx';
import { installBackofficeAuthSync } from './bridge/backofficeAuthSync.ts';
import { getApiBaseUrl } from './ui-genesis/api/genesisConfig.js';
import { GenesisErrorBoundary } from './ui-genesis/components/GenesisErrorBoundary.jsx';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

/** Relative path from this file (`src/main.jsx`) — required for stable Vite dynamic chunks */
const GenesisDesignPreview = lazy(() => import('./ui-genesis/GenesisDesignPreview.jsx'));
const MarketplacePage = lazy(() => import('./ui-genesis/pages/MarketplacePage.jsx'));
const LocalMarketplacePage = lazy(() => import('./ui-genesis/pages/LocalMarketplacePage.jsx'));
const MerchantDashboardPage = lazy(() => import('./ui-genesis/pages/MerchantDashboardPage.jsx'));
const AdminCoreApp = lazy(() =>
  import('./ui-genesis/AdminCoreApp.jsx').then((m) => ({ default: m.AdminCoreApp })),
);
const OnboardingRegisterPreviewPage = lazy(() => import('./ui-genesis/pages/OnboardingRegisterPreviewPage.jsx'));
const OnboardingInvitePage = lazy(() => import('./ui-genesis/onboarding/OnboardingInvitePage.jsx'));

/** Health check route (see `AppRoutes`). */
function PingRoute() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 font-mono text-base text-emerald-400">Frontend running 🚀</div>;
}

function MainShell() {
  const genesisUi = import.meta.env.VITE_GENESIS_UI === '1';
  return (
    <GenesisErrorBoundary>
      <WalletProvider>
        {genesisUi ? (
          <Suspense
            fallback={
              <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 font-display text-cyan-200">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
                <p>Loading AiGenesis UI…</p>
                <p className="max-w-sm text-center text-xs text-slate-500">
                  Set <code className="text-cyan-600">VITE_GENESIS_UI=1</code> in{' '}
                  <code className="text-cyan-600">apps/gpulse/.env</code>, then from repo root:{' '}
                  <code className="text-cyan-600">pnpm --filter @ai-genesis/gpulse dev</code>
                </p>
              </div>
            }
          >
            <GenesisDesignPreview />
          </Suspense>
        ) : (
          <>
            <App />
            {import.meta.env.VITE_HIDE_MOCK_WEB3_PANEL !== '1' ? <MockWeb3DevPanel /> : null}
          </>
        )}
      </WalletProvider>
    </GenesisErrorBoundary>
  );
}

function GpulseMainApp() {
  return (
    <GenesisErrorBoundary>
      <WalletProvider>
        <App />
        {import.meta.env.VITE_HIDE_MOCK_WEB3_PANEL !== '1' ? <MockWeb3DevPanel /> : null}
      </WalletProvider>
    </GenesisErrorBoundary>
  );
}

function GenesisMarketplaceShell() {
  return (
    <GenesisErrorBoundary>
      <WalletProvider>
        <Suspense
          fallback={
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 font-display text-cyan-200">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
              <p className="text-sm">Loading marketplace…</p>
            </div>
          }
        >
          <MarketplacePage />
        </Suspense>
      </WalletProvider>
    </GenesisErrorBoundary>
  );
}

function LocalMarketplaceShell() {
  return (
    <GenesisErrorBoundary>
      <WalletProvider>
        <Suspense
          fallback={
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 font-display text-cyan-200">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
              <p className="text-sm">Loading local marketplace…</p>
            </div>
          }
        >
          <LocalMarketplacePage />
        </Suspense>
      </WalletProvider>
    </GenesisErrorBoundary>
  );
}

function MerchantOnboardingShell() {
  return (
    <GenesisErrorBoundary>
      <WalletProvider>
        <Suspense
          fallback={
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 font-display text-cyan-200">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
              <p className="text-sm">Loading merchant hub…</p>
            </div>
          }
        >
          <MerchantDashboardPage />
        </Suspense>
      </WalletProvider>
    </GenesisErrorBoundary>
  );
}

function AdminCoreShell() {
  return (
    <GenesisErrorBoundary>
      <WalletProvider>
        <Suspense
          fallback={
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 font-display text-amber-200/90">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
              <p className="text-sm">Loading Admin Core…</p>
            </div>
          }
        >
          <AdminCoreApp />
        </Suspense>
      </WalletProvider>
    </GenesisErrorBoundary>
  );
}

function RegisterPreviewShell() {
  return (
    <GenesisErrorBoundary>
      <WalletProvider>
        <Suspense
          fallback={
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 font-display text-orange-200/90">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-400/30 border-t-orange-400" />
              <p className="text-sm">Cargando onboarding…</p>
            </div>
          }
        >
          <OnboardingRegisterPreviewPage />
        </Suspense>
      </WalletProvider>
    </GenesisErrorBoundary>
  );
}

function OnboardingInviteShell() {
  return (
    <GenesisErrorBoundary>
      <WalletProvider>
        <Suspense
          fallback={
            <div
              className="flex min-h-screen flex-col items-center justify-center gap-3 font-display text-cyan-200/90"
              style={{ backgroundColor: '#0b0f1a' }}
            >
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
              <p className="text-sm tracking-wide">AiGenesis · Invitación…</p>
            </div>
          }
        >
          <OnboardingInvitePage />
        </Suspense>
      </WalletProvider>
    </GenesisErrorBoundary>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/ping" element={<PingRoute />} />
      <Route path="/gpulse" element={<GpulseMainApp />} />
      <Route path="/marketplace" element={<GenesisMarketplaceShell />} />
      <Route path="/marketplace/local" element={<LocalMarketplaceShell />} />
      <Route path="/marketplace/merchant" element={<MerchantOnboardingShell />} />
      <Route path="/admin" element={<AdminCoreShell />} />
      <Route path="/admin-core/*" element={<AdminCoreShell />} />
      <Route path="/register" element={<RegisterPreviewShell />} />
      <Route path="/onboarding" element={<OnboardingInviteShell />} />
      <Route path="*" element={<MainShell />} />
    </Routes>
  );
}

function Root() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

if (import.meta.env.DEV && import.meta.env.VITE_VERBOSE_BOOT === '1') {
  const base = getApiBaseUrl();
  console.debug('API BASE:', base || '(empty — dev proxy /api → :5050)');
}
installBackofficeAuthSync();
publishWeb3ModeToWindow();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found — check index.html');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
