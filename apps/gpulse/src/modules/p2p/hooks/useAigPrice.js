import { useMemo } from 'react';
import { useLiveAigUsdPerUnit } from '@/hooks/useUsdValue.js';
import { useP2PConfigStore } from '../store/p2pConfigStore.js';

/**
 * P2P AIG/USD band from central config + suggested quote (oracle clamped to admin min/max).
 * @returns {{ base: number, min: number, max: number, suggested: number }}
 */
export function useAigPrice() {
  const { basePrice, minPrice, maxPrice } = useP2PConfigStore((s) => s.config.price);
  const live = useLiveAigUsdPerUnit();

  const suggested = useMemo(() => {
    const b = Number(basePrice) || 23;
    const lo = Number(minPrice) || 22;
    const hi = Number(maxPrice) || 25;
    const px = Number.isFinite(live) && live > 0 ? live : b;
    const c = Math.min(hi, Math.max(lo, px));
    return Number(c.toFixed(2));
  }, [basePrice, minPrice, maxPrice, live]);

  return useMemo(
    () => ({
      base: Number(basePrice) || 23,
      min: Number(minPrice) || 22,
      max: Number(maxPrice) || 25,
      suggested,
    }),
    [basePrice, minPrice, maxPrice, suggested],
  );
}
