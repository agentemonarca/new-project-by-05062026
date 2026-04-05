import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Mandatory terms gate — first login / session with AiGenesis product UI.
 * Legal copy is shown in TermsAcceptanceModal; this store only tracks acceptance.
 */
export const useTermsAcceptanceStore = create(
  persist(
    (set) => ({
      /** User has accepted the usage agreement (blocking gate lifted). */
      acceptedTerms: false,
      /** Unix ms when accepted; null until accepted. */
      acceptedAt: /** @type {number | null} */ (null),

      acceptTerms: () =>
        set({
          acceptedTerms: true,
          acceptedAt: Date.now(),
        }),

      /** Dev / QA only — call from console if needed. */
      __resetTermsAcceptance: () =>
        set({
          acceptedTerms: false,
          acceptedAt: null,
        }),
    }),
    {
      name: 'genesis-terms-acceptance-v1',
      partialize: (s) => ({ acceptedTerms: s.acceptedTerms, acceptedAt: s.acceptedAt }),
    },
  ),
);
