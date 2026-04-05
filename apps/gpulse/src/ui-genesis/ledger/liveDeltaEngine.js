/**
 * @typedef {import('./ledgerModel.js').LedgerEvent} LedgerEvent
 */

const MS_HOUR = 3600_000;
const MS_DAY = 86400_000;

function startOfLocalDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function sumAmountsInRange(events, start, end) {
  let usdt = 0;
  let aig = 0;
  let count = 0;
  for (const e of events) {
    if (e.ts < start || e.ts >= end) continue;
    count += 1;
    if (e.amountUsdt != null && Number.isFinite(e.amountUsdt)) usdt += e.amountUsdt;
    if (e.amountAig != null && Number.isFinite(e.amountAig)) aig += e.amountAig;
  }
  return { usdt, aig, count };
}

/**
 * @typedef {{
 *   last24h: { usdt: number, aig: number, count: number },
 *   previous24h: { usdt: number, aig: number, count: number },
 *   delta24h: { usdt: number, aig: number, usdtPercent: number | null, aigPercent: number | null },
 *   last7Days: Array<{ dayKey: string, dayLabel: string, startTs: number, usdt: number, aig: number, count: number }>,
 *   trend7d: 'up' | 'down' | 'flat',
 * }} LiveDeltaResult
 */

/**
 * Compare last 24h vs previous 24h and build 7 local-day buckets (single pass over events).
 *
 * @param {LedgerEvent[]} events
 * @returns {LiveDeltaResult}
 */
export function calculateLiveDelta(events) {
  const now = Date.now();
  const t0 = now - MS_DAY;
  const t1 = now - 2 * MS_DAY;

  const last24h = sumAmountsInRange(events, t0, now + 1);
  const previous24h = sumAmountsInRange(events, t1, t0);

  const pct = (cur, prev) => {
    if (prev <= 1e-12) return cur > 1e-12 ? 100 : null;
    return ((cur - prev) / prev) * 100;
  };

  /** @type {LiveDeltaResult['last7Days']} */
  const last7Days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const startTs = startOfLocalDay(now - i * MS_DAY);
    const endTs = startTs + MS_DAY;
    const sums = sumAmountsInRange(events, startTs, endTs);
    const dayKey = new Date(startTs).toISOString().slice(0, 10);
    const dayLabel = new Date(startTs).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    last7Days.push({ dayKey, dayLabel, startTs, ...sums });
  }

  const mid = last7Days.slice(0, 4);
  const late = last7Days.slice(4);
  const sumVol = (rows) => rows.reduce((s, r) => s + r.usdt + r.aig * 0.1, 0);
  const vMid = sumVol(mid);
  const vLate = sumVol(late);
  let trend7d = 'flat';
  if (vLate > vMid * 1.08) trend7d = 'up';
  else if (vLate < vMid * 0.92 && vMid > 1e-9) trend7d = 'down';

  return {
    last24h,
    previous24h,
    delta24h: {
      usdt: last24h.usdt - previous24h.usdt,
      aig: last24h.aig - previous24h.aig,
      usdtPercent: pct(last24h.usdt, previous24h.usdt),
      aigPercent: pct(last24h.aig, previous24h.aig),
    },
    last7Days,
    trend7d,
  };
}

/**
 * Aggregate absolute flow by category for distribution charts (ledger amounts only).
 *
 * @param {LedgerEvent[]} events
 * @returns {Array<{ category: string, usdt: number, aig: number }>}
 */
export function aggregateIncomeByCategory(events) {
  /** @type {Record<string, { usdt: number, aig: number }>} */
  const map = {};
  for (const e of events) {
    if (!map[e.category]) map[e.category] = { usdt: 0, aig: 0 };
    if (e.amountUsdt != null && Number.isFinite(e.amountUsdt)) map[e.category].usdt += e.amountUsdt;
    if (e.amountAig != null && Number.isFinite(e.amountAig)) map[e.category].aig += e.amountAig;
  }
  return Object.entries(map)
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.usdt + b.aig * 0.15 - (a.usdt + a.aig * 0.15));
}
