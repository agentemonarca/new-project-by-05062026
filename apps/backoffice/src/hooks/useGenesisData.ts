import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGenesisStore } from '@ai-genesis/state';
import type { ActivityItem, NetworkData } from '@ai-genesis/types';
import { syncGenesisModules } from '@/lib/syncGenesisModules';

/**
 * Wallet slice: separate store subscriptions so unrelated updates do not re-render this object
 * unless `wallet`, `balance`, or `recentActivity` reference changes.
 */
export function useGenesisWalletSlice(): {
  wallet: string | undefined;
  balance: number | undefined;
  activity: ActivityItem[];
} {
  const wallet = useGenesisStore((s) => s.dashboard.user.wallet);
  const balance = useGenesisStore((s) => s.dashboard.user.balance);
  const activity = useGenesisStore((s) => s.dashboard.recentActivity);
  return useMemo(() => ({ wallet, balance, activity }), [wallet, balance, activity]);
}

export function useGenesisNetworkSlice(): { networkStats: NetworkData | undefined } {
  const networkStats = useGenesisStore((s) => s.dashboard.user.networkStats);
  return useMemo(() => ({ networkStats }), [networkStats]);
}

export interface UseGenesisDataResult {
  loading: boolean;
  refreshing: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

/**
 * Shared Genesis fetch: deduped via `syncGenesisModules` TTL; `refreshing` only on forced refresh.
 */
export function useGenesisData(): UseGenesisDataResult {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const run = useCallback(async (mode: 'initial' | 'refresh') => {
    const force = mode === 'refresh';
    if (mode === 'refresh') {
      setRefreshing(true);
      setError(false);
    } else {
      setLoading(true);
      setError(false);
    }

    const r = await syncGenesisModules({ force });

    if (mode === 'refresh') setRefreshing(false);
    else setLoading(false);

    if (!r.ok) setError(true);
  }, []);

  useEffect(() => {
    void run('initial');
  }, [run]);

  const refresh = useCallback(async () => {
    await run('refresh');
  }, [run]);

  return useMemo(
    () => ({
      loading,
      refreshing,
      error,
      refresh,
    }),
    [loading, refreshing, error, refresh],
  );
}
