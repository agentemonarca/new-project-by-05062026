import React, { memo, useMemo } from 'react';
import { useAdminCore } from '../../context/AdminCoreContext.jsx';
import { TrendingUp, Users, Wallet, Zap } from 'lucide-react';

function AnalyticsModuleInner() {
  const { projectUsers, projectTransactions, projectOrders, projectRewards, currentProjectMeta } = useAdminCore();

  const metrics = useMemo(() => {
    const totalUsd = projectUsers.reduce((s, u) => s + Number(u.balances?.usd || 0), 0);
    const totalAig = projectUsers.reduce((s, u) => s + Number(u.balances?.aig || 0), 0);
    const tx24 = projectTransactions.filter((t) => t.status === 'pending').length;
    const openBook = projectOrders.filter((o) => o.status === 'open').length;
    return { totalUsd, totalAig, tx24, openBook };
  }, [projectUsers, projectTransactions, projectOrders]);

  const cards = [
    {
      icon: Users,
      label: 'Usuarios',
      value: projectUsers.length,
      sub: 'en el proyecto actual',
    },
    {
      icon: Wallet,
      label: 'USD agregado (wallets)',
      value: metrics.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sub: 'suma de balances demo',
    },
    {
      icon: TrendingUp,
      label: 'AIG agregado',
      value: metrics.totalAig.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sub: 'suma de balances demo',
    },
    {
      icon: Zap,
      label: 'Actividad',
      value: `${metrics.tx24} pend · ${metrics.openBook} órdenes`,
      sub: 'tesorería / libro P2P',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Analytics</h2>
        <p className="text-sm text-slate-500">
          Retornos calculados con useMemo · {currentProjectMeta?.label ?? 'proyecto'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4">
            <div className="flex items-center gap-2">
              <c.icon className="h-5 w-5 text-cyan-400/90" />
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold text-white">{c.value}</p>
            <p className="mt-1 text-xs text-slate-500">{c.sub}</p>
          </div>
        ))}
      </div>

      {projectRewards ? (
        <div className="rounded-xl border border-white/[0.08] bg-violet-950/20 p-4">
          <p className="text-[10px] font-bold uppercase text-violet-300/80">Pool recompensas (mock)</p>
          <p className="mt-1 font-mono text-lg text-white">
            {Number(projectRewards.poolUsd).toLocaleString()} USD pool
          </p>
          <p className="text-sm text-slate-400">
            Distribuido hoy: {Number(projectRewards.distributedToday).toLocaleString()} USD
          </p>
        </div>
      ) : null}
    </div>
  );
}

export const AnalyticsModule = memo(AnalyticsModuleInner);
AnalyticsModule.displayName = 'AnalyticsModule';
