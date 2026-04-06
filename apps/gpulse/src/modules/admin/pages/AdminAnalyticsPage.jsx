import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAdmin } from '../context/AdminContext.jsx';
import { AdminPageHeader } from './AdminPageHeader.jsx';
import { staggerContainer, fadeUpBlur } from '@/ui-genesis/motion/variants.js';

export function AdminAnalyticsPage() {
  const { state } = useAdmin();

  const series = useMemo(() => {
    const users = state.users || [];
    const maxUsd = Math.max(1, ...users.map((u) => Number(u.balances?.usd) || 0));
    return users.map((u) => ({
      id: u.id,
      label: u.username || u.id,
      pct: Math.round(((Number(u.balances?.usd) || 0) / maxUsd) * 100),
      usd: Number(u.balances?.usd) || 0,
    }));
  }, [state.users]);

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <AdminPageHeader
        eyebrow="Analytics"
        title="Métricas visuales"
        subtitle="Distribución proxy de USD por cuenta (demo). Sustituir por warehouse."
      />

      <motion.div variants={fadeUpBlur} className="space-y-4 rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
        {series.length ? (
          series.map((s) => (
            <div key={s.id}>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>{s.label}</span>
                <span className="font-mono text-slate-300">${s.usd.toLocaleString()}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all"
                  style={{ width: `${s.pct}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Sin datos.</p>
        )}
      </motion.div>

      <motion.div variants={fadeUpBlur} className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-slate-950/70 p-4 text-center">
          <p className="text-[10px] uppercase text-slate-500">Órdenes abiertas</p>
          <p className="mt-1 font-display text-2xl text-amber-200">
            {(state.p2pOrders || []).filter((o) => o.status === 'open').length}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-slate-950/70 p-4 text-center">
          <p className="text-[10px] uppercase text-slate-500">Usuarios activos</p>
          <p className="mt-1 font-display text-2xl text-emerald-200">
            {(state.users || []).filter((u) => u.status === 'active').length}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-slate-950/70 p-4 text-center">
          <p className="text-[10px] uppercase text-slate-500">P2P habilitado</p>
          <p className="mt-1 font-display text-2xl text-cyan-200">
            {state.globalConfig?.flags?.p2pEnabled ? 'Sí' : 'No'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
