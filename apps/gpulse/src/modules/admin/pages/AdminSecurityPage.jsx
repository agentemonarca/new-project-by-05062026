import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdmin } from '../context/AdminContext.jsx';
import { AdminPageHeader } from './AdminPageHeader.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';
import { staggerContainer, fadeUpBlur } from '@/ui-genesis/motion/variants.js';

export function AdminSecurityPage() {
  const { state, securityActions } = useAdmin();
  const [ip, setIp] = useState('');
  const [sessUser, setSessUser] = useState('');
  const [susUser, setSusUser] = useState('');
  const [susNote, setSusNote] = useState('');
  const [confirm, setConfirm] = useState(/** @type {null | { title: string, message: string, onOk: () => void }} */ (null));

  const open = useCallback((title, message, onOk) => setConfirm({ title, message, onOk }), []);

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <AdminPageHeader
        eyebrow="Seguridad"
        title="Auditoría y controles"
        subtitle="Logs operativos y acciones de contención (mock)."
      />

      <motion.div variants={fadeUpBlur} className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4">
          <h3 className="text-xs font-semibold text-white">Bloquear IP</h3>
          <input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="192.168.x.x"
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() =>
              open('Bloquear IP', `¿Bloquear ${ip}?`, () => securityActions.blockIp(ip.trim()))
            }
            className="mt-2 w-full rounded-lg bg-rose-600/80 py-2 text-xs font-semibold text-white"
          >
            Bloquear
          </button>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4">
          <h3 className="text-xs font-semibold text-white">Cerrar sesión</h3>
          <input
            value={sessUser}
            onChange={(e) => setSessUser(e.target.value)}
            placeholder="User ID"
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              open('Revocar sesión', `¿Cerrar sesiones de ${sessUser}?`, () =>
                securityActions.revokeSession(sessUser.trim()),
              )
            }
            className="mt-2 w-full rounded-lg border border-amber-500/35 bg-amber-500/10 py-2 text-xs text-amber-100"
          >
            Revocar sesión
          </button>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4">
          <h3 className="text-xs font-semibold text-white">Actividad sospechosa</h3>
          <input
            value={susUser}
            onChange={(e) => setSusUser(e.target.value)}
            placeholder="User ID"
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
          />
          <input
            value={susNote}
            onChange={(e) => setSusNote(e.target.value)}
            placeholder="Nota"
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => securityActions.flagSuspicious(susUser.trim(), susNote)}
            className="mt-2 w-full rounded-lg bg-slate-700 py-2 text-xs text-white"
          >
            Marcar
          </button>
        </div>
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Logs</h3>
        <ul className="space-y-2">
          {(state.securityLogs || []).map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-slate-950/70 px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-cyan-200/80">{row.id}</span>
              <span className="text-slate-400">{row.actor}</span>
              <span className="text-slate-300">{row.action}</span>
              <span className="text-xs text-slate-500">{row.ts}</span>
            </li>
          ))}
        </ul>
        {(state.blockedIps || []).length ? (
          <p className="mt-3 text-xs text-rose-300/90">
            IPs bloqueadas: {(state.blockedIps || []).join(', ')}
          </p>
        ) : null}
      </motion.div>

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        danger
        onConfirm={() => {
          confirm?.onOk?.();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </motion.div>
  );
}
