import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * UI-only preferences (debug logging toggle for GPulse Lab).
 */
export const useGpulseLabUiStore = create(
  persist(
    (set) => ({
      debugLogging: false,
      setDebugLogging: (value) => set({ debugLogging: Boolean(value) }),

      /** Forces a remount for UI self-heal (nonce increments). */
      uiRefreshNonce: 0,
      bumpUiRefreshNonce: () => set((s) => ({ uiRefreshNonce: (s.uiRefreshNonce ?? 0) + 1 })),

      /** Highlight a mesa in UI for a short time. */
      highlightMesaId: null,
      highlightUntilTs: null,
      setHighlightMesa: (mesaId, ms = 1600) =>
        set({
          highlightMesaId: mesaId != null ? String(mesaId) : null,
          highlightUntilTs: Date.now() + Math.max(0, Number(ms) || 0),
        }),
      clearHighlight: () => set({ highlightMesaId: null, highlightUntilTs: null }),

      /** Cycle X-Ray forensics panel (correlation, timeline, resync). */
      cycleXRayOpen: false,
      /** @type {{ correlationKey?: string | null, mesaId?: string | null, cycleId?: string | null, alertId?: string | null } | null} */
      cycleXRayTarget: null,
      openCycleXRay: (target) =>
        set({
          cycleXRayOpen: true,
          cycleXRayTarget: target != null && typeof target === 'object' ? { ...target } : {},
        }),
      closeCycleXRay: () => set({ cycleXRayOpen: false, cycleXRayTarget: null }),

      /** Animated cycle replay (Control Center Elite). */
      cycleReplayOpen: false,
      cycleReplayMesaId: null,
      /** @type {unknown} */
      cycleReplaySnapshot: null,
      openCycleReplay: (opts) =>
        set({
          cycleReplayOpen: true,
          cycleReplayMesaId: opts?.mesaId != null ? String(opts.mesaId) : null,
          cycleReplaySnapshot: opts?.snapshot ?? null,
        }),
      closeCycleReplay: () => set({ cycleReplayOpen: false, cycleReplayMesaId: null, cycleReplaySnapshot: null }),

      /** Toast notifications (UI only). */
      toasts: [],
      pushToast: (t) =>
        set((s) => ({
          toasts: [{ ...t, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }, ...(s.toasts ?? [])].slice(0, 6),
        })),
      dismissToast: (id) => set((s) => ({ toasts: (s.toasts ?? []).filter((x) => x.id !== id) })),
    }),
    {
      name: 'gpulse-lab-ui',
      partialize: (state) => ({ debugLogging: state.debugLogging }),
    },
  ),
);
