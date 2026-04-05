import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Dashboard / lobby density: Lite (essential only) vs Pro (full metrics and modules).
 * @typedef {'lite'|'pro'} UiMode
 */

export const useUiModeStore = create(
  persist(
    (set) => ({
      /** @type {UiMode} */
      uiMode: /** @type {UiMode} */ ('lite'),
      /** @param {UiMode} mode */
      setUiMode: (mode) => set({ uiMode: mode }),
      toggleUiMode: () => set((s) => ({ uiMode: s.uiMode === 'lite' ? 'pro' : 'lite' })),
    }),
    {
      name: 'genesis-ui-mode-v1',
      partialize: (s) => ({ uiMode: s.uiMode }),
    },
  ),
);
