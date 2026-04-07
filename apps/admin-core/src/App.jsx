import React, { Suspense, lazy, useCallback, useEffect, useMemo } from 'react';
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext.jsx';
import RequireAdminAuth from './components/RequireAdminAuth.jsx';
import { AdminLoginPage } from './pages/AdminLoginPage.jsx';
import { AdminSignalsPage } from './pages/AdminSignalsPage.jsx';
import { SignalLabPage } from './pages/SignalLabPage.jsx';
import { AdminCoreProvider, useAdminCore } from './context/AdminCoreContext.jsx';
import { AdminHeader } from './components/AdminHeader.jsx';
import { AdminSidebar } from './components/AdminSidebar.jsx';
import { ProjectSwitchSkeleton } from './components/ProjectSwitchSkeleton.jsx';
import { Loader2 } from 'lucide-react';

const GlobalOverviewModule = lazy(() =>
  import('./modules/global/GlobalOverviewModule.jsx').then((m) => ({ default: m.GlobalOverviewModule })),
);
const UsersModule = lazy(() =>
  import('./modules/users/UsersModule.jsx').then((m) => ({ default: m.UsersModule })),
);
const WalletModule = lazy(() =>
  import('./modules/wallet/WalletModule.jsx').then((m) => ({ default: m.WalletModule })),
);
const RewardsModule = lazy(() =>
  import('./modules/rewards/RewardsModule.jsx').then((m) => ({ default: m.RewardsModule })),
);
const P2PModule = lazy(() =>
  import('./modules/p2p/P2PModule.jsx').then((m) => ({ default: m.P2PModule })),
);
const SettingsModule = lazy(() =>
  import('./modules/settings/SettingsModule.jsx').then((m) => ({ default: m.SettingsModule })),
);
const EconomyModule = lazy(() =>
  import('./modules/economy/EconomyModule.jsx').then((m) => ({ default: m.EconomyModule })),
);
const SecurityModule = lazy(() =>
  import('./modules/security/SecurityModule.jsx').then((m) => ({ default: m.SecurityModule })),
);
const AnalyticsModule = lazy(() =>
  import('./modules/analytics/AnalyticsModule.jsx').then((m) => ({ default: m.AnalyticsModule })),
);
const NetworkModule = lazy(() =>
  import('./modules/network/NetworkModule.jsx').then((m) => ({ default: m.NetworkModule })),
);
const SecurityLogsPage = lazy(() =>
  import('./modules/audit/SecurityLogsPage.jsx').then((m) => ({ default: m.SecurityLogsPage })),
);

function SessionLoader() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#05080f]">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" aria-hidden />
        <p className="text-sm">Comprobando sesión…</p>
      </div>
    </div>
  );
}

/** Tras comprobar cookie `/me`, sin sesión → redirección forzada a login (sin UI de “no autorizado”). */
function ProtectedAdminOutlet() {
  return (
    <RequireAdminAuth>
      <AdminCoreProvider>
        <AdminShellLayout />
      </AdminCoreProvider>
    </RequireAdminAuth>
  );
}

function LoginRoute() {
  const { status, admin } = useAdminAuth();
  if (status !== 'ready') {
    return <SessionLoader />;
  }
  if (admin) {
    return <Navigate to="/admin/overview" replace />;
  }
  return <AdminLoginPage />;
}

function RootRedirect() {
  const { status, admin } = useAdminAuth();
  if (status !== 'ready') {
    return <SessionLoader />;
  }
  if (admin) {
    return <Navigate to="/admin/overview" replace />;
  }
  return <Navigate to="/admin/login" replace />;
}

function AdminShellLayout() {
  const {
    state,
    currentProject,
    currentProjectMeta,
    setCurrentProject,
    projectList,
    isSwitchingProject,
    adminMongoSource,
    setAdminMongoSource,
  } = useAdminCore();

  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[admin-core] Current route:', location.pathname);
    }
  }, [location.pathname]);

  const active = useMemo(() => {
    const seg = location.pathname.replace(/^\/admin\/?/, '').split('/')[0] || 'overview';
    return seg;
  }, [location.pathname]);

  const onProjectChange = useCallback(
    (id) => {
      if (!id) return;
      setCurrentProject(id);
    },
    [setCurrentProject],
  );

  const mobileTabs = useMemo(
    () => [
      { id: 'signals', label: 'Sig' },
      { id: 'signal-lab', label: 'Lab' },
      { id: 'overview', label: 'Ini' },
      { id: 'users', label: 'Usr' },
      { id: 'wallet', label: 'Wal' },
      { id: 'rewards', label: 'Rew' },
      { id: 'p2p', label: 'P2P' },
      { id: 'network', label: 'Net' },
      { id: 'economy', label: 'Eco' },
      { id: 'settings', label: 'Cfg' },
      { id: 'security', label: 'Sec' },
      { id: 'auditLogs', label: 'Log' },
      { id: 'analytics', label: 'KPI' },
    ],
    [],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AdminHeader
        title="AiGenesis Control Core"
        subtitle="Administración global · proyecto UI + base Mongo API (`?source=`)"
        projects={projectList}
        currentProject={currentProject}
        onProjectChange={onProjectChange}
        isSwitchingProject={isSwitchingProject}
        toast={state.ui.toast}
        adminMongoSource={adminMongoSource}
        onAdminMongoSourceChange={setAdminMongoSource}
      />

      <div className="flex min-h-0 flex-1">
        <AdminSidebar />

        <main className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
          <nav className="custom-scrollbar mb-4 flex gap-1 overflow-x-auto pb-1 lg:hidden" aria-label="Secciones">
            {mobileTabs.map((t) => (
              <NavLink
                key={t.id}
                to={`/admin/${t.id}`}
                className={({ isActive }) =>
                  `shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    isActive ? 'bg-cyan-500/20 text-cyan-100' : 'bg-white/5 text-slate-400'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>

          {!currentProject ? (
            <p className="text-sm text-amber-200/90">Selecciona un proyecto válido arriba.</p>
          ) : isSwitchingProject ? (
            <motion.div
              key="switching"
              initial={{ opacity: 0.45 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0.45 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-white/[0.06] bg-slate-950/40 p-6"
            >
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-cyan-500/80">
                Cambiando de proyecto
              </p>
              <ProjectSwitchSkeleton />
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentProject}-${active}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <Suspense
                  fallback={
                    <div className="flex items-center gap-2 py-12 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                      Cargando módulo…
                    </div>
                  }
                >
                  <Outlet />
                </Suspense>
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      <footer className="border-t border-white/[0.06] px-4 py-2 text-center text-[10px] text-slate-600">
        {currentProjectMeta?.label ?? '—'} · mock frontend · sustituir adminCoreService por API
      </footer>
    </div>
  );
}

function AdminAppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/admin/login" element={<LoginRoute />} />
      <Route path="/admin" element={<ProtectedAdminOutlet />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="signals" element={<AdminSignalsPage />} />
        <Route path="signal-lab" element={<SignalLabPage />} />
        <Route path="overview" element={<GlobalOverviewModule />} />
        <Route path="users" element={<UsersModule />} />
        <Route path="wallet" element={<WalletModule />} />
        <Route path="rewards" element={<RewardsModule />} />
        <Route path="p2p" element={<P2PModule />} />
        <Route path="network" element={<NetworkModule />} />
        <Route path="economy" element={<EconomyModule />} />
        <Route path="settings" element={<SettingsModule />} />
        <Route path="security" element={<SecurityModule />} />
        <Route path="auditLogs" element={<SecurityLogsPage />} />
        <Route path="analytics" element={<AnalyticsModule />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="flex min-h-full flex-col">
      <AdminAuthProvider>
        <BrowserRouter>
          <AdminAppRoutes />
        </BrowserRouter>
      </AdminAuthProvider>
    </div>
  );
}
