import React, { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAdminCore } from '../../context/AdminCoreContext.jsx';
import AdminSignalsProPanel from '../../components/AdminSignalsProPanel.jsx';
import { Users, Wallet, ArrowLeftRight, Activity } from 'lucide-react';

function GlobalOverviewModuleInner() {
  const { currentProjectMeta, projectUsers, projectWalletLedger, projectOrders, isSwitchingProject } = useAdminCore();

  const stats = useMemo(() => {
    const vol = projectOrders.reduce((s, o) => s + Number(o.amount || 0) * Number(o.price || 0), 0);
    const pendingTx = projectWalletLedger.filter((t) => t.status === 'pending').length;
    return { vol, pendingTx, users: projectUsers.length };
  }, [projectUsers, projectWalletLedger, projectOrders]);

  const cards = [
    { label: 'Usuarios activos', value: stats.users, icon: Users, tone: 'text-cyan-300' },
    { label: 'Pendientes tesorería', value: stats.pendingTx, icon: Wallet, tone: 'text-amber-300' },
    { label: 'Órdenes abiertas', value: projectOrders.filter((o) => o.status === 'open').length, icon: ArrowLeftRight, tone: 'text-violet-300' },
    { label: 'Volumen notional P2P', value: stats.vol.toLocaleString(undefined, { maximumFractionDigits: 0 }), icon: Activity, tone: 'text-emerald-300' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Proyecto actual</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{currentProjectMeta?.label ?? '—'}</h2>
        <p className="text-sm text-slate-500">
          Datos desde slices normalizados (<span className="font-mono text-slate-600">usersByProject</span>, etc.)
          según <span className="font-mono text-cyan-200/70">currentProject</span>.
        </p>
      </div>

      {isSwitchingProject ? (
        <p className="text-sm text-cyan-200/80">Sincronizando contexto de proyecto…</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-950/80 to-slate-900/40 p-4 transition-shadow duration-300 hover:shadow-[0_12px_40px_-24px_rgba(34,211,238,0.15)]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500">{c.label}</p>
              <c.icon className={`h-4 w-4 ${c.tone}`} aria-hidden />
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="admin-module signals-module rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-950/85 to-indigo-950/20 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-white">⚡ Señales en Vivo</h2>
          <Link
            to="/admin"
            className="text-xs font-semibold uppercase tracking-wide text-cyan-300/90 transition hover:text-cyan-200"
          >
            Panel principal →
          </Link>
        </div>
        <AdminSignalsProPanel compact compactMaxSignals={8} />
      </section>
    </div>
  );
}

export const GlobalOverviewModule = memo(GlobalOverviewModuleInner);
GlobalOverviewModule.displayName = 'GlobalOverviewModule';
