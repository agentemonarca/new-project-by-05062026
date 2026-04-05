import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SYSTEM_HEALTH, STALE_SYSTEM_HEALTH } from '../context/GpulseContext.jsx';

function coerceHealth(json) {
  if (!json || typeof json !== 'object') return null;
  const { network, signer, mempool, backend, riskLevel } = json;
  if (typeof network !== 'string' || typeof riskLevel !== 'string') return null;
  return {
    network,
    signer: typeof signer === 'string' ? signer : 'error',
    mempool: typeof mempool === 'string' ? mempool : 'congested',
    backend: typeof backend === 'string' ? backend : 'lagging',
    riskLevel,
  };
}

/**
 * Polls GET {VITE_BACKEND_URL}/system/health. Falls back to DEFAULT_SYSTEM_HEALTH when unreachable.
 */
export function useSystemHealth({ pollMs = 8000 } = {}) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  const fetchHealth = useCallback(async () => {
    const base = String(import.meta.env.VITE_BACKEND_URL || '').trim().replace(/\/$/, '');
    if (!base) {
      if (!alive.current) return;
      setHealth(DEFAULT_SYSTEM_HEALTH);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`${base}/system/health`, { method: 'GET', cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!alive.current) return;
      if (!r.ok) throw new Error(String(j?.reason || `health_${r.status}`));
      const parsed = coerceHealth(j);
      setHealth(parsed || DEFAULT_SYSTEM_HEALTH);
      setError(null);
    } catch (e) {
      if (!alive.current) return;
      setError(e);
      setHealth(STALE_SYSTEM_HEALTH);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    fetchHealth();
    const id = window.setInterval(fetchHealth, pollMs);
    return () => {
      alive.current = false;
      window.clearInterval(id);
    };
  }, [fetchHealth, pollMs]);

  const memoHealth = useMemo(() => health ?? DEFAULT_SYSTEM_HEALTH, [health]);

  return { health: memoHealth, loading, error, refetch: fetchHealth };
}
