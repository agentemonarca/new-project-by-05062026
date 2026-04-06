/**
 * @typedef {{
 *   price: { basePrice: number, minPrice: number, maxPrice: number },
 *   rules: { requireMiningToSell: boolean, requireProfile: boolean },
 *   order: { minOrderAmount: number, maxOrderAmount: number },
 *   limits: { maxOrdersPerUser: number, maxDailyOrders: number, maxWeeklyOrders: number, maxMonthlyOrders: number },
 *   volume: { maxBuyPerDay: number, maxSellPerDay: number },
 * }} P2PConfig
 */

export {};
