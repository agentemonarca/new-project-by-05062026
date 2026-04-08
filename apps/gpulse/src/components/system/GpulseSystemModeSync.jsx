import React, { useEffect } from 'react';
import { useGpulseSystem } from '../../context/GpulseContext.jsx';
import { useSystemMode } from '../../hooks/useSystemMode.js';

/**
 * Keeps GpulseContext.systemMode aligned with decisionEngine (observes health + wallet telemetry).
 */
export default function GpulseSystemModeSync({ transactions = [], queueWaiting = 0 }) {
  const { setSystemMode } = useGpulseSystem();
  const systemMode = useSystemMode({ transactions, queueWaiting });

  useEffect(() => {
    setSystemMode((prev) => (prev === systemMode ? prev : systemMode));
  }, [systemMode, setSystemMode]);

  return null;
}
