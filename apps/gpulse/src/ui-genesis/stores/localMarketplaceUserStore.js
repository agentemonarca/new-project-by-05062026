import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MAP_CENTER } from '../local-marketplace/mockMerchants.js';

/**
 * @typedef {{
 *   id: string,
 *   merchantId: string,
 *   merchantName: string,
 *   productId: string,
 *   productName: string,
 *   usd: number,
 *   aig: number,
 *   binaryPts?: number,
 *   at: string,
 * }} LocalPurchaseRecord
 */

export const useLocalMarketplaceUserStore = create(
  persist(
    (set, get) => ({
      balanceAIG: 5000,
      balanceUSD: 500,
      /** @type {string | null} last seen wallet (display only; not source of truth on-chain) */
      walletAddress: null,
      /** @type {LocalPurchaseRecord[]} */
      purchaseHistory: [],
      /** @type {string[]} merchant ids */
      favorites: [],
      userLat: DEFAULT_MAP_CENTER.lat,
      userLng: DEFAULT_MAP_CENTER.lng,
      locationLabel: 'Dubai (default)',
      /** Demo upline for buyer-referrer revenue leg (replace with on-chain graph). */
      buyerReferrerWallet: '0x1111111111111111111111111111111111111111',

      /** @param {string | null} addr */
      setWalletSnapshot: (addr) => set({ walletAddress: addr }),

      /** @param {number} lat @param {number} lng @param {string} [label] */
      setUserLocation: (lat, lng, label) =>
        set({ userLat: lat, userLng: lng, locationLabel: label ?? 'Custom' }),

      /** @param {string} merchantId */
      toggleFavorite: (merchantId) =>
        set((s) => ({
          favorites: s.favorites.includes(merchantId)
            ? s.favorites.filter((id) => id !== merchantId)
            : [...s.favorites, merchantId],
        })),

      /**
       * Mock settlement — deducts balances; on-chain hook can replace this.
       * @param {{ merchantId: string, merchantName: string, productId: string, productName: string, usd: number, aig: number, binaryPts?: number }} p
       */
      recordPurchase: (p) => {
        const st = get();
        const entry = {
          id: `lp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          merchantId: p.merchantId,
          merchantName: p.merchantName,
          productId: p.productId,
          productName: p.productName,
          usd: p.usd,
          aig: p.aig,
          binaryPts: p.binaryPts,
          at: new Date().toISOString(),
        };
        set({
          purchaseHistory: [entry, ...st.purchaseHistory],
          balanceAIG: Math.max(0, st.balanceAIG - p.aig),
          balanceUSD: Math.max(0, st.balanceUSD - p.usd),
        });
        return entry;
      },
    }),
    {
      name: 'gpulse-local-marketplace-user-v1',
      partialize: (s) => ({
        balanceAIG: s.balanceAIG,
        balanceUSD: s.balanceUSD,
        walletAddress: s.walletAddress,
        purchaseHistory: s.purchaseHistory,
        favorites: s.favorites,
        userLat: s.userLat,
        userLng: s.userLng,
        locationLabel: s.locationLabel,
        buyerReferrerWallet: s.buyerReferrerWallet,
      }),
    },
  ),
);
