import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAdmin } from '../context/AdminContext.jsx';
import { AdminPageHeader } from './AdminPageHeader.jsx';
import { staggerContainer, fadeUpBlur } from '@/ui-genesis/motion/variants.js';
import { useLedger } from '@/ui-genesis/ledger/LedgerContext.jsx';

export function AdminOverviewPage() {
  const { state } = useAdmin();
  const { hasSession, error } = useLedger();

  const totals = useMemo(() => {
    const users = state.users || [];
    return {
      users: users.length,
      usd: users.reduce((s, u) => s + (Number(u.balances?.usd) || 0), 0),
      aig: users.reduce((s, u) => s + (Number(u.balances?.aig) || 0), 0),
      openOrders: (state.p2pOrders || []).filter((o) => o.status === 'open').length,
      pendingWd: (state.withdrawals || []).filter((w) => w.status === 'pending').length,
    };
  }, [state.users, state.p2pOrders, state.withdrawals]);

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <AdminPageHeader
        eyebrow="Command center"
        title="Vista general ejecutiva"
        subtitle="Agregados en tiempo real desde el contexto de control. Conecta API para series históricas."
      />

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/25 px-4 py-2 text-sm text-rose-100">
          Ledger: {error}
        </p>
      ) : null}
      {!hasSession ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
          Sesión usuario no activa — algunas métricas ledger permanecen en modo demo.
        </p>
      ) : null}

      <motion.div variants={fadeUpBlur} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Usuarios (mock)', value: String(totals.users), tone: 'text-cyan-200' },
          { label: 'Liquidez USD agregada', value: `$${Math.round(totals.usd).toLocaleString()}`, tone: 'text-white' },
          { label: 'AIG agregado', value: totals.aig.toLocaleString(), tone: 'text-fuchsia-200/90' },
          { label: 'Órdenes P2P abiertas', value: String(totals.openOrders), tone: 'text-amber-200/90' },
          { label: 'Retiros pendientes', value: String(totals.pendingWd), tone: 'text-rose-200/90' },
          {
            label: 'Mercado P2P',
            value: state.marketPaused ? 'PAUSADO' : 'ACTIVO',
            tone: state.marketPaused ? 'text-rose-300' : 'text-emerald-300',
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-white/[0.08] bg-slate-950/70 px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</p>
            <p className={`mt-1 font-display text-xl font-semibold ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </motion.div>

      <motion.div variants={fadeUpBlur} className="rounded-2xl border border-white/[0.08] bg-slate-950/50 p-5 text-sm text-slate-400">
        <p className="font-medium text-slate-300">Acciones rápidas</p>
        <p className="mt-2">
          Usa el menú lateral para operar módulos: <strong className="text-slate-200">Usuarios</strong> para KYC/
          bloqueos, <strong className="text-slate-200">P2P</strong> para órdenes,{' '}
          <strong className="text-slate-200">Configuración</strong> para el cerebro del sistema.
        </p>
      </motion.div>
    </motion.div>
  );
}
