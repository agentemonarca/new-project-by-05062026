import React, { createContext, useContext, useMemo } from 'react';
import { TX_FLOW_STATE } from '../components/web3/TransactionFlowModal.jsx';

export const SYSTEM_CORE_PHASE = {
  IDLE: 'IDLE',
  PROCESSING: 'PROCESSING',
  CONFIRMING: 'CONFIRMING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
};

export function deriveSystemCorePhase(txOpen, txState, isRunning, aiBusy) {
  const s = String(txState || TX_FLOW_STATE.IDLE);
  if (txOpen) {
    if (s === TX_FLOW_STATE.ERROR) return SYSTEM_CORE_PHASE.ERROR;
    if (s === TX_FLOW_STATE.SUCCESS) return SYSTEM_CORE_PHASE.SUCCESS;
    if (s === TX_FLOW_STATE.CONFIRMING) return SYSTEM_CORE_PHASE.CONFIRMING;
    if (
      s === TX_FLOW_STATE.CONNECTING ||
      s === TX_FLOW_STATE.SIGNING ||
      s === TX_FLOW_STATE.BROADCASTING
    ) {
      return SYSTEM_CORE_PHASE.PROCESSING;
    }
  }
  if (isRunning || aiBusy) return SYSTEM_CORE_PHASE.PROCESSING;
  return SYSTEM_CORE_PHASE.IDLE;
}

export function systemCoreTooltip(phase) {
  switch (phase) {
    case SYSTEM_CORE_PHASE.PROCESSING:
      return 'Processing…';
    case SYSTEM_CORE_PHASE.CONFIRMING:
      return 'Confirming…';
    case SYSTEM_CORE_PHASE.SUCCESS:
      return 'Complete';
    case SYSTEM_CORE_PHASE.ERROR:
      return 'Needs attention';
    default:
      return 'System active — ready';
  }
}

export function systemCoreAriaLabel(phase) {
  switch (phase) {
    case SYSTEM_CORE_PHASE.PROCESSING:
      return 'G-Pulse core — processing';
    case SYSTEM_CORE_PHASE.CONFIRMING:
      return 'G-Pulse core — confirming';
    case SYSTEM_CORE_PHASE.SUCCESS:
      return 'G-Pulse core — complete';
    case SYSTEM_CORE_PHASE.ERROR:
      return 'G-Pulse core — error';
    default:
      return 'G-Pulse system core — ready';
  }
}

const GpulseSystemCoreContext = createContext(null);

/**
 * Single source of truth for unified G-Pulse system visuals (TX flow + runtime activity).
 */
export function GpulseSystemCoreProvider({ children, txOpen, txState, isRunning, aiFlowBusy }) {
  const phase = useMemo(
    () => deriveSystemCorePhase(txOpen, txState, isRunning, aiFlowBusy),
    [txOpen, txState, isRunning, aiFlowBusy],
  );

  const value = useMemo(
    () => ({
      phase,
      tooltip: systemCoreTooltip(phase),
      ariaLabel: systemCoreAriaLabel(phase),
    }),
    [phase],
  );

  return (
    <GpulseSystemCoreContext.Provider value={value}>{children}</GpulseSystemCoreContext.Provider>
  );
}

export function useGpulseSystemCore() {
  const ctx = useContext(GpulseSystemCoreContext);
  if (!ctx) {
    throw new Error('useGpulseSystemCore must be used within GpulseSystemCoreProvider');
  }
  return ctx;
}
