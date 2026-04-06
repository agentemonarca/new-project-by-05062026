import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAdmin } from '../context/AdminContext.jsx';
import { AdminPageHeader } from './AdminPageHeader.jsx';
import { staggerContainer, fadeUpBlur } from '@/ui-genesis/motion/variants.js';

export function AdminSystemPage() {
  const { state } = useAdmin();
  const meta = useMemo(
    () => ({
      mode: import.meta.env.MODE,
      dev: import.meta.env.DEV,
    }),
    [],
  );

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <AdminPageHeader
        eyebrow="Sistema"
        title="Salud y entorno"
        subtitle="Build frontend + estado del control plane en memoria."
      />

      <motion.div variants={fadeUpBlur} className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5 text-sm">
          <h3 className="font-semibold text-white">Entorno</h3>
          <dl className="mt-3 space-y-2 text-slate-400">
            <div className="flex justify-between border-b border-white/[0.05] py-2">
              <dt>MODE</dt>
              <dd className="font-mono text-cyan-200/90">{meta.mode}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt>DEV</dt>
              <dd>{meta.dev ? 'true' : 'false'}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5 text-sm">
          <h3 className="font-semibold text-white">Control state</h3>
          <ul className="mt-3 space-y-1 text-slate-400">
            <li>Usuarios: {(state.users || []).length}</li>
            <li>Órdenes: {(state.p2pOrders || []).length}</li>
            <li>Mercado pausado: {state.marketPaused ? 'sí' : 'no'}</li>
            <li>Recompensas globales: {state.rewardSystemEnabled ? 'on' : 'off'}</li>
          </ul>
        </div>
      </motion.div>
    </motion.div>
  );
}
