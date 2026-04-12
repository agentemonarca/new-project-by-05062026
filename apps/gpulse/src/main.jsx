import { Buffer } from 'buffer';
window.Buffer = Buffer;

import { installMockInjectedProviderIsolation } from './utils/mockInjectedIsolation.js';
import { publishWeb3ModeToWindow } from './core/web3/web3Core.js';
import { isWeb3MockMode } from './utils/web3Mode.js';

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
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AdminLoginPage } from './modules/admin/pages/AdminLoginPage.jsx';
import { AdminRoute } from './modules/admin/AdminRoute.jsx';
import { AdminProtectedShell, AdminPanelWithNav } from './ui-genesis/AdminCoreApp.jsx';
import { SignalsControlPage } from './modules/admin/pages/SignalsControlPage.jsx';
import { LEGACY_DASHBOARD_PATH_REDIRECTS } from './ui-genesis/navigation/genesisPaths.js';

/** Relative path from this file (`src/main.jsx`) — required for stable Vite dynamic chunks */
const GenesisDesignPreview = lazy(() => import('./ui-genesis/GenesisDesignPreview.jsx'));
const MarketplacePage = lazy(() => import('./ui-genesis/pages/MarketplacePage.jsx'));
const LocalMarketplacePage = lazy(() => import('./ui-genesis/pages/LocalMarketplacePage.jsx'));
const MerchantDashboardPage = lazy(() => import('./ui-genesis/pages/MerchantDashboardPage.jsx'));
const OnboardingRegisterPreviewPage = lazy(() => import('./ui-genesis/pages/OnboardingRegisterPreviewPage.jsx'));
const OnboardingInvitePage = lazy(() => import('./ui-genesis/onboarding/OnboardingInvitePage.jsx'));
const GenesisDashboardPage = lazy(() =>
  import('./ui-genesis/pages/GenesisDashboardPage.jsx').then((m) => ({ default: m.GenesisDashboardPage })),
);

/** Health check route (see `AppRoutes`). */
function PingRoute() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 font-mono text-base text-emerald-400">Frontend running 🚀</div>;
}

/** Evita pantalla en blanco si el árbol principal lanza antes de montar (muestra mensaje + enlaces útiles). */
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    console.error('[gpulse:root]', err, info?.componentStack);
  }

  render() {
    if (this.state.err) {
      const msg = String(this.state.err?.message || this.state.err);
      return (
        <div
          className="min-h-[100dvh] bg-[#020008] px-6 py-10 font-sans text-rose-200"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          <h1 className="text-lg font-semibold text-white">Error al cargar G-Pulse</h1>
          <pre className="mt-4 max-w-2xl whitespace-pre-wrap break-words text-sm text-slate-400">{msg}</pre>
          <p className="mt-6 text-sm text-slate-500">
            Revisa la consola (F12). Rutas de prueba:{' '}
            <a className="text-cyan-400 underline" href="/ping">
              /ping
            </a>
            {' · '}
            <a className="text-cyan-400 underline" href="/dashboard">
              /dashboard
            </a>
            {' · '}
            <a className="text-cyan-400 underline" href="/gpulse">
              /gpulse
            </a>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
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
            {isWeb3MockMode() && import.meta.env.VITE_HIDE_MOCK_WEB3_PANEL !== '1' ? <MockWeb3DevPanel /> : null}
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
        {isWeb3MockMode() && import.meta.env.VITE_HIDE_MOCK_WEB3_PANEL !== '1' ? <MockWeb3DevPanel /> : null}
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
          <Outlet />
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

function GenesisDashboardShell() {
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
              <p className="text-sm tracking-wide">AiGenesis · Dashboard…</p>
            </div>
          }
        >
          <GenesisDashboardPage />
        </Suspense>
      </WalletProvider>
    </GenesisErrorBoundary>
  );
}

/**
 * Entrada por `/`:
 * - `VITE_GENESIS_BACKOFFICE_HOME=1` → Command Center (`/admin`, todas las páginas bajo `/admin/:modulo`)
 * - si no, `VITE_GENESIS_DASHBOARD_HOME=1` → AiGenesis Dashboard (`/dashboard`)
 * - si no, shell G-Pulse en `/` y también `/gpulse`
 */
const GENESIS_BACKOFFICE_HOME = String(import.meta.env.VITE_GENESIS_BACKOFFICE_HOME ?? '').trim() === '1';
const GENESIS_DASHBOARD_HOME = String(import.meta.env.VITE_GENESIS_DASHBOARD_HOME ?? '').trim() === '1';

function RootHome() {
  if (GENESIS_BACKOFFICE_HOME) return <Navigate to="/admin" replace />;
  if (GENESIS_DASHBOARD_HOME) return <Navigate to="/dashboard" replace />;
  return <MainShell />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/ping" element={<PingRoute />} />
      <Route path="/gpulse" element={<GpulseMainApp />} />
      {/* Alias al backoffice Genesis (mismas rutas que `/admin` · login en `/admin/login`) */}
      <Route path="/backoffice" element={<Navigate to="/admin" replace />} />
      <Route path="/genesis-admin" element={<Navigate to="/admin" replace />} />
      <Route path="/marketplace" element={<GenesisMarketplaceShell />} />
      <Route path="/marketplace/local" element={<LocalMarketplaceShell />} />
      <Route path="/marketplace/merchant" element={<MerchantOnboardingShell />} />
      <Route path="/admin" element={<AdminCoreShell />}>
        <Route path="login" element={<AdminLoginPage />} />
        <Route element={<AdminRoute />}>
          <Route element={<AdminProtectedShell />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="signals" element={<SignalsControlPage />} />
            <Route path="settings" element={<Navigate to="../config" replace />} />
            <Route path="*" element={<AdminPanelWithNav />} />
          </Route>
        </Route>
      </Route>
      <Route path="/admin-core" element={<AdminCoreShell />}>
        <Route path="login" element={<AdminLoginPage />} />
        <Route element={<AdminRoute />}>
          <Route element={<AdminProtectedShell />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="signals" element={<SignalsControlPage />} />
            <Route path="settings" element={<Navigate to="../config" replace />} />
            <Route path="*" element={<AdminPanelWithNav />} />
          </Route>
        </Route>
      </Route>
      <Route path="/register" element={<RegisterPreviewShell />} />
      <Route path="/onboarding" element={<OnboardingInviteShell />} />
      <Route path="/dashboard" element={<GenesisDashboardShell />} />
      {LEGACY_DASHBOARD_PATH_REDIRECTS.map(([path, nav]) => (
        <Route key={path} path={path} element={<Navigate to={`/dashboard?nav=${encodeURIComponent(nav)}`} replace />} />
      ))}
      <Route path="/genesis-lobby" element={<Navigate to="/dashboard?nav=genesis-lobby" replace />} />
      <Route path="/gpulse-lobby" element={<Navigate to="/dashboard?nav=gpulse-lobby" replace />} />
      {/* Explícito: en algunos despliegues el comodín `*` no dejaba resuelta la raíz correctamente. */}
      <Route path="/" element={<RootHome />} />
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
    <RootErrorBoundary>
      <Root />
    </RootErrorBoundary>
  </React.StrictMode>,
);
