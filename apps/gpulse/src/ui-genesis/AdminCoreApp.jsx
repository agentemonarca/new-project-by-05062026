import React, { useCallback, useEffect } from 'react';
import { LedgerProvider } from './ledger/LedgerContext.jsx';
import { useGenesisDashboardStore } from './stores/genesisDashboardStore.js';
import { getDevMockBearer } from './api/genesisConfig.js';
import { useBinaryEngineStore } from './binary/binaryEngineStore.js';
import { navToPath } from './navigation/genesisPaths.js';
import { AdminCoreLayout } from './layout/AdminCoreLayout.jsx';
import { AdminCorePanelPage } from './pages/AdminCorePanelPage.jsx';

/** User-app entry path when leaving the isolated admin shell. */
export const ADMIN_APP_RETURN_PATH = '/genesis-lobby';

/**
 * Root-level admin interface: no GenesisDashboardLayout, user nav, or lobby.
 * Ledger + binary sync mirror the user app only where needed for admin metrics.
 */
export function AdminCoreApp() {
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
    window.location.assign(ADMIN_APP_RETURN_PATH);
  }, []);

  const onNavigateUserApp = useCallback((navId) => {
    const path = navToPath(navId);
    window.location.assign(path);
  }, []);

  return (
    <LedgerProvider hasSession={hasSession}>
      <AdminCoreLayout onBackToApp={onBackToApp}>
        <AdminCorePanelPage onNavigate={onNavigateUserApp} />
      </AdminCoreLayout>
    </LedgerProvider>
  );
}
