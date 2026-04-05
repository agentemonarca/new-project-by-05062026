import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * @typedef {import('../local-marketplace/mockMerchants.js').LocalMerchant} LocalMerchant
 * @typedef {import('../local-marketplace/mockMerchants.js').LocalProduct} LocalProduct
 */

export const useLocalMerchantDirectoryStore = create(
  persist(
    (set) => ({
      /** Persisted stores created via merchant onboarding (not bundled seed data). */
      /** @type {LocalMerchant[]} */
      userMerchants: [],

      /** @param {LocalMerchant} merchant */
      addMerchant(merchant) {
        set((s) => ({ userMerchants: [...s.userMerchants, merchant] }));
        return merchant.id;
      },

      /**
       * @param {string} merchantId
       * @param {Omit<LocalProduct, 'id'> & { id?: string }} product
       */
      addProduct(merchantId, product) {
        const id = product.id ?? `${merchantId}-p-${Date.now()}`;
        /** @type {LocalProduct} */
        const row = { ...product, id };
        set((s) => ({
          userMerchants: s.userMerchants.map((m) =>
            m.id === merchantId ? { ...m, products: [...m.products, row] } : m,
          ),
        }));
        return id;
      },

      /** @param {string} merchantId @param {LocalProduct[]} products */
      setMerchantProducts(merchantId, products) {
        set((s) => ({
          userMerchants: s.userMerchants.map((m) =>
            m.id === merchantId ? { ...m, products } : m,
          ),
        }));
      },
    }),
    {
      name: 'gpulse-local-merchant-directory-v1',
      partialize: (s) => ({ userMerchants: s.userMerchants }),
    },
  ),
);
