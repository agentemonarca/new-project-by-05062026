/**
 * In-memory rolling metrics for system health (survives per-process; not persisted).
 * Updated by withdrawal (and optionally deposit) outcomes — no hardcoded health values.
 */

const MAX_SAMPLES = 200;
const outcomes = [];
const confirmTimes = [];

export function recordTxOutcome({ success, confirmationMs = null } = {}) {
  const at = Date.now();
  outcomes.push({ ok: Boolean(success), at });
  while (outcomes.length > MAX_SAMPLES) outcomes.shift();

  if (success && confirmationMs != null && Number.isFinite(Number(confirmationMs)) && Number(confirmationMs) > 0) {
    confirmTimes.push(Number(confirmationMs));
    while (confirmTimes.length > MAX_SAMPLES) confirmTimes.shift();
  }
}

export function getTxMetricsStats() {
  const n = outcomes.length;
  if (n === 0) {
    return { sampleSize: 0, failureRate: 0, avgConfirmationMs: null };
  }
  const fails = outcomes.filter((o) => !o.ok).length;
  const failureRate = fails / n;
  let avgConfirmationMs = null;
  if (confirmTimes.length > 0) {
    avgConfirmationMs = confirmTimes.reduce((a, b) => a + b, 0) / confirmTimes.length;
  }
  return { sampleSize: n, failureRate, avgConfirmationMs };
}
