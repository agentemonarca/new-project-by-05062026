/**
 * COMP_PAYOUT_WEI_PER_USDT: native wei paid per 1.0 ledger USDT unit.
 * Validates bounds on every read so env updates apply without restart.
 */

const DEFAULT_MAX = 1_000_000_000_000_000_000_000_000n; // 1e24 wei — absurdly high guard rail

/**
 * @returns {{ weiPerUsdt: bigint, raw: string }}
 */
export function getValidatedPayoutWeiPerUsdt() {
  const raw = String(process.env.COMP_PAYOUT_WEI_PER_USDT || '0').trim() || '0';
  let wei;
  try {
    wei = BigInt(raw);
  } catch {
    throw new Error('COMP_PAYOUT_WEI_PER_USDT_INVALID');
  }
  const minRaw = String(process.env.COMP_PAYOUT_WEI_PER_USDT_MIN || '1').trim() || '1';
  const maxRaw = String(process.env.COMP_PAYOUT_WEI_PER_USDT_MAX || String(DEFAULT_MAX)).trim();
  let min;
  let max;
  try {
    min = BigInt(minRaw);
    max = BigInt(maxRaw);
  } catch {
    throw new Error('COMP_PAYOUT_WEI_PER_USDT_BOUNDS_INVALID');
  }
  if (min < 1n) min = 1n;
  if (max < min) max = min;
  if (wei < min || wei > max) {
    const err = new Error('COMP_PAYOUT_WEI_PER_USDT_OUT_OF_RANGE');
    err.meta = { min: min.toString(), max: max.toString(), got: wei.toString() };
    throw err;
  }
  return { weiPerUsdt: wei, raw };
}
