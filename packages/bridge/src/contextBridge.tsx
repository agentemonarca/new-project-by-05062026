import { useShallow } from 'zustand/react/shallow';
import { useGenesisStore } from '@ai-genesis/state';
import type { ExternalContextValue } from '@ai-genesis/types';

/**
 * Hook for shell + embedded apps: stable snapshot of shared auth context.
 */
export function useExternalContext(): ExternalContextValue {
  return useGenesisStore(
    useShallow((s) => ({
      user: s.user,
      wallet: s.wallet,
      token: s.token,
      isAuthenticated: s.isAuthenticated,
      systemMode: s.systemMode,
    })),
  );
}
