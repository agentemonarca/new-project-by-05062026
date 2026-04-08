import React, { memo } from 'react';
import { Activity } from 'lucide-react';
import { AdminSignalsLivePanel } from '../components/AdminSignalsLivePanel.jsx';
import AdminSignalsProPanel from '../components/AdminSignalsProPanel.jsx';
import { RawEventsPanel } from '../components/RawEventsPanel.jsx';
import { SignalStreamDebugPanel } from '../components/SignalStreamDebugPanel.jsx';

/**
 * Vista señales legacy — el router ya no monta esta página; el panel único es `AdminPanel` en `/admin`.
 */
function AdminSignalsPageInner() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500/90">Señales</p>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold text-white">
          <Activity className="h-7 w-7 text-violet-400" aria-hidden />
          Control de señales
        </h2>
        <p className="text-sm text-slate-500">
          Métricas en vivo desde el core-api según la base Mongo seleccionada en la barra superior.
        </p>
      </div>
      <RawEventsPanel />
      <AdminSignalsProPanel compact={false} />
      <AdminSignalsLivePanel />
      <SignalStreamDebugPanel />
    </div>
  );
}

export const AdminSignalsPage = memo(AdminSignalsPageInner);
AdminSignalsPage.displayName = 'AdminSignalsPage';
