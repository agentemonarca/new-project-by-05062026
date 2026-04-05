import { getEfficiency } from '../core/nextActionEngine.js';
import { compareModules } from './compareEngine.js';
import { calculateLiveDelta } from './liveDeltaEngine.js';
import { countByCategoryInWindow } from './eventStats.js';

/**
 * @typedef {import('./ledgerModel.js').LedgerEvent} LedgerEvent
 */

/**
 * @typedef {{
 *   summary: string,
 *   highlight: string,
 *   warning: string | null,
 *   opportunity: string | null,
 * }} UserStory
 */

/**
 * Narrative layer: composes CoreContext snapshot + ledger feed (reuses compare/delta helpers — no duplicate yield math).
 *
 * @param {Record<string, unknown>} core
 * @param {LedgerEvent[]} events
 * @returns {UserStory}
 */
export function buildUserStory(core, events) {
  const cores = /** @type {import('../types/miningCore.js').MiningCore[]} */ (core.cores ?? []);
  const modules = compareModules(cores);
  const eff = getEfficiency(core);
  const energy = Number(core.energy ?? 0);
  const delta = calculateLiveDelta(events);
  const recent = countByCategoryInWindow(events, 7 * 86400_000);

  const top = ['mining', 'booster', 'staking']
    .map((k) => ({ k, r: modules[k].rate, pct: modules[k].contributionPercent }))
    .sort((a, b) => b.r - a.r)[0];

  const summary =
    top.r > 1e-9
      ? `Your stack is centered on ${top.k} (${top.pct.toFixed(0)}% of live module rate) with energy at ${Math.round(energy)} — ledger ${delta.trend7d === 'up' ? 'accelerated' : delta.trend7d === 'down' ? 'cooled' : 'steady'} over the last week.`
      : `Engines are quiet — energy sits at ${Math.round(energy)} while the ledger shows ${events.length} indexed rows to guide your next moves.`;

  const dUsdt = delta.delta24h.usdt;
  const dLine =
    delta.delta24h.usdtPercent != null
      ? `24h USDT flow vs prior day: ${dUsdt >= 0 ? '+' : ''}${dUsdt.toFixed(2)} (${delta.delta24h.usdtPercent >= 0 ? '+' : ''}${delta.delta24h.usdtPercent.toFixed(0)}%).`
      : `24h USDT flow: ${delta.last24h.usdt.toFixed(2)} (no prior window baseline).`;
  const dAig =
    delta.delta24h.aigPercent != null
      ? ` AIG: ${delta.delta24h.aig >= 0 ? '+' : ''}${delta.delta24h.aig.toFixed(1)} (${delta.delta24h.aigPercent >= 0 ? '+' : ''}${delta.delta24h.aigPercent.toFixed(0)}%).`
      : ` AIG: ${delta.last24h.aig.toFixed(1)}.`;
  const highlight = `${dLine}${dAig} 7-day trend: ${delta.trend7d}.`;

  /** @type {string | null} */
  let warning = null;
  if (eff < 0.65) {
    warning = `Efficiency is ${Math.round(eff * 100)}% — the core is underperforming versus target; rebalance booster and network before scaling size.`;
  } else if (Number(core.multiplier ?? 1) < 1.2 && modules.mining.rate > 1e-9) {
    warning = 'Multiplier is trailing mining power — acceleration is likely capping realized output.';
  }

  /** @type {string | null} */
  let opportunity = null;
  const txN = recent.transaction ?? 0;
  if (txN < 2 && events.some((e) => e.category === 'transaction')) {
    opportunity = 'Few recent on-chain movements — a deposit or claim would refresh settlement velocity and indexer coverage.';
  }
  if (Number(core.networkBoost ?? 0) < 0.4 && (Number(core.leftPts) + Number(core.rightPts) > 0)) {
    opportunity =
      (opportunity ? `${opportunity} ` : '') +
      'Tighter binary balance would lift network boost and compound the energy index.';
  }
  if (!opportunity && delta.trend7d === 'down' && delta.last24h.count > 0) {
    opportunity = 'Weekly cadence softened — consider a booster or staking action to re-engage the curve.';
  }

  return { summary, highlight, warning, opportunity };
}
