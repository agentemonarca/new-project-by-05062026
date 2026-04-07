import React, { memo, useEffect, useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { useAdminCore } from '../context/AdminCoreContext.jsx';

/**
 * Datos en vivo desde core-api (`/api/admin/signals/metrics`) respetando `adminMongoSource`.
 * Se refresca cuando cambia `adminMongoSourceRevision`.
 */
function AdminSignalsLivePanelInner() {
  const { adminApiFetch, adminMongoSource, adminMongoSourceRevision } = useAdminCore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [payload, setPayload] = useState(/** @type {Record<string, unknown> | null} */ (null));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await adminApiFetch('/api/admin/signals/metrics');
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof json?.error === 'string' ? json.error : `HTTP ${res.status}`);
          setPayload(null);
        } else {
          setPayload(json && typeof json === 'object' ? json : null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminApiFetch, adminMongoSourceRevision]);

  return (
    <div className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-slate-950/90 to-violet-950/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-400" aria-hidden />
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300/90">
            Señales (API · <span className="font-mono">{adminMongoSource}</span>)
          </p>
        </div>

        {loading ? <Loader2 className="h-4 w-4 animate-spin text-violet-400" aria-label="Cargando" /> : null}
      </div>

      {error ? (
        <p className="mt-2 text-xs text-rose-300/90">
          {error}
          <span className="mt-1 block font-mono text-[10px] text-slate-500">
            ¿Core-api en :5050 y proxy Vite activo?
          </span>
        </p>
      ) : payload && payload.ok !== false ? (
        <div className="mt-3 grid gap-2 font-mono text-sm text-white sm:grid-cols-2">
          <p>
            <span className="text-slate-500">Mongo</span>{' '}
            {payload.mongoReady === false ? (
              <span className="text-amber-300">sin conexión</span>
            ) : (
              <span className="text-emerald-300">ok</span>
            )}
          </p>
          <p>
            <span className="text-slate-500">Señales</span> {String(payload.totalSignals ?? '—')}
          </p>
          <p>
            <span className="text-slate-500">W / L</span> {String(payload.wins ?? 0)} /{' '}
            {String(payload.losses ?? 0)}
          </p>
          <p>
            <span className="text-slate-500">Lat. media</span>{' '}
            {payload.avgLatency != null ? `${payload.avgLatency} ms` : '—'}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Sin datos.</p>
      )}
    </div>
  );
}

export const AdminSignalsLivePanel = memo(AdminSignalsLivePanelInner);
AdminSignalsLivePanel.displayName = 'AdminSignalsLivePanel';
