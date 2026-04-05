/**
 * @typedef {import('./operativeLedgerModel.js').OperativeTransaction} OperativeTransaction
 */

/** @typedef {import('./operativeLedgerModel.js').OperativeTransaction} T */

/**
 * @param {OperativeTransaction} row
 * @param {string} tab
 */
export function operativeRowMatchesTab(row, tab) {
  switch (tab) {
    case 'todos':
      return true;
    case 'mineria':
      return row.source === 'mining' || row.mining_track != null;
    case 'bonos':
      return row.source === 'binary' || row.source === 'direct';
    case 'staking':
      return row.source === 'staking';
    case 'conversiones':
      return row.type === 'conversion';
    case 'retiros':
      return row.type === 'withdrawal';
    case 'compras':
      return (
        row.source === 'marketplace' &&
        (row.type === 'purchase' ||
          row.type === 'order' ||
          row.type === 'quote' ||
          row.type === 'referral_bonus' ||
          row.type === 'platform_fee')
      );
    case 'equipo':
      return Boolean(row.team?.level && row.team.level !== 'self') || row.related_user.level === 'direct' || row.related_user.level === 'indirect';
    default:
      return true;
  }
}

/**
 * @param {OperativeTransaction[]} rows
 * @param {string} q trimmed lowercase query
 */
export function operativeSmartSearch(rows, q) {
  if (!q) return rows;
  return rows.filter((r) => {
    const hay = [
      r.id,
      r.hash,
      r.type,
      r.product,
      r.title,
      r.summary,
      r.related_user.username,
      r.related_user.wallet,
      r.team?.username,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}
