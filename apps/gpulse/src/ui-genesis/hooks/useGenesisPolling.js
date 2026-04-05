import { useEffect, useRef } from 'react';
import { useGenesisDashboardStore } from '../stores/genesisDashboardStore.js';
import { getDevMockBearer } from '../api/genesisConfig.js';

/**
 * Polls dashboard data on an interval. Skips while `loading` is true to avoid overlapping requests.
 * Requires SIWE token or `VITE_DEV_MOCK_BEARER`.
 *
 * @param {boolean} [enabled]
 * @param {number} [intervalMs] default 5000
 */
export function useGenesisPolling(enabled = true, intervalMs = 5000) {
  const loadDashboardData = useGenesisDashboardStore((s) => s.loadDashboardData);
  const loading = useGenesisDashboardStore((s) => s.loading);
  const authToken = useGenesisDashboardStore((s) => s.authToken);
  const mockRef = useRef(getDevMockBearer());

  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => {
      if (loading) return;
      if (!authToken && !mockRef.current) return;
      loadDashboardData().catch(() => {});
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, loadDashboardData, loading, authToken]);
}
