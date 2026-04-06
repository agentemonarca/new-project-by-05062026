import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LedgerProvider } from './ledger/LedgerContext.jsx';
import { useGenesisDashboardStore } from './stores/genesisDashboardStore.js';
import { getDevMockBearer } from './api/genesisConfig.js';
import { useBinaryEngineStore } from './binary/binaryEngineStore.js';
import { navToPath } from './navigation/genesisPaths.js';
import { AdminProvider } from '../modules/admin/context/AdminContext.jsx';
import { AdminLayout } from '../modules/admin/AdminLayout.jsx';
import { AdminPanelRouter } from '../modules/admin/AdminPanelRouter.jsx';

/** User-app entry path when leaving the isolated admin shell. */
export const ADMIN_APP_RETURN_PATH = '/genesis-lobby';

/**
 * Root-level admin interface: Command Center con contexto operativo mock + layout premium.
 */
export function AdminCoreApp() {
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
          <AdminPanelRouter onNavigate={(navId) => navigate(navToPath(navId))} />
        </AdminLayout>
      </AdminProvider>
    </LedgerProvider>
  );
}
