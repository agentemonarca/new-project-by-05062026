import { getEfficiency } from '../core/nextActionEngine.js';
import { compareModules } from './compareEngine.js';
import { countByCategoryInWindow } from './eventStats.js';

/**
 * @typedef {import('./ledgerModel.js').LedgerEvent} LedgerEvent
 */

/**
 * @typedef {{
 *   id: string,
 *   severity: 'info' | 'warn' | 'positive',
 *   message: string,
 * }} LedgerInsight
 */

/**
 * Insights from CoreContext snapshot + normalized events (no duplicate yield math).
 *
 * @param {Record<string, unknown>} core — shape from `useCore()`
 * @param {LedgerEvent[]} events
 * @returns {LedgerInsight[]}
 */
export function buildLedgerInsights(core, events) {
  /** @type {LedgerInsight[]} */
  const out = [];

  const cores = /** @type {import('../types/miningCore.js').MiningCore[]} */ (core.cores ?? []);
  const modules = compareModules(cores);

  const order = [
    { key: 'mining', label: 'Mining engines' },
    { key: 'booster', label: 'Booster acceleration' },
    { key: 'staking', label: 'Staking participation' },
  ];
  const ranked = order
    .map(({ key, label }) => ({ key, label, rate: modules[key].rate }))
    .sort((a, b) => b.rate - a.rate);
  const top = ranked[0];
  if (top && top.rate > 1e-9) {
    out.push({
      id: 'top-source',
      severity: 'positive',
      message: `Top live earning surface: ${top.label} (${modules[top.key].contributionPercent.toFixed(1)}% of active module rate).`,
    });
  } else {
    out.push({
      id: 'idle-modules',
      severity: 'warn',
      message: 'No active module rates detected — inject mining or enable booster/staking to build ledger velocity.',
    });
  }

  const eff = getEfficiency(core);
  if (eff < 0.7) {
    out.push({
      id: 'efficiency',
      severity: 'warn',
      message: `Energy index is ${Math.round(eff * 100)}% — core is under target; rebalance mining, booster, and network boost.`,
    });
  }

  const mult = Number(core.multiplier ?? 1);
  if (mult < 1.22 && modules.mining.rate > 1e-9) {
    out.push({
      id: 'booster-gap',
      severity: 'warn',
      message: 'Multiplier is soft versus mining power — acceleration may be leaving yield on the table.',
    });
  }

  const recent = countByCategoryInWindow(events);
  const txN = recent.transaction ?? 0;
  if (txN === 0 && events.length > 0) {
    out.push({
      id: 'no-recent-tx',
      severity: 'info',
      message: 'No on-chain transactions in the last 7 days in this feed — deposits and claims will appear here when indexed.',
    });
  }

  const netBoost = Number(core.networkBoost ?? 0);
  if (netBoost < 0.35 && (Number(core.leftPts) + Number(core.rightPts) > 0)) {
    out.push({
      id: 'network-balance',
      severity: 'info',
      message: 'Binary balance could be stronger — closer left/right volumes lift network boost on the energy index.',
    });
  }

  return out;
}
