import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useGpulseMembershipStore = create(
  persist(
    (set) => ({
      /** @type {boolean} */
      active: false,
      /** @type {number | null} */
      activatedAt: null,

      activate() {
        set({ active: true, activatedAt: Date.now() });
      },

      reset() {
        set({ active: false, activatedAt: null });
      },
    }),
    {
      name: 'genesis-gpulse-membership-v1',
      partialize: (s) => ({ active: s.active, activatedAt: s.activatedAt }),
    },
  ),
);
