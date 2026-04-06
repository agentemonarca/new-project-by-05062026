/**
 * Filtrado puro del ledger de tesorería (sin React) — fácil de testear / reutilizar con API.
 * @param {object[]} ledger
 * @param {object[]} users
 * @param {{
 *   type: string,
 *   status: string,
 *   userQuery: string,
 *   dateFrom: string,
 *   dateTo: string,
 *   amountMin: string,
 *   amountMax: string,
 * }} f
 */
export function filterWalletLedger(ledger, users, f) {
  const list = Array.isArray(ledger) ? ledger : [];
  const userList = Array.isArray(users) ? users : [];
  const needle = String(f.userQuery ?? '')
    .trim()
    .toLowerCase();

  const minA = f.amountMin === '' || f.amountMin == null ? null : Number(f.amountMin);
  const maxA = f.amountMax === '' || f.amountMax == null ? null : Number(f.amountMax);

  return list.filter((row) => {
    if (f.type && row.type !== f.type) return false;
    if (f.status && row.status !== f.status) return false;

    if (needle) {
      const u = userList.find((x) => x.id === row.userId);
      const hay = u
        ? [u.id, u.email, u.username, u.wallet].map((x) => String(x ?? '').toLowerCase())
        : [String(row.userId ?? '').toLowerCase()];
      if (!hay.some((s) => s.includes(needle))) return false;
    }

    if (f.dateFrom || f.dateTo) {
      const t = new Date(row.createdAt || 0).getTime();
      if (Number.isNaN(t)) return false;
      if (f.dateFrom) {
        const start = new Date(`${f.dateFrom}T00:00:00`).getTime();
        if (t < start) return false;
      }
      if (f.dateTo) {
        const end = new Date(`${f.dateTo}T23:59:59.999`).getTime();
        if (t > end) return false;
      }
    }

    const amt = Number(row.amount);
    if (minA != null && Number.isFinite(minA) && amt < minA) return false;
    if (maxA != null && Number.isFinite(maxA) && amt > maxA) return false;

    return true;
  });
}
