const STATUS_FAILED = 'FAILED';
const STATUS_COMPLETED = 'COMPLETED';

const DEFAULT_WINDOW = 20;

/**
 * Derive confirmation interval from flowStates (CONNECTING…SUCCESS) when present.
 * @param {object} tx
 * @returns {number | null} ms
 */
export function confirmationDurationFromTx(tx) {
  const fs = tx?.flowStates;
  if (!Array.isArray(fs) || fs.length === 0) return null;
  const by = {};
  for (const e of fs) {
    const s = String(e?.state || '');
    const t = Number(e?.at);
    if (!s || !Number.isFinite(t)) continue;
    if (by[s] == null || t < by[s]) by[s] = t;
  }
  const tStart = by.CONNECTING ?? by.SIGNING ?? by.BROADCASTING;
  const tEnd = by.SUCCESS;
  if (!Number.isFinite(tStart) || !Number.isFinite(tEnd) || tEnd < tStart) return null;
  return tEnd - tStart;
}

/**
 * @param {Array<object>} transactions — wallet timeline rows (newest-first ok)
 * @param {object} [options]
 * @param {number} [options.windowSize]
 * @returns {{ failureRate: number, avgConfirmationTime: number, recentFailures: number }}
 */
export function computeRecentTxStats(transactions, options = {}) {
  const windowSize =
    Number(options.windowSize) > 0 ? Math.floor(Number(options.windowSize)) : DEFAULT_WINDOW;
  const list = Array.isArray(transactions) ? transactions.slice(0, windowSize) : [];

  if (list.length === 0) {
    return { failureRate: 0, avgConfirmationTime: NaN, recentFailures: 0 };
  }

  let recentFailures = 0;
  for (const t of list) {
    if (String(t?.status || '').toUpperCase() === STATUS_FAILED) recentFailures += 1;
  }
  const failureRate = recentFailures / list.length;

  const durations = [];
  for (const t of list) {
    if (String(t?.status || '').toUpperCase() !== STATUS_COMPLETED) continue;
    const d = confirmationDurationFromTx(t);
    if (Number.isFinite(d) && d >= 0) durations.push(d);
  }

  const avgConfirmationTime =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : NaN;

  return {
    failureRate,
    avgConfirmationTime,
    recentFailures,
  };
}
