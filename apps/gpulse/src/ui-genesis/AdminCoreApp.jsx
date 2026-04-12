import React, { useCallback, useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LedgerProvider } from './ledger/LedgerContext.jsx';
import { useGenesisDashboardStore } from './stores/genesisDashboardStore.js';
import { getDevMockBearer } from './api/genesisConfig.js';
import { useBinaryEngineStore } from './binary/binaryEngineStore.js';
import { AdminProvider } from '../modules/admin/context/AdminContext.jsx';
import { AdminLayout } from '../modules/admin/AdminLayout.jsx';
import { AdminPanelRouter } from '../modules/admin/AdminPanelRouter.jsx';
import { ADMIN_MODULE_IDS } from '../modules/admin/adminNavConfig.js';
import { useAdminPanelStore } from './stores/adminPanelStore.js';
/** User-app entry path when leaving the isolated admin shell. */
/** Vuelta desde Command Center al dashboard Genesis (lobby). */
export const ADMIN_APP_RETURN_PATH = '/dashboard?nav=genesis-lobby';

export function AdminProtectedShell() {
  const navigate = useNavigate();
  const authToken = useGenesisDashboardStore((s) => s.authToken);
  const sessionAuth = useGenesisDashboardStore((s) => s.sessionAuth);
  const network = useGenesisDashboardStore((s) => s.network);
  const loadDashboardData = useGenesisDashboardStore((s) => s.loadDashboardData);

  const mockBearer = getDevMockBearer();
  const hasSession = Boolean(authToken || mockBearer || sessionAuth);

  const leftPts = network?.leftMonth ?? 0;
  const rightPts = network?.rightMonth ?? 0;

  const ingestApiUpdate = useBinaryEngineStore((s) => s.ingestApiUpdate);

  useEffect(() => {
    if (!hasSession) return undefined;
    loadDashboardData().catch(() => {});
    return undefined;
  }, [hasSession, authToken, mockBearer, sessionAuth, loadDashboardData]);

  useEffect(() => {
    if (!hasSession) return undefined;
    ingestApiUpdate(leftPts, rightPts);
    return undefined;
  }, [hasSession, leftPts, rightPts, ingestApiUpdate]);

  const onBackToApp = useCallback(() => {
    navigate(ADMIN_APP_RETURN_PATH);
  }, [navigate]);

  return (
    <LedgerProvider hasSession={hasSession}>
      <AdminProvider>
        <AdminLayout onBackToApp={onBackToApp}>
          <Outlet />
        </AdminLayout>
      </AdminProvider>
    </LedgerProvider>
  );
}

export function AdminPanelWithNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const setActiveModule = useAdminPanelStore((s) => s.setActiveModule);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[gpulse admin] Current route:', location.pathname);
    }
    const parts = location.pathname.split('/').filter(Boolean);
    const root = parts[0];
    if (root !== 'admin' && root !== 'admin-core') return;
    const seg = parts[1];
    if (!seg || seg === 'signals' || seg === 'login') return;
    const mod = seg === 'settings' ? 'config' : seg;
    if (ADMIN_MODULE_IDS.includes(mod)) {
      setActiveModule(mod);
    } else {
      const base = root === 'admin-core' ? '/admin-core' : '/admin';
      navigate(`${base}/overview`, { replace: true });
    }
  }, [location.pathname, navigate, setActiveModule]);

  return <AdminPanelRouter />;
}

/**
 * @deprecated Las rutas del admin están definidas en `main.jsx` bajo `/admin` y `/admin-core`.
 * Se mantiene el export por compatibilidad con `ui-genesis/index.js`.
 */
export function AdminCoreApp() {
  return null;
}
