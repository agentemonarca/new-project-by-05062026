import { useEffect } from 'react';

/**
 * Placeholder for future real-time updates (e.g. socket.io to core-api).
 * Wire `loadDashboardData` or granular patches when backend events are available.
 *
 * @param {boolean} [_enabled]
 */
export function useGenesisWebSocketPlaceholder(_enabled = false) {
  useEffect(() => {
    // Future: const socket = io(getApiBaseUrl(), { path: '/socket.io', auth: { token } });
    // socket.on('balance:update', () => loadDashboardData());
  }, []);
}
