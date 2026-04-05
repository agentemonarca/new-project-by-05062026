import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * When true, dashboard uses {@link buildFullSimulationDataset} instead of API wallet/network
 * (and augments the operative ledger). For QA / demos — default off.
 */
export const useSimulationModeStore = create(
  persist(
    (set) => ({
      isSimulationMode: false,
      setSimulationMode: (/** @type {boolean} */ v) => set({ isSimulationMode: Boolean(v) }),
      toggleSimulationMode: () => set((s) => ({ isSimulationMode: !s.isSimulationMode })),
    }),
    { name: 'genesis-simulation-mode-v1', partialize: (s) => ({ isSimulationMode: s.isSimulationMode }) },
  ),
);
