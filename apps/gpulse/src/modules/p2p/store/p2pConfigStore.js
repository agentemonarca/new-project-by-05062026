import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { deepMerge } from '../utils/deepMerge.js';

/** @typedef {import('./p2pConfigTypes.js').P2PConfig} P2PConfig */

/** @type {P2PConfig} */
export const P2P_DEFAULT_CONFIG = {
  price: {
    basePrice: 23,
    minPrice: 22,
    maxPrice: 25,
  },
  rules: {
    requireMiningToSell: true,
    requireProfile: true,
  },
  order: {
    minOrderAmount: 10,
    maxOrderAmount: 100_000,
  },
  limits: {
    maxOrdersPerUser: 10,
    maxDailyOrders: 5,
    maxWeeklyOrders: 20,
    maxMonthlyOrders: 60,
  },
  volume: {
    maxBuyPerDay: 50_000,
    maxSellPerDay: 50_000,
  },
};

function cloneDefaultConfig() {
  return /** @type {P2PConfig} */ (JSON.parse(JSON.stringify(P2P_DEFAULT_CONFIG)));
}

/**
 * Central P2P configuration (persisted). Prefer narrow selectors to avoid re-renders.
 */
export const useP2PConfigStore = create(
  persist(
    (set, get) => ({
      /** @type {P2PConfig} */
      config: cloneDefaultConfig(),

      /** @returns {P2PConfig} */
      getConfig: () => get().config,

      /** @param {Partial<P2PConfig> | Record<string, unknown>} partial */
      updateConfig: (partial) =>
        set((state) => ({
          config: /** @type {P2PConfig} */ (
            deepMerge(/** @type {Record<string, unknown>} */ (state.config), /** @type {Record<string, unknown>} */ (partial))
          ),
        })),

      resetConfig: () => set({ config: cloneDefaultConfig() }),
    }),
    {
      name: 'aigenesis-p2p-config-v1',
      partialize: (s) => ({ config: s.config }),
    },
  ),
);

/**
 * @template T
 * @param {(state: ReturnType<typeof useP2PConfigStore.getState>) => T} selector
 */
export function useP2PConfigShallow(selector) {
  return useP2PConfigStore(useShallow(selector));
}
