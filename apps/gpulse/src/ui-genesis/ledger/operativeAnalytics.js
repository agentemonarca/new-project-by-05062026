/**
 * @typedef {import('./operativeLedgerModel.js').OperativeTransaction} OperativeTransaction
 */

/**
 * @param {OperativeTransaction[]} rows
 */
export function aggregateOperativeAnalytics(rows) {
  let mining_usdt = 0;
  let mining_core_usdt = 0;
  let mining_booster_usdt = 0;
  let binary_usdt = 0;
  let direct_usdt = 0;
  let converted_aig = 0;
  let conversion_volume_usdt = 0;

  for (const r of rows) {
    if (r.source === 'mining' || r.mining_track != null) {
      mining_usdt += r.amount_usdt;
      if (r.mining_track === 'booster') mining_booster_usdt += r.amount_usdt;
      else mining_core_usdt += r.amount_usdt;
    }
    if (r.source === 'binary') {
      binary_usdt += r.amount_usdt;
    }
    if (r.source === 'direct') {
      direct_usdt += r.amount_usdt;
    }
    if (r.type === 'conversion') {
      converted_aig += r.conversion_aig_out ?? r.amount_aig ?? 0;
      conversion_volume_usdt += r.conversion_usdt_in ?? r.amount_usdt ?? 0;
    }
  }

  return {
    mining_usdt,
    mining_core_usdt,
    mining_booster_usdt,
    binary_usdt,
    direct_usdt,
    converted_aig,
    conversion_volume_usdt,
  };
}
