/**
 * Global AIG / USD pricing (single source of truth for the app).
 * All USDT legs are treated as USD notional (1:1) for equivalence checks.
 *
 * - **`applySimulatedAigPrice`** is called from `useAigPrice` (dashboard) so `getAigPrice()` matches the header ticker.
 * - **`subscribeLiveAigUsd`** lets React (`useSyncExternalStore`) re-render when the oracle moves without prop drilling.
 */

export const PRICING_EPS = 1e-4;

/** @type {number} USD per 1 AIG — updated only through `applySimulatedAigPrice`. */
let liveAigUsd = 23.5;

/** @type {Set<() => void>} */
const liveAigSubscribers = new Set();

function notifyLiveAigUsd() {
  for (const cb of liveAigSubscribers) {
    try {
      cb();
    } catch {
      /* ignore subscriber errors */
    }
  }
}

/**
 * Subscribe to USD-per-AIG changes (for `useLiveAigUsdPerUnit` / `useUSDValue`).
 * @param {() => void} onChange
 * @returns {() => void} unsubscribe
 */
export function subscribeLiveAigUsd(onChange) {
  liveAigSubscribers.add(onChange);
  return () => liveAigSubscribers.delete(onChange);
}

/**
 * @param {number} usd — clamping is done in the price engine; only finite values apply.
 */
export function applySimulatedAigPrice(usd) {
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return;
  if (Math.abs(n - liveAigUsd) < 1e-12) return;
  liveAigUsd = n;
  notifyLiveAigUsd();
}

/** USD per 1 AIG (oracle for payments, rewards, and marketplace math). */
export function getAigPrice() {
  return liveAigUsd;
}

/** @param {number} usd */
export function usdToAig(usd) {
  const u = Math.max(0, Number(usd) || 0);
  return u / getAigPrice();
}

/** @param {number} aig */
export function aigToUsd(aig) {
  return Math.max(0, Number(aig) || 0) * getAigPrice();
}

/**
 * Total USD notional from dual legs (AIG priced at oracle + USDT leg).
 * @param {number} aigAmount
 * @param {number} usdtAmount
 */
export function validateUsdEquivalence(aigAmount, usdtAmount) {
  const totalUSD = aigToUsd(aigAmount) + Math.max(0, Number(usdtAmount) || 0);
  return totalUSD;
}

/**
 * @param {number} priceUSD
 * @param {number} aigAmount
 * @param {number} usdtAmount
 * @param {number} [eps]
 */
export function assertPaymentMatchesPrice(priceUSD, aigAmount, usdtAmount, eps = PRICING_EPS) {
  const total = validateUsdEquivalence(aigAmount, usdtAmount);
  const p = Math.max(0, Number(priceUSD) || 0);
  if (Math.abs(total - p) > eps) {
    throw new Error('Invalid payment calculation');
  }
}
