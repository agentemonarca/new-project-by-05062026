/**
 * AiGenesis notification feed — delegates to the intelligent {@link notificationEngine}.
 * @module
 */

import { buildUiNotificationsFromEngine } from './notificationEngine.js';

/**
 * @typedef {'rewards' | 'alerts' | 'system' | 'activity'} GenesisNotificationCategory
 * @typedef {'info' | 'warning' | 'critical'} GenesisNotificationSeverity
 *
 * @typedef {{
 *   id: string,
 *   category: GenesisNotificationCategory,
 *   severity: GenesisNotificationSeverity,
 *   title: string,
 *   description: string,
 *   ts: number,
 *   actionLabel: string,
 *   navId: string,
 *   priority?: string,
 *   engineAction?: string,
 *   read?: boolean,
 * }} GenesisNotificationItem
 */

/**
 * @param {{
 *   hasSession: boolean,
 *   userHasActiveStaking: boolean,
 *   holdingPctAig: number,
 *   minHoldingPct: number,
 *   accountFrozen: boolean,
 *   userEconomicallyActive: boolean,
 *   leftPts: number,
 *   rightPts: number,
 *   directClaimUsdt: number,
 *   paymentEvents: Array<{ id: string, ts: number, title: string, summary: string, category?: string, kind?: string }>,
 *   systemUpdates?: Array<{ id: string, title: string, description: string, timestamp: number }>,
 *   systemStatus?: 'ok' | 'degraded',
 * }} input
 * @returns {GenesisNotificationItem[]}
 */
export function buildGenesisNotifications(input) {
  return buildUiNotificationsFromEngine({
    core: {
      hasSession: input.hasSession,
      userHasActiveStaking: input.userHasActiveStaking,
      holdingPctAig: input.holdingPctAig,
      minHoldingPct: input.minHoldingPct,
      accountFrozen: input.accountFrozen,
      userEconomicallyActive: input.userEconomicallyActive,
      directClaimUsdt: input.directClaimUsdt,
    },
    ledger: { events: input.paymentEvents || [] },
    network: { leftPts: input.leftPts, rightPts: input.rightPts },
    system: {
      updates: input.systemUpdates,
      status: input.systemStatus,
    },
  });
}
