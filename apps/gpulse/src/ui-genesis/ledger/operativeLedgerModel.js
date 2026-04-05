/**
 * Historial Operativo — canonical transaction shape for explorer-style ledger.
 *
 * @typedef {'binary' | 'direct' | 'mining' | 'staking' | 'marketplace' | 'system'} OperativeIncomeSource
 * @typedef {'pending' | 'confirmed' | 'failed'} OperativeTxStatus
 * @typedef {'core' | 'booster' | null} OperativeMiningTrack
 *
 * @typedef {{
 *   username?: string | null,
 *   wallet?: string | null,
 *   level?: 'direct' | 'indirect' | 'self' | null,
 * }} OperativeRelatedUser
 *
 * @typedef {{
 *   username?: string | null,
 *   level?: 'direct' | 'indirect' | null,
 *   volumeGenerated?: number,
 *   commissionEarned?: number,
 * }} OperativeTeamInfo
 *
 * @typedef {{
 *   id: string,
 *   type: string,
 *   source: OperativeIncomeSource,
 *   related_user: OperativeRelatedUser,
 *   product: string,
 *   amount_usdt: number,
 *   amount_aig: number,
 *   conversion_price: number | null,
 *   status: OperativeTxStatus,
 *   hash: string | null,
 *   timestamp: number,
 *   title: string,
 *   summary: string,
 *   mining_track: OperativeMiningTrack,
 *   volume_generated: number,
 *   commission_earned: number,
 *   product_active: boolean,
 *   daily_accrual_usdt: number | null,
 *   booster_pct_dynamic: number | null,
 *   conversion_usdt_in: number | null,
 *   conversion_aig_out: number | null,
 *   team: OperativeTeamInfo | null,
 *   importance: 'normal' | 'high',
 *   raw: import('./ledgerModel.js').LedgerEvent,
 * }} OperativeTransaction
 */

export {};
