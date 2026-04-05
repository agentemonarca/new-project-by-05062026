/**
 * Unified ledger / activity schema for AiGenesis intelligence UI.
 *
 * @typedef {'mining' | 'booster' | 'staking' | 'network' | 'transaction' | 'marketplace' | 'overview'} LedgerEventCategory
 *
 * @typedef {'pending' | 'confirmed'} LedgerTxStatus
 *
 * @typedef {{
 *   id: string,
 *   ts: number,
 *   category: LedgerEventCategory,
 *   kind: string,
 *   title: string,
 *   summary: string,
 *   amountUsdt?: number,
 *   amountAig?: number,
 *   txHash?: string | null,
 *   chainId?: string | number | null,
 *   txStatus?: LedgerTxStatus | null,
 *   meta?: Record<string, unknown>,
 * }} LedgerEvent
 */

/** @type {LedgerEventCategory[]} */
export const LEDGER_CATEGORIES = [
  'mining',
  'booster',
  'staking',
  'network',
  'transaction',
  'marketplace',
  'overview',
];
