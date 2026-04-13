import { useMemo } from 'react';
import { useExternalSignalsStore } from '../ui-genesis/stores/externalSignalsStore.js';
import { buildStatsFromHistory } from '../utils/buildStatsFromHistory.js';

/**
 * Read-only aggregates from external signal history for IA Real dashboard / audit UI.
 * Does not write to the store.
 *
 * @param {boolean} enabled — typically `isIaRealProviderShell`
 */
export function useIaRealDisplayStats(enabled) {
  const history = useExternalSignalsStore((s) => s.history);

  return useMemo(() => {
    if (!enabled) return null;
    return buildStatsFromHistory(history);
  }, [enabled, history]);
}
