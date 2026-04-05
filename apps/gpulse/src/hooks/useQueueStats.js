import { useEffect, useState } from 'react';
import { subscribeQueueStatsFromSocket } from '../realtime/queueStatsBridge.js';

const POLL_MS = 8000;

/**
 * Live `{ waiting, active }` from Socket.io `queue:stats` + GET `/system/queue-stats` polling fallback.
 *
 * @param {string} [backendOrigin] — e.g. `http://localhost:5050` (same as API origin)
 * @returns {{ waiting: number, active: number, scaleSignal: string }}
 */
export function useQueueStats(backendOrigin) {
  const [stats, setStats] = useState({ waiting: 0, active: 0, scaleSignal: 'hold' });

  useEffect(() => {
    return subscribeQueueStatsFromSocket((s) => setStats(s));
  }, []);

  useEffect(() => {
    const base = String(backendOrigin || '').trim().replace(/\/$/, '');
    if (!base || typeof window === 'undefined') return undefined;

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const r = await fetch(`${base}/system/queue-stats`, { cache: 'no-store' });
        if (!r.ok || cancelled) return;
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        const ss = String(j.scaleSignal || 'hold').toLowerCase();
        const scaleSignal = ss === 'scale_up' || ss === 'scale_down' ? ss : 'hold';
        setStats({
          waiting: Math.max(0, Number(j.waiting) || 0),
          active: Math.max(0, Number(j.active) || 0),
          scaleSignal,
        });
      } catch {
        /* offline / CORS — keep last socket values */
      }
    };

    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [backendOrigin]);

  return stats;
}
