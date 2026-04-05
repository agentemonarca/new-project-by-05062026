import { useEffect, useRef } from 'react';
import { useSocket } from '../../hooks/useSocket.js';
import { getApiBaseUrl, getDevMockBearer } from '../api/genesisConfig.js';
import { useGenesisDashboardStore } from '../stores/genesisDashboardStore.js';

/**
 * Refreshes dashboard when socket emits health / balance (optional).
 */
export function useGenesisRealtime(enabled = true) {
  const loadDashboardData = useGenesisDashboardStore((s) => s.loadDashboardData);
  const debounceRef = useRef(null);

  const debouncedRefresh = () => {
    const { authToken } = useGenesisDashboardStore.getState();
    if (!authToken && !getDevMockBearer()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadDashboardData().catch(() => {});
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useSocket(enabled ? getApiBaseUrl() : '', {
    onSystemHealth: debouncedRefresh,
    onBalanceUpdate: debouncedRefresh,
    onTxUpdate: debouncedRefresh,
  });
}

