import React, { useEffect } from 'react';
import { useGpulseSystem } from '../../context/GpulseContext.jsx';
import { useSystemHealth } from '../../hooks/useSystemHealth.js';

function healthFieldsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.network === b.network &&
    a.signer === b.signer &&
    a.mempool === b.mempool &&
    a.backend === b.backend &&
    a.riskLevel === b.riskLevel
  );
}

/**
 * Keeps GpulseContext.systemHealth aligned with backend /system/health (no UI).
 */
export default function GpulseSystemHealthSync() {
  const { setSystemHealth } = useGpulseSystem();
  const { health } = useSystemHealth({ pollMs: 8000 });

  useEffect(() => {
    setSystemHealth((prev) => (healthFieldsEqual(prev, health) ? prev : health));
  }, [health, setSystemHealth]);

  return null;
}
