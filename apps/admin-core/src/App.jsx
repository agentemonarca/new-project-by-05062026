import React, { Suspense, useCallback, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext.jsx';
import RequireAdminAuth from './components/RequireAdminAuth.jsx';
import { AdminLoginPage } from './pages/AdminLoginPage.jsx';
import { AdminGpulseLabPage } from './pages/AdminGpulseLabPage.jsx';
import { AdminPanel } from './pages/AdminPanel.jsx';
import { AdminCoreProvider, useAdminCore } from './context/AdminCoreContext.jsx';
import { AdminHeader } from './components/AdminHeader.jsx';
import { ProjectSwitchSkeleton } from './components/ProjectSwitchSkeleton.jsx';
import { Loader2 } from 'lucide-react';
import GPulseLab from './gpulse-lab/GPulseLab.jsx';

/* ─── Rutas legacy desactivadas (no borrar archivos; solo se dejan de importar) ───
import { AdminSignalsPage } from './pages/AdminSignalsPage.jsx';
import { SignalLabPage } from './pages/SignalLabPage.jsx';
const GlobalOverviewModule = lazy(() => import('./modules/global/GlobalOverviewModule.jsx')...);
const UsersModule = lazy(() => import('./modules/users/UsersModule.jsx')...);
// …wallet, rewards, p2p, settings, economy, security, analytics, network, audit
*/

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
    return <Navigate to="/admin" replace />;
  }
  return <AdminLoginPage />;
}

function RootRedirect() {
  const { status, admin } = useAdminAuth();
  if (status !== 'ready') {
    return <SessionLoader />;
  }
  if (admin) {
    return <Navigate to="/admin" replace />;
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

  const onProjectChange = useCallback(
    (id) => {
      if (!id) return;
      setCurrentProject(id);
    },
    [setCurrentProject],
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!currentProject ? (
            <p className="p-4 text-sm text-amber-200/90 lg:p-6">Selecciona un proyecto válido arriba.</p>
          ) : isSwitchingProject ? (
            <motion.div
              key="switching"
              initial={{ opacity: 0.45 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0.45 }}
              transition={{ duration: 0.2 }}
              className="m-4 rounded-2xl border border-white/[0.06] bg-slate-950/40 p-6 lg:m-6"
            >
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-cyan-500/80">
                Cambiando de proyecto
              </p>
              <ProjectSwitchSkeleton />
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentProject}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="flex min-h-0 min-w-0 flex-1 flex-col"
              >
                <Suspense
                  fallback={
                    <div className="flex items-center gap-2 py-12 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                      Cargando…
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
      <Route
        path="/gpulse-lab"
        element={
          <RequireAdminAuth>
            <GPulseLab />
          </RequireAdminAuth>
        }
      />
      <Route path="/admin" element={<ProtectedAdminOutlet />}>
        <Route index element={<AdminPanel />} />
        <Route path="gpulse-lab" element={<AdminGpulseLabPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
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
