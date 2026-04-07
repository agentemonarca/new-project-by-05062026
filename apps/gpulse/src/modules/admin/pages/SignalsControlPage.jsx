import React, { useEffect } from 'react';
import { useExternalSignals } from '@/ui-genesis/hooks/useExternalSignals.js';
import {
  isExternalSignalsBffEnabled,
  isExternalSignalsEnabled,
} from '@/ui-genesis/lib/externalSignalsConfig.js';
import { useExternalSignalsStore } from '@/ui-genesis/stores/externalSignalsStore.js';
import { useAdminSignalsStore } from '../../../ui-genesis/stores/adminSignalsStore.js';
import { adminSignalsFetch } from '../../../ui-genesis/lib/adminSignalsApi.js';
import { useAdminSignalsPolling } from '@/ui-genesis/hooks/useAdminSignalsPolling.js';
import { useAdminSignalsPollingStore } from '@/ui-genesis/stores/adminSignalsPollingStore.js';
import { useSignalExecution } from '@/ui-genesis/hooks/useSignalExecution.js';
import { GradientButton } from '@/ui-genesis/components/GradientButton.jsx';
import { AdminPageHeader } from './AdminPageHeader.jsx';
import { AdminSignalLiveFeed } from '../components/signals/AdminSignalLiveFeed.jsx';
import { AdminSignalParsedView } from '../components/signals/AdminSignalParsedView.jsx';
import { AdminSignalUserView } from '../components/signals/AdminSignalUserView.jsx';
import { AdminSignalControls } from '../components/signals/AdminSignalControls.jsx';
import { AdminSignalStats } from '../components/signals/AdminSignalStats.jsx';
import { AdminSignalHistory } from '../components/signals/AdminSignalHistory.jsx';
import { AdminSignalMetricsChart } from '../components/signals/AdminSignalMetricsChart.jsx';
import { AdminSignalAlerts } from '../components/signals/AdminSignalAlerts.jsx';
import { AdminSignalDailyAlerts } from '../components/signals/AdminSignalDailyAlerts.jsx';
import { AdminSignalAutoResponse } from '../components/signals/AdminSignalAutoResponse.jsx';
import { RawEventsPanel } from '../components/signals/RawEventsPanel.jsx';

/**
 * Signals Control — Admin Global · /admin/signals
 * Stream BFF o directo; controles en adminSignalsStore; métricas cliente + API.
 */
export function SignalsControlPage() {
  const bff = isExternalSignalsBffEnabled();
  const direct = isExternalSignalsEnabled();
  useExternalSignals({ enabled: bff || direct, preferBff: bff });
  useAdminSignalsPolling();
  useSignalExecution();

  useEffect(() => {
    adminSignalsFetch('/api/admin/signals/config')
      .then(async (r) => {
        useAdminSignalsPollingStore.getState().resumePolling();
        let j = null;
        try {
          j = await r.json();
        } catch {
          j = null;
        }
        if (j?.ok && j.config) useAdminSignalsStore.getState().hydrateFromServer(j.config);
        else useAdminSignalsStore.getState().rehydrateSyncExternal();
      })
      .catch(() => useAdminSignalsStore.getState().rehydrateSyncExternal());
  }, []);

  const resetSignalIntelMetrics = useExternalSignalsStore((s) => s.resetSignalIntelMetrics);
  const correlationErrors = useExternalSignalsStore((s) => s.signalIntelMetrics.correlationErrors);

  const resetServer = () => {
    adminSignalsFetch('/api/admin/signals/reset-metrics', { method: 'POST' }).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Signals · BFF"
        title="Signals Control"
        subtitle="Inteligencia operativa en tiempo real: feed en bruto, interpretación GPulse, vista usuario, stats cliente/servidor y controles hacia AutoPlay."
      >
        <div className="flex flex-wrap gap-2">
          <GradientButton
            type="button"
            variant="ghost"
            className="!border-white/10 !bg-white/[0.04] !py-2 !text-xs !text-slate-200"
            onClick={() => resetSignalIntelMetrics()}
          >
            Reset métricas cliente
            {correlationErrors > 0 ? (
              <span className="ml-1.5 font-mono text-rose-300/90">({correlationErrors})</span>
            ) : null}
          </GradientButton>
          <GradientButton
            type="button"
            variant="ghost"
            className="!border-violet-500/20 !bg-violet-500/10 !py-2 !text-xs !text-violet-100"
            onClick={() => resetServer()}
          >
            Reset métricas core
          </GradientButton>
        </div>
      </AdminPageHeader>

      <RawEventsPanel />

      <section>
        <AdminSignalAlerts />
      </section>

      {!bff && !direct ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100/95">
          Activa{' '}
          <span className="font-mono text-amber-200/90">VITE_EXTERNAL_SIGNALS_BFF=1</span> (recomendado, apiKey
          en servidor) o <span className="font-mono">VITE_EXTERNAL_SIGNALS_ENABLED=1</span> (directo) en{' '}
          <span className="font-mono">apps/gpulse/.env</span>.
        </p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-rose-400/90">Live feed</h2>
          <AdminSignalLiveFeed />
        </div>
        <div className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400/90">User view</h2>
          <AdminSignalUserView />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-2 xl:col-span-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300/90">Interpretation</h2>
          <AdminSignalParsedView />
        </div>
        <div className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400/90">Historial</h2>
          <AdminSignalHistory />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/90">Stats</h2>
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/70 p-4">
          <AdminSignalStats />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300/90">
          Histórico multi-día
        </h2>
        <AdminSignalDailyAlerts />
        <AdminSignalAutoResponse />
        <AdminSignalMetricsChart />
      </section>

      <section>
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/90">Controls</h2>
        <AdminSignalControls />
      </section>
    </div>
  );
}
