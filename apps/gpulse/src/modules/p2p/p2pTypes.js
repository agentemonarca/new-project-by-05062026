/**
 * @typedef {'buy' | 'sell'} P2PSide
 */

/**
 * @typedef {{
 *   id: string,
 *   side: P2PSide,
 *   priceUsd: number,
 *   amountAig: number,
 *   status: 'open' | 'partial' | 'filled' | 'cancelled',
 *   createdAt: number,
 *   label?: string,
 *   owned?: boolean,
 *   userId?: string,
 * }} P2POrderRow
 */

export {};
