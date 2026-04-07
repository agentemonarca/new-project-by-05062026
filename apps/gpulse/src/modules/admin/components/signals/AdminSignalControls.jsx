import React, { useEffect, useMemo } from 'react';
import { Sliders } from 'lucide-react';
import { useExternalSignalsStore } from '@/ui-genesis/stores/externalSignalsStore.js';
import { useAdminSignalsStore } from '@/ui-genesis/stores/adminSignalsStore.js';
import { adminSignalsFetch } from '@/ui-genesis/lib/adminSignalsApi.js';
/**
 * Controles Signals Control — Zustand admin + POST /api/admin/signals/config (persiste Mongo cuando hay DB).
 */
export function AdminSignalControls({ className = '' }) {
  const activeSignals = useExternalSignalsStore((s) => s.activeSignals);
  const history = useExternalSignalsStore((s) => s.history);
  const adminRawFeed = useExternalSignalsStore((s) => s.adminRawFeed);

  const visibilityEnabled = useAdminSignalsStore((s) => s.visibilityEnabled);
  const delayMs = useAdminSignalsStore((s) => s.delayMs);
  const filters = useAdminSignalsStore((s) => s.filters);
  const overrides = useAdminSignalsStore((s) => s.overrides);
  const debugShowRaw = useAdminSignalsStore((s) => s.debugShowRaw);
  const syncRemoteConfig = useAdminSignalsStore((s) => s.syncRemoteConfig);
  const setVisibilityEnabled = useAdminSignalsStore((s) => s.setVisibilityEnabled);
  const setDelayMs = useAdminSignalsStore((s) => s.setDelayMs);
  const setMesaFilter = useAdminSignalsStore((s) => s.setMesaFilter);
  const setMartingaleOverride = useAdminSignalsStore((s) => s.setMartingaleOverride);
  const setDebugShowRaw = useAdminSignalsStore((s) => s.setDebugShowRaw);
  const setSyncRemoteConfig = useAdminSignalsStore((s) => s.setSyncRemoteConfig);

  useEffect(() => {
    if (!syncRemoteConfig) return undefined;
    const t = window.setTimeout(() => {
      adminSignalsFetch('/api/admin/signals/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          showSignalsToUsers: visibilityEnabled,
          artificialDelayMs: delayMs,
          martingaleDelta: overrides.martingale,
          filters: { mesa: filters.mesa ?? '' },
        }),
      }).catch(() => {});
    }, 450);
    return () => window.clearTimeout(t);
  }, [syncRemoteConfig, visibilityEnabled, delayMs, filters.mesa, overrides.martingale]);

  const mesaSuggestions = useMemo(() => {
    const set = new Set();
    for (const r of activeSignals) {
      if (r.mesa) set.add(String(r.mesa));
    }
    for (const r of history) {
      if (r.mesa) set.add(String(r.mesa));
    }
    for (const e of adminRawFeed.slice(0, 40)) {
      if (e.mesa && e.mesa !== '—') set.add(String(e.mesa));
    }
    return Array.from(set).sort().slice(0, 24);
  }, [activeSignals, history, adminRawFeed]);

  return (
    <div className={`rounded-2xl border border-cyan-500/15 bg-slate-950/75 shadow-[inset_0_1px_0_rgba(34,211,238,0.05)] ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <Sliders className="h-4 w-4 text-cyan-300/80" strokeWidth={2} />
        <div>
          <h3 className="text-sm font-semibold text-white">Controls panel</h3>
          <p className="text-[11px] text-slate-500">
            Presentación usuario · delay ingest · martingala UI · filtro mesa · debug raw · sync POST
            guarda en Mongo cuando <span className="font-mono text-slate-400">MONGO_URI</span> está activo
          </p>
        </div>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-white/[0.08] bg-black/25 p-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Señales ON/OFF (usuarios)
          </span>
          <span className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-cyan-500/40"
              checked={visibilityEnabled}
              onChange={(e) => setVisibilityEnabled(e.target.checked)}
            />
            {visibilityEnabled ? 'Visible en Genesis / Lobby' : 'Oculto para usuarios finales'}
          </span>
        </label>

        <label className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-black/25 p-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Delay artificial (ms)</span>
          <input
            type="number"
            min={0}
            step={50}
            value={delayMs}
            onChange={(e) => setDelayMs(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-cyan-500/40"
          />
          <span className="text-[10px] text-slate-500">Cliente + servidor (cuando sync BFF).</span>
        </label>

        <label className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-black/25 p-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Override martingala (UI)</span>
          <input
            type="number"
            step={1}
            value={overrides.martingale}
            onChange={(e) => setMartingaleOverride(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-cyan-500/40"
          />
          <span className="text-[10px] text-slate-500">Suma al valor mostrado; no altera payload proveedor.</span>
        </label>

        <label className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-black/25 p-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Filtro mesa</span>
          <input
            type="text"
            list="signals-control-mesa-datalist"
            placeholder="Vacío = todas"
            value={filters.mesa}
            onChange={(e) => setMesaFilter(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/40"
          />
          <datalist id="signals-control-mesa-datalist">
            {mesaSuggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-black/25 p-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Modo debug (raw)</span>
          <span className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/20 bg-black/40 text-violet-400 focus:ring-violet-500/40"
              checked={debugShowRaw}
              onChange={(e) => setDebugShowRaw(e.target.checked)}
            />
            Ver payload crudo en vista usuario
          </span>
          <label className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-white/20 bg-black/40"
              checked={syncRemoteConfig}
              onChange={(e) => setSyncRemoteConfig(e.target.checked)}
            />
            Sincronizar con API admin
          </label>
        </label>
      </div>
    </div>
  );
}
