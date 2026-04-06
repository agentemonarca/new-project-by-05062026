import { useMemo, useSyncExternalStore } from 'react';
import { getAigPrice, subscribeLiveAigUsd } from '@/utils/pricing.js';

const FALLBACK_USD_PER_AIG = 23.5;

/**
 * Reactive USD price of 1 AIG — same oracle as `getAigPrice()` / header ticker.
 * Safe outside `AigPriceContext` (e.g. App shell) because it uses `subscribeLiveAigUsd`.
 */
export function useLiveAigUsdPerUnit() {
  return useSyncExternalStore(subscribeLiveAigUsd, getAigPrice, getAigPrice);
}

/**
 * USD notional for an AIG balance at the current global oracle.
 * @param {number} aigAmount
 */
export function useUSDValue(aigAmount) {
  const px = useLiveAigUsdPerUnit();
  const amt = Math.max(0, Number(aigAmount) || 0);
  const safePx = Number.isFinite(px) && px > 0 ? px : FALLBACK_USD_PER_AIG;
  return useMemo(() => amt * safePx, [amt, safePx]);
}
