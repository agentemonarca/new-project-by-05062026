import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Read / dismiss state for the Genesis notification center (derived + activity ids are strings).
 */
export const useGenesisNotificationStore = create(
  persist(
    (set, get) => ({
      /** notification id -> read timestamp (ms) */
      readAtById: /** @type {Record<string, number>} */ ({}),

      /** Increments when a new unread is detected — drives bell pulse (optional consumer). */
      arrivalEpoch: 0,

      markRead: (id) =>
        set((s) => ({
          readAtById: { ...s.readAtById, [id]: Date.now() },
        })),

      markAllRead: (ids) =>
        set((s) => {
          const next = { ...s.readAtById };
          const t = Date.now();
          for (const id of ids) next[id] = t;
          return { readAtById: next };
        }),

      bumpArrival: () => set((s) => ({ arrivalEpoch: s.arrivalEpoch + 1 })),

      isRead: (id) => Boolean(get().readAtById[id]),

      reset: () => set({ readAtById: {}, arrivalEpoch: 0 }),
    }),
    {
      name: 'genesis-notifications-v1',
      partialize: (s) => ({ readAtById: s.readAtById }),
    },
  ),
);
