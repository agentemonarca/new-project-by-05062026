import { useMemo } from 'react';
import { useExternalSignalsStore } from '../ui-genesis/stores/externalSignalsStore.js';

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
    const settled = Array.isArray(history) ? history.filter((h) => h.status === 'won' || h.status === 'lost') : [];
    let wins = 0;
    let losses = 0;
    /** Align with session report UI: indices 1–6 = T1–T6 wins, 7 = FAIL; slot 0 unused. */
    const distribution = Array(8).fill(0);
    for (const row of settled) {
      if (row.status === 'won') {
        wins += 1;
        const mg = Math.max(1, Math.min(6, Number(row.martingale) || 1));
        distribution[mg] += 1;
      } else if (row.status === 'lost') {
        losses += 1;
        distribution[7] += 1;
      }
    }
    const total = wins + losses;
    return {
      wins,
      losses,
      total,
      distribution,
      precisionPct: total > 0 ? (wins / total) * 100 : 0,
    };
  }, [enabled, history]);
}
