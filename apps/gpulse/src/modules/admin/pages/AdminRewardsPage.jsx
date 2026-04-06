import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdmin } from '../context/AdminContext.jsx';
import { AdminPageHeader } from './AdminPageHeader.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';
import { staggerContainer, fadeUpBlur } from '@/ui-genesis/motion/variants.js';

export function AdminRewardsPage() {
  const { state, rewardActions, setRewardSystem, isLoading } = useAdmin();
  const [confirm, setConfirm] = useState(/** @type {null | { title: string, message: string, onOk: () => void }} */ (null));
  const [edDirect, setEdDirect] = useState(/** @type {Record<string, string>} */ ({}));
  const [edBinary, setEdBinary] = useState(/** @type {Record<string, string>} */ ({}));

  const open = useCallback((title, message, onOk) => setConfirm({ title, message, onOk }), []);
  const sysLoading = isLoading('rewards-sys');

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <AdminPageHeader
        eyebrow="Recompensas"
        title="Motor de bonos"
        subtitle="Ajuste por usuario y interruptor global del sistema de recompensas."
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Sistema</span>
          <button
            type="button"
            disabled={sysLoading}
            onClick={() => setRewardSystem(!state.rewardSystemEnabled)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              state.rewardSystemEnabled
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'bg-rose-500/20 text-rose-200'
            }`}
          >
            {state.rewardSystemEnabled ? 'Activado' : 'Desactivado'}
          </button>
        </div>
      </AdminPageHeader>

      {!state.rewardSystemEnabled ? (
        <p className="rounded-xl border border-rose-500/25 bg-rose-950/20 px-4 py-2 text-sm text-rose-100">
          Sistema de recompensas desactivado — no se liquidarán bonos hasta reactivar.
        </p>
      ) : null}

      <motion.div variants={fadeUpBlur} className="overflow-x-auto rounded-2xl border border-white/[0.08]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-slate-900/60 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Directo %</th>
              <th className="px-3 py-2">Binario %</th>
              <th className="px-3 py-2">Pendiente</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {(state.users || []).map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2">
                  <span className="font-mono text-xs text-cyan-200/80">{u.id}</span>
                  <br />
                  <span className="text-slate-300">{u.username}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <input
                      value={edDirect[u.id] ?? String(u.rewards?.directPct ?? '')}
                      onChange={(e) => setEdDirect((d) => ({ ...d, [u.id]: e.target.value }))}
                      className="w-16 rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        rewardActions.setDirect(u.id, Number(edDirect[u.id] ?? u.rewards?.directPct))
                      }
                      className="text-[11px] text-cyan-400 hover underline"
                    >
                      Aplicar
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <input
                      value={edBinary[u.id] ?? String(u.rewards?.binaryPct ?? '')}
                      onChange={(e) => setEdBinary((d) => ({ ...d, [u.id]: e.target.value }))}
                      className="w-16 rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        rewardActions.setBinary(u.id, Number(edBinary[u.id] ?? u.rewards?.binaryPct))
                      }
                      className="text-[11px] text-cyan-400 hover underline"
                    >
                      Aplicar
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {(u.rewards?.pendingPayout ?? 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      open('Forzar pago', `¿Forzar pago pendiente para ${u.id}?`, () =>
                        rewardActions.forcePay(u.id),
                      )
                    }
                    className="mr-1 rounded bg-emerald-600/80 px-2 py-1 text-[11px] text-white"
                  >
                    Pagar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      open('Reset recompensas', `¿Resetear bonos de ${u.id}?`, () =>
                        rewardActions.resetUser(u.id),
                      )
                    }
                    className="rounded bg-slate-700 px-2 py-1 text-[11px] text-white"
                  >
                    Reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
