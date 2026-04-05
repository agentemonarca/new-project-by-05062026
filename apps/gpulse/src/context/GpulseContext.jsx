import React, { createContext, useContext, useMemo, useState } from 'react';
import { DEFAULT_SYSTEM_MODE } from '../system/decisionEngine.js';

/** Canonical visual/runtime phases for G-Pulse Core & control panel. */
export const GPULSE_STATE = Object.freeze({
  IDLE: 'IDLE',
  PROCESSING: 'PROCESSING',
  SIGNING: 'SIGNING',
  BROADCASTING: 'BROADCASTING',
  CONFIRMING: 'CONFIRMING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
});

/**
 * G-Pulse runtime state (widescreen / transaction flow UI).
 * Subscribing here does NOT re-render on systemHealth / systemMode changes.
 */
const GpulseRuntimeContext = createContext(null);

/**
 * System health + mode (TrustPulse / Core / control panel indicators).
 * Subscribing here does NOT re-render on runtime `state` changes.
 */
const GpulseSystemContext = createContext(null);

/** Neutral defaults when health is unknown or the API is not configured. */
export const DEFAULT_SYSTEM_HEALTH = Object.freeze({
  network: 'unknown',
  signer: 'ok',
  mempool: 'clear',
  backend: 'ok',
  riskLevel: 'low',
});

/** Applied when a health fetch fails (stale / unreachable). Matches `/system/health` field shape. */
export const STALE_SYSTEM_HEALTH = Object.freeze({
  network: 'offline',
  signer: 'error',
  mempool: 'congested',
  backend: 'lagging',
  riskLevel: 'high',
});

export function GpulseProvider({ children }) {
  const [state, setState] = useState('PREPARANDO_RECONEXION');
  const [systemHealth, setSystemHealth] = useState(DEFAULT_SYSTEM_HEALTH);
  /** Decision-engine mode string (`NORMAL_MODE`, `DELAYED_MODE`, …) — not a network config object. */
  const [systemMode, setSystemMode] = useState(DEFAULT_SYSTEM_MODE);

  const runtimeValue = useMemo(() => ({ state, setState }), [state]);
  const systemValue = useMemo(
    () => ({ systemHealth, setSystemHealth, systemMode, setSystemMode }),
    [systemHealth, systemMode],
  );

  return (
    <GpulseRuntimeContext.Provider value={runtimeValue}>
      <GpulseSystemContext.Provider value={systemValue}>{children}</GpulseSystemContext.Provider>
    </GpulseRuntimeContext.Provider>
  );
}


export function useGpulseRuntime() {
  const ctx = useContext(GpulseRuntimeContext);
  if (!ctx) {
    throw new Error('useGpulseRuntime must be used within a GpulseProvider');
  }
  return ctx;
}

export function useGpulseSystem() {
  const ctx = useContext(GpulseSystemContext);
  if (!ctx) {
    throw new Error('useGpulseSystem must be used within a GpulseProvider');
  }
  return ctx;
}

/** Compose runtime + system — use only when both slices are needed. */
export function useGpulse() {
  const runtime = useGpulseRuntime();
  const system = useGpulseSystem();
  return useMemo(() => ({ ...runtime, ...system }), [runtime, system]);
}

export default GpulseProvider;
