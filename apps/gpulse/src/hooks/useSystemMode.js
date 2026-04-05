import { useMemo } from 'react';
import { useGpulseSystem } from '../context/GpulseContext.jsx';
import { computeSystemMode } from '../system/decisionEngine.js';
import { computeRecentTxStats } from '../system/txStats.js';

/**
 * Derives `systemMode` from GpulseContext.systemHealth + recent wallet timeline rows.
 *
 * @param {object} [opts]
 * @param {Array<object>} [opts.transactions]
 * @param {number} [opts.queueWaiting] — server queue depth (BullMQ waiting count)
 */
export function useSystemMode({ transactions = [], queueWaiting = 0 } = {}) {
  const { systemHealth } = useGpulseSystem();

  return useMemo(() => {
    const recentTxStats = computeRecentTxStats(transactions);
    return computeSystemMode({
      systemHealth,
      recentTxStats,
      queueWaiting: Number(queueWaiting) || 0,
    }).mode;
  }, [systemHealth, transactions, queueWaiting]);
}
