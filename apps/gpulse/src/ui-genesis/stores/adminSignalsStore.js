import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useExternalSignalsStore } from './externalSignalsStore.js';

function syncToExternalIntel(get) {
  const s = get();
  useExternalSignalsStore.getState().patchSignalIntelControls({
    showSignalsToUsers: s.visibilityEnabled,
    artificialDelayMs: s.delayMs,
    mesaFilter: s.filters?.mesa ?? '',
    martingaleDisplayDelta: s.overrides?.martingale ?? 0,
  });
}

/**
 * Estado global del Admin — Signals Control (independiente del ingest; sincroniza presentación al externalSignalsStore).
 */
export const useAdminSignalsStore = create(
  persist(
    (set, get) => ({
      visibilityEnabled: true,
      delayMs: 0,
      filters: { mesa: '' },
      overrides: { martingale: 0 },
      debugShowRaw: false,
      syncRemoteConfig: true,
      /** 401 en endpoints admin signals (no persistir). */
      serverAuthDenied: false,

      setVisibilityEnabled: (v) => {
        set({ visibilityEnabled: Boolean(v) });
        syncToExternalIntel(get);
      },
      setDelayMs: (n) => {
        set({ delayMs: Math.max(0, Number(n) || 0) });
        syncToExternalIntel(get);
      },
      setMesaFilter: (mesa) => {
        set((state) => ({ filters: { ...state.filters, mesa: String(mesa ?? '') } }));
        syncToExternalIntel(get);
      },
      setMartingaleOverride: (n) => {
        set((state) => ({
          overrides: { ...state.overrides, martingale: Number(n) || 0 },
        }));
        syncToExternalIntel(get);
      },
      setDebugShowRaw: (v) => set({ debugShowRaw: Boolean(v) }),
      setSyncRemoteConfig: (v) => set({ syncRemoteConfig: Boolean(v) }),
      setServerAuthDenied: (v) => set({ serverAuthDenied: Boolean(v) }),

      /** Tras hidratar persist, alinear Zustand ingest. */
      rehydrateSyncExternal: () => syncToExternalIntel(get),

      /** Hidratar desde GET /api/admin/signals/config (Mongo / runtime API). */
      hydrateFromServer: (config) => {
        if (!config || typeof config !== 'object') return;
        set({
          visibilityEnabled:
            config.showSignalsToUsers ?? config.visibilityEnabled ?? get().visibilityEnabled,
          delayMs: Math.max(
            0,
            Number(config.artificialDelayMs ?? config.delayMs ?? get().delayMs) || 0,
          ),
          filters: {
            mesa: String(config.filters?.mesa ?? get().filters.mesa ?? ''),
          },
          overrides: {
            martingale:
              Number(config.martingaleDelta ?? config.martingaleDisplayDelta ?? get().overrides.martingale) ||
              0,
          },
        });
        syncToExternalIntel(get);
      },
    }),
    {
      name: 'gpulse-admin-signals-v1',
      partialize: (s) => ({
        visibilityEnabled: s.visibilityEnabled,
        delayMs: s.delayMs,
        filters: s.filters,
        overrides: s.overrides,
        debugShowRaw: s.debugShowRaw,
        syncRemoteConfig: s.syncRemoteConfig,
      }),
    },
  ),
);
