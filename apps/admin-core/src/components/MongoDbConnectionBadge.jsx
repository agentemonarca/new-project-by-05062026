import React, { memo, useEffect, useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import { useAdminCore } from '../context/AdminCoreContext.jsx';

/** Etiquetas y estilos por entorno (Genesis → azul, Winx → naranja, G-Pulse → morado). */
const SOURCE_THEME = /** @type {const} */ ({
  genesis: {
    label: 'GENESIS',
    frame:
      'border-sky-500/40 bg-gradient-to-br from-sky-500/[0.14] via-slate-950/40 to-sky-950/20 shadow-[0_0_28px_rgba(56,189,248,0.12)]',
    nameClass: 'font-semibold tracking-wide text-sky-200',
    iconClass: 'text-sky-400',
  },
  winx: {
    label: 'WINX',
    frame:
      'border-amber-500/40 bg-gradient-to-br from-amber-500/[0.14] via-slate-950/40 to-orange-950/20 shadow-[0_0_28px_rgba(251,191,36,0.1)]',
    nameClass: 'font-semibold tracking-wide text-amber-200',
    iconClass: 'text-amber-400',
  },
  gpulse: {
    label: 'GPULSE',
    frame:
      'border-violet-500/45 bg-gradient-to-br from-violet-500/[0.16] via-slate-950/40 to-fuchsia-950/25 shadow-[0_0_28px_rgba(167,139,250,0.14)]',
    nameClass: 'font-semibold tracking-wide text-violet-200',
    iconClass: 'text-violet-400',
  },
});

const REFRESH_MS = 45_000;

/**
 * Color de latencia según RTT del endpoint (fetch + parse JSON):
 * menor de 100 ms verde; 100–300 ms amarillo; mayor de 300 ms rojo.
 * @param {number} ms
 */
function latencyTone(ms) {
  if (ms < 100) {
    return {
      text: 'text-emerald-300',
      chip: 'border-emerald-500/35 bg-emerald-500/[0.12]',
    };
  }
  if (ms <= 300) {
    return {
      text: 'text-amber-300',
      chip: 'border-amber-500/35 bg-amber-500/[0.12]',
    };
  }
  return {
    text: 'text-rose-300',
    chip: 'border-rose-500/35 bg-rose-500/[0.12]',
  };
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function MongoDbConnectionBadgeInner() {
  const { adminApiFetch, adminMongoSource, adminMongoSourceRevision } = useAdminCore();
  const [busy, setBusy] = useState(true);
  const [mongoReady, setMongoReady] = useState(/** @type {boolean | null} */ (null));
  const [fetchErr, setFetchErr] = useState(false);
  const [latencyMs, setLatencyMs] = useState(/** @type {number | null} */ (null));

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      setBusy(true);
      setFetchErr(false);
      try {
        const t0 = nowMs();
        const res = await adminApiFetch('/api/admin/signals/metrics');
        const json = await res.json().catch(() => ({}));
        const elapsed = Math.max(0, Math.round(nowMs() - t0));
        if (cancelled) return;
        if (!res.ok) {
          setFetchErr(true);
          setMongoReady(null);
          setLatencyMs(null);
          return;
        }
        setLatencyMs(elapsed);
        setMongoReady(json.mongoReady === true);
      } catch {
        if (!cancelled) {
          setFetchErr(true);
          setMongoReady(null);
          setLatencyMs(null);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    fetchStatus();

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchStatus();
    }, REFRESH_MS);

    const onVis = () => {
      if (document.visibilityState === 'visible') fetchStatus();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [adminApiFetch, adminMongoSourceRevision]);

  const theme = SOURCE_THEME[adminMongoSource] ?? SOURCE_THEME.genesis;

  const statusLine = (() => {
    if (busy && mongoReady === null && !fetchErr) {
      return (
        <span className="flex items-center gap-1.5 text-slate-400">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-500" aria-hidden />
          Comprobando Mongo…
        </span>
      );
    }
    if (fetchErr) {
      return (
        <span className="text-amber-200/90">
          <span className="text-amber-400" aria-hidden>
            ⚠{' '}
          </span>
          No se pudo verificar el estado
        </span>
      );
    }
    if (mongoReady === true) {
      return (
        <span className="text-emerald-200/95">
          <span className="text-emerald-400" aria-hidden>
            ✔{' '}
          </span>
          Connected
        </span>
      );
    }
    return (
      <span className="text-rose-200/95">
        <span className="text-rose-400" aria-hidden>
          ❌{' '}
        </span>
        Disconnected
      </span>
    );
  })();

  const latencyStyle =
    latencyMs != null && !fetchErr ? latencyTone(latencyMs) : null;

  const ariaLabel = fetchErr
    ? `Base ${theme.label}: error al comprobar Mongo`
    : mongoReady === true
      ? `Connected to ${theme.label}, Mongo conectado${latencyMs != null ? `, latencia ${latencyMs} milisegundos` : ''}`
      : mongoReady === false
        ? `Connected to ${theme.label}, Mongo desconectado${latencyMs != null ? `, latencia ${latencyMs} milisegundos` : ''}`
        : `Connected to ${theme.label}, comprobando`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={`flex min-w-[220px] max-w-[min(100%,340px)] flex-col gap-1 rounded-xl border px-3 py-2 ${theme.frame}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Database className={`h-3.5 w-3.5 shrink-0 ${theme.iconClass}`} aria-hidden />
        <span className="text-[11px] font-medium text-slate-400">Connected to:</span>
        <span className={`text-[11px] ${theme.nameClass}`}>{theme.label}</span>
        {busy && mongoReady !== null ? (
          <Loader2
            className="ml-auto h-3 w-3 shrink-0 animate-spin text-slate-500 sm:ml-1"
            aria-label="Actualizando"
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-white/[0.06] pt-1">
        <div className="min-w-0 text-[11px] font-medium leading-snug">{statusLine}</div>
        {latencyStyle ? (
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${latencyStyle.text} ${latencyStyle.chip}`}
              title="Tiempo de respuesta del endpoint /api/admin/signals/metrics (incl. lectura Mongo)"
            >
              {latencyMs} ms
            </span>
            <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500">
              Latencia API
            </span>
          </div>
        ) : null}
      </div>
      <span className="sr-only">
        mongoReady {mongoReady === true ? 'true' : mongoReady === false ? 'false' : 'unknown'}
        {latencyMs != null ? ` latencyMs ${latencyMs}` : ''}
      </span>
    </div>
  );
}

export const MongoDbConnectionBadge = memo(MongoDbConnectionBadgeInner);
MongoDbConnectionBadge.displayName = 'MongoDbConnectionBadge';
