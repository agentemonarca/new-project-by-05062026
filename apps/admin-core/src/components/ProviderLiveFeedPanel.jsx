import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Radio, Trash2 } from 'lucide-react';
import { subscribeAdminSignalsLive } from '../realtime/adminSignalsLiveStore.js';
import { clearRawEvents, getRawStats, subscribe } from '../store/rawEventsStore.js';

const SHOWN = 35;

/** @param {unknown} obj */
function safePrettyJson(obj) {
  try {
    return JSON.stringify(
      obj,
      (_, v) => {
        if (typeof v === 'bigint') return v.toString();
        if (v instanceof Error) return { message: v.message, name: v.name };
        return v;
      },
      2,
    );
  } catch {
    try {
      return String(obj);
    } catch {
      return '[no serializable]';
    }
  }
}

/**
 * Cuadro único: todo lo que entra por el socket `/admin-signals` tal cual (misma fuente que el ingest).
 * Sirve para comparar con VistaLab / store y ver qué no se refleja.
 */
function ProviderLiveFeedPanelInner() {
  const [stats, setStats] = useState(() => getRawStats());
  const listRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  useEffect(() => {
    return subscribeAdminSignalsLive(() => {});
  }, []);

  useEffect(() => {
    return subscribe(() => setStats(getRawStats()));
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [stats.events]);

  const onClear = useCallback(() => {
    clearRawEvents();
  }, []);

  const recent = useMemo(() => stats.events.slice(0, SHOWN), [stats.events]);

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: '#2F81FF', backgroundColor: 'rgba(47, 129, 255, 0.06)' }}
      data-testid="provider-live-feed-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 shrink-0 text-[#2F81FF]" aria-hidden />
            <p className="text-xs font-bold uppercase tracking-wider text-[#B7D4FF]">
              Proveedor · datos en vivo (socket)
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-[#848E9C]">
            Mismo flujo que recibe el admin: cada evento Socket.IO con su payload completo (sin recortes). Últimos{' '}
            <span className="font-mono text-[#EAECEF]">{SHOWN}</span> mensajes; historial interno hasta{' '}
            <span className="font-mono text-[#EAECEF]">100</span>. Si aquí ves un campo y en VistaLab no, el fallo está en
            formateo o en la UI.
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-[#0D1117] px-3 py-1.5 text-[11px] font-semibold text-[#EAECEF] transition hover:border-rose-400/40 hover:bg-rose-950/25 hover:text-rose-100"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Limpiar
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[#5E6673]">
        <span>
          Eventos distintos: <span className="font-mono text-[#848E9C]">{Object.keys(stats.counters).length}</span>
        </span>
      </div>

      <div
        ref={listRef}
        className="custom-scrollbar mt-3 max-h-[min(70vh,720px)] overflow-y-auto overflow-x-hidden rounded-lg border"
        style={{ borderColor: '#2B3139', backgroundColor: 'rgba(0,0,0,0.35)' }}
      >
        {recent.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#5E6673]">Esperando tráfico del proveedor…</p>
        ) : (
          <ul className="divide-y divide-[#2B3139]">
            {recent.map((row, idx) => {
              const t =
                row.receivedAt != null
                  ? new Date(row.receivedAt).toISOString().replace('T', ' ').slice(0, 23)
                  : '—';
              return (
                <li key={`${row.receivedAt ?? 0}-${row.eventName}-${idx}`} className="p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="font-mono font-bold text-[#FCD535]">{t}</span>
                    <span className="rounded border border-[#474D57] bg-[#1C2127] px-1.5 py-0.5 font-mono text-[#0ECB81]">
                      {row.eventName}
                    </span>
                    <span className="font-mono text-[#848E9C]">inferido: {row.type}</span>
                  </div>
                  <pre
                    className="custom-scrollbar max-h-96 overflow-auto whitespace-pre-wrap break-words rounded border border-[#2B3139] bg-[#0D1117] p-3 font-mono text-[10px] leading-relaxed text-[#C8CDD4]"
                    style={{ tabSize: 2 }}
                  >
                    {safePrettyJson(row.payload)}
                  </pre>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export const ProviderLiveFeedPanel = memo(ProviderLiveFeedPanelInner);
ProviderLiveFeedPanel.displayName = 'ProviderLiveFeedPanel';
