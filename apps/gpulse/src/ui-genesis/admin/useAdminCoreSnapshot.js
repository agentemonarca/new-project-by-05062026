import { useMemo } from 'react';
import { usdToAig } from '../../utils/pricing.js';

/**
 * Aggregate ledger + legs into admin dashboard figures (UI layer; replace with API totals later).
 *
 * @param {{
 *   events: import('../ledger/ledgerModel.js').LedgerEvent[],
 *   leftPts: number,
 *   rightPts: number,
 * }} input
 */
export function useAdminCoreSnapshot({ events, leftPts, rightPts }) {
  return useMemo(() => {
    const list = Array.isArray(events) ? events : [];
    const sumUsdt = list.reduce((s, e) => s + (Number(e.amountUsdt) || 0), 0);
    const byCat = /** @type {Record<string, number>} */ ({});
    for (const e of list) {
      const k = e.category || 'overview';
      byCat[k] = (byCat[k] || 0) + (Number(e.amountUsdt) || 0);
    }
    const growthProxy =
      list.length >= 2
        ? ((Number(list[0].amountUsdt) || 0) - (Number(list[1].amountUsdt) || 0)) /
          Math.max(1e-9, Math.abs(Number(list[1].amountUsdt) || 1))
        : 0.03;

    const totalVol = Math.max(0, leftPts + rightPts);
    const match = Math.min(leftPts, rightPts);
    const imbalance = Math.max(0, Math.abs(leftPts - rightPts));
    const imbalancePct = totalVol > 0 ? (imbalance / totalVol) * 100 : 0;

    /** @type {{ id: string, label: string, sharePct: number }[]} */
    const syntheticLeaders = [
      { id: 'L1', label: 'Nodo Alpha', sharePct: totalVol > 0 ? Math.min(38, (leftPts / totalVol) * 100) : 22 },
      { id: 'L2', label: 'Nodo Beta', sharePct: totalVol > 0 ? Math.min(34, (rightPts / totalVol) * 100) : 19 },
      { id: 'L3', label: 'Red residual', sharePct: Math.max(8, 100 - 38 - 34) },
    ].filter((r) => r.sharePct > 0);

    const globalRateUsdt = 0.000412 + match * 1e-7;
    const topRateUsdt = globalRateUsdt * 2.4;
    const inactiveNodes = Math.max(0, Math.min(42, Math.round(imbalancePct / 4)));

    return {
      systemTotalUsdt: sumUsdt || 128_420.55,
      growthPct: Math.round(growthProxy * 1000) / 10,
      volume24hUsdt: byCat.network || byCat.mining || sumUsdt * 0.08 || 12_400,
      activeWalletsProxy: Math.min(9999, 120 + list.length * 3),
      byCategory: byCat,
      globalRateUsdt,
      globalRateAig: usdToAig(globalRateUsdt),
      topRateUsdt,
      topRateAig: usdToAig(topRateUsdt),
      inactiveNodes,
      totalVol,
      leftPts,
      rightPts,
      match,
      imbalancePct: Math.round(imbalancePct * 10) / 10,
      imbalanceSeverity: imbalancePct > 35 ? 'high' : imbalancePct > 18 ? 'medium' : 'low',
      leaders: syntheticLeaders,
    };
  }, [events, leftPts, rightPts]);
}
