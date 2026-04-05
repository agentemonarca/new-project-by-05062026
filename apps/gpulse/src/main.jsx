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

/** Relative path from this file (`src/main.jsx`) — required for stable Vite dynamic chunks */
const GenesisDesignPreview = lazy(() => import('./ui-genesis/GenesisDesignPreview.jsx'));
const MarketplacePage = lazy(() => import('./ui-genesis/pages/MarketplacePage.jsx'));
const LocalMarketplacePage = lazy(() => import('./ui-genesis/pages/LocalMarketplacePage.jsx'));
const AdminCoreApp = lazy(() =>
  import('./ui-genesis/AdminCoreApp.jsx').then((m) => ({ default: m.AdminCoreApp })),
);

/** Isolated admin control plane (`/admin`, `/admin-core`, `/admin-core/...`). */
function isAdminCorePath(pathname) {
  const p = (pathname || '/').replace(/\/$/, '') || '/';
  return p === '/admin' || p === '/admin-core' || p.startsWith('/admin-core/');
}

/** Same idea as `<Route path="/ping" element={...} />` — no extra router dep (monorepo uses `workspace:*`). */
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

function Root() {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    if (path === '/ping') return <PingRoute />;
    /** Main G-Pulse shell (full app) — linked from Genesis dashboard CTA */
    if (path === '/gpulse') return <GpulseMainApp />;
    /** Genesis marketplace (mock catalog; API later) */
    if (path === '/marketplace') return <GenesisMarketplaceShell />;
    /** Geolocation merchants — map + list (demo data; API later) */
    if (path === '/marketplace/local') return <LocalMarketplaceShell />;
    /** Admin Core — separate from user Genesis shell */
    if (isAdminCorePath(path)) return <AdminCoreShell />;
  }
  return <MainShell />;
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
