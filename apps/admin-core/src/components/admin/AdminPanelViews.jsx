import React, { memo, useSyncExternalStore } from 'react';
import { Activity, Trophy } from 'lucide-react';
import AdminSignalsProPanel from '../AdminSignalsProPanel.jsx';
import { AdminSignalsLivePanel } from '../AdminSignalsLivePanel.jsx';
import { ProviderLiveFeedPanel } from '../ProviderLiveFeedPanel.jsx';
import { RawEventsPanel } from '../RawEventsPanel.jsx';
import { SignalStreamDebugPanel } from '../SignalStreamDebugPanel.jsx';
import { AdminRealtimeTraceDebugPanel } from './AdminRealtimeTraceDebugPanel.jsx';
import ResultCasinoScoreBlock from '../ResultCasinoScoreBlock.jsx';
import { VistaLabPanel } from '../lab/VistaLabPanel.jsx';
import {
  getAdminSignalsLiveServerSnapshot,
  getAdminSignalsLiveSnapshot,
  subscribeAdminSignalsLive,
} from '../../realtime/adminSignalsLiveStore.js';
import { GlobalIntelQuickLink } from '../../gpulse-lab/components/GlobalIntelQuickLink.jsx';

export const AdminSignalsSection = memo(function AdminSignalsSection() {
  return (
    <div className="space-y-6">
      <GlobalIntelQuickLink label="Abrir informe" />
      <AdminSignalsProPanel compact={false} />
    </div>
  );
});

export const AdminLiveSection = memo(function AdminLiveSection() {
  const snap = useSyncExternalStore(
    subscribeAdminSignalsLive,
    getAdminSignalsLiveSnapshot,
    getAdminSignalsLiveServerSnapshot,
  );

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
        style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.6)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${snap.connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-rose-500'}`}
          />
          <span className="text-sm font-medium text-[#EAECEF]">
            Socket {snap.connected ? 'conectado' : 'desconectado'}
          </span>
        </div>
        <span className="text-[11px] text-[#848E9C]">
          Buffer · {snap.signals.length} señales / {snap.results.length} resultados
        </span>
      </div>
      <AdminSignalsLivePanel />
    </div>
  );
});

export const AdminResultsSection = memo(function AdminResultsSection() {
  const snap = useSyncExternalStore(
    subscribeAdminSignalsLive,
    getAdminSignalsLiveSnapshot,
    getAdminSignalsLiveServerSnapshot,
  );

  if (!snap.results.length) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border py-16 text-center"
        style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.5)' }}
      >
        <Trophy className="h-10 w-10 text-[#474D57]" aria-hidden />
        <p className="text-sm font-medium text-[#848E9C]">Sin resultados en buffer</p>
        <p className="max-w-md text-xs text-[#5E6673]">Los NEW_RESULT aparecerán aquí con el bloque de mesa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#848E9C]">
        Últimos resultados · {snap.results.length}
      </p>
      <ul className="space-y-3">
        {snap.results.map((r) => (
          <li
            key={r.recvId}
            className="rounded-xl border p-3 transition-opacity duration-200"
            style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.65)' }}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#848E9C]">
              <span className="font-mono">mesa {String(r.mesa ?? '—')}</span>
              <span
                className="rounded px-2 py-0.5 font-bold uppercase tracking-wide"
                style={{
                  color: r.verdict === 'WIN' ? '#0ECB81' : r.verdict === 'LOSS' ? '#F6465D' : '#EAECEF',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                }}
              >
                {String(r.verdict ?? '—')}
              </span>
            </div>
            <ResultCasinoScoreBlock scoreDetail={r.scoreDetail} ganador={r.ganador} />
          </li>
        ))}
      </ul>
    </div>
  );
});

export const AdminMartingaleSection = memo(function AdminMartingaleSection() {
  const snap = useSyncExternalStore(
    subscribeAdminSignalsLive,
    getAdminSignalsLiveSnapshot,
    getAdminSignalsLiveServerSnapshot,
  );

  if (!snap.signals.length) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border py-16 text-center"
        style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.5)' }}
      >
        <Activity className="h-10 w-10 text-[#474D57]" aria-hidden />
        <p className="text-sm font-medium text-[#848E9C]">Sin señales en buffer</p>
        <p className="max-w-md text-xs text-[#5E6673]">Martingale por mesa según últimas NEW_SIGNAL.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#848E9C]">
        Señales recientes · martingale
      </p>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: '#2B3139' }}>
        <table className="w-full min-w-[480px] text-left text-[12px] text-[#EAECEF]">
          <thead>
            <tr className="border-b text-[10px] uppercase tracking-wider text-[#848E9C]" style={{ borderColor: '#2B3139' }}>
              <th className="px-3 py-2 font-semibold">Mesa</th>
              <th className="px-3 py-2 font-semibold">vector[0]</th>
              <th className="px-3 py-2 font-semibold">Nivel</th>
              <th className="px-3 py-2 font-semibold">Etiqueta</th>
              <th className="px-3 py-2 font-semibold">Ronda</th>
            </tr>
          </thead>
          <tbody>
            {snap.signals.map((s) => (
              <tr key={s.recvId} className="border-b border-[#2B3139]/80 hover:bg-white/[0.03]">
                <td className="px-3 py-2.5 font-mono">{String(s.mesa ?? '—')}</td>
                <td className="px-3 py-2.5 font-mono">
                  {/* DISPLAY ONLY — NOT SOURCE OF TRUTH (operational prediction = contract getPrediction) */}
                  {Array.isArray(s.vector_forecast) && s.vector_forecast[0] != null
                    ? String(s.vector_forecast[0])
                    : '—'}
                </td>
                <td className="px-3 py-2.5 font-mono text-[#FCD535]">{String(s.martingaleLevel ?? 0)}</td>
                <td className="px-3 py-2.5 text-[#B7BDC6]">{String(s.martingale ?? '—')}</td>
                <td className="px-3 py-2.5 font-mono text-[#848E9C]">{String(s.round ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export const AdminAnalyticsSection = memo(function AdminAnalyticsSection() {
  const snap = useSyncExternalStore(
    subscribeAdminSignalsLive,
    getAdminSignalsLiveSnapshot,
    getAdminSignalsLiveServerSnapshot,
  );

  return (
    <div className="space-y-4">
      <GlobalIntelQuickLink label="Informe forense" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: 'Buffer señales', v: snap.signals.length },
          { k: 'Buffer resultados', v: snap.results.length },
          { k: 'Socket', v: snap.connected ? 'OK' : 'Off' },
          { k: 'Rev store', v: snap.rev },
        ].map((c) => (
          <div
            key={c.k}
            className="rounded-xl border px-4 py-3 transition-transform duration-200 hover:translate-y-[-1px]"
            style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.65)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#848E9C]">{c.k}</p>
            <p className="mt-1 text-lg font-semibold text-[#EAECEF]">{c.v}</p>
          </div>
        ))}
      </div>
      <AdminSignalsLivePanel />
    </div>
  );
});

export const AdminDebugSection = memo(function AdminDebugSection() {
  return (
    <div className="space-y-6">
      <GlobalIntelQuickLink label="Ver último análisis" />
      <AdminRealtimeTraceDebugPanel />
      <RawEventsPanel />
      <SignalStreamDebugPanel />
    </div>
  );
});

export const AdminVistaLabSection = memo(function AdminVistaLabSection() {
  return (
    <div className="space-y-6">
      <details className="rounded-xl border border-[#2F81FF]/25 bg-[rgba(47,129,255,0.04)]">
        <summary className="cursor-pointer px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#B7D4FF] marker:content-none [&::-webkit-details-marker]:hidden">
          Feed crudo del socket (opcional)
        </summary>
        <div className="border-t border-[#2F81FF]/20 px-2 pb-2">
          <ProviderLiveFeedPanel />
        </div>
      </details>
      <VistaLabPanel />
    </div>
  );
});
