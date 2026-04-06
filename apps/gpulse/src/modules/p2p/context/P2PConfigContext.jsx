import React, { createContext, useContext, useMemo, useRef } from 'react';
import { useP2PConfigStore } from '../store/p2pConfigStore.js';

/** @typedef {{ getConfig: () => import('../store/p2pConfigTypes.js').P2PConfig, updateConfig: (p: Record<string, unknown>) => void, resetConfig: () => void }} P2PConfigApi */

const P2PConfigContext = createContext(/** @type {P2PConfigApi | null} */ (null));

/**
 * Mount once above P2P UI and admin settings so config API is explicit (store remains SSOT).
 * Renders children only — subscribers should use `useP2PConfigStore` with narrow selectors.
 */
export function P2PConfigProvider({ children }) {
  const apiRef = useRef(/** @type {P2PConfigApi | null} */ (null));
  if (!apiRef.current) {
    apiRef.current = {
      getConfig: () => useP2PConfigStore.getState().getConfig(),
      updateConfig: (p) => useP2PConfigStore.getState().updateConfig(p),
      resetConfig: () => useP2PConfigStore.getState().resetConfig(),
    };
  }
  const value = useMemo(() => apiRef.current, []);
  return <P2PConfigContext.Provider value={value}>{children}</P2PConfigContext.Provider>;
}

/** @returns {P2PConfigApi} */
export function useP2PConfigApi() {
  const ctx = useContext(P2PConfigContext);
  if (!ctx) {
    throw new Error('useP2PConfigApi must be used within P2PConfigProvider');
  }
  return ctx;
}

/**
 * Safe variant when provider is optional (falls back to store imperative API).
 * @returns {P2PConfigApi}
 */
export function useP2PConfigApiSafe() {
  const ctx = useContext(P2PConfigContext);
  return useMemo(
    () =>
      ctx ?? {
        getConfig: () => useP2PConfigStore.getState().getConfig(),
        updateConfig: (p) => useP2PConfigStore.getState().updateConfig(p),
        resetConfig: () => useP2PConfigStore.getState().resetConfig(),
      },
    [ctx],
  );
}
