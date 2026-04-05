import React, { useEffect } from 'react';
import { useGpulseSystem } from '../../context/GpulseContext.jsx';
import { useSystemHealth } from '../../hooks/useSystemHealth.js';

/**
 * Keeps GpulseContext.systemHealth aligned with backend /system/health (no UI).
 */
export default function GpulseSystemHealthSync() {
  const { setSystemHealth } = useGpulseSystem();
  const { health } = useSystemHealth({ pollMs: 8000 });

  useEffect(() => {
    setSystemHealth(health);
  }, [health, setSystemHealth]);

  return null;
}
