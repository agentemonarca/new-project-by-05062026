import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** When true (default), Genesis dashboard cannot enable fake wallet / ledger simulation. Set to 0 to allow QA toggles. */
const SIMULATION_MODE_LOCKED =
  String(import.meta.env.VITE_GPULSE_DISABLE_SIMULATION_MODE ?? '1').trim() === '1';

/**
 * When true, dashboard uses {@link buildFullSimulationDataset} instead of API wallet/network
 * (and augments the operative ledger). For QA / demos — default off.
 */
export const useSimulationModeStore = create(
  persist(
    (set) => ({
      isSimulationMode: false,
      setSimulationMode: (/** @type {boolean} */ v) =>
        SIMULATION_MODE_LOCKED ? set({ isSimulationMode: false }) : set({ isSimulationMode: Boolean(v) }),
      toggleSimulationMode: () =>
        SIMULATION_MODE_LOCKED
          ? set({ isSimulationMode: false })
          : set((s) => ({ isSimulationMode: !s.isSimulationMode })),
    }),
    {
      name: 'genesis-simulation-mode-v1',
      partialize: (s) => ({ isSimulationMode: SIMULATION_MODE_LOCKED ? false : s.isSimulationMode }),
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        isSimulationMode: SIMULATION_MODE_LOCKED ? false : Boolean(persisted?.isSimulationMode ?? current.isSimulationMode),
      }),
    },
  ),
);
