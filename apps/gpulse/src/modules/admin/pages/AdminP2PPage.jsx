import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdmin } from '../context/AdminContext.jsx';
import { useAdminPanelStore } from '@/ui-genesis/stores/adminPanelStore.js';
import { AdminPageHeader } from './AdminPageHeader.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';
import { staggerContainer, fadeUpBlur } from '@/ui-genesis/motion/variants.js';

export function AdminP2PPage() {
  const { state, cancelP2POrder, setMarketPaused, p2pBlockUser, forceExecuteOrder } = useAdmin();
  const setActiveModule = useAdminPanelStore((s) => s.setActiveModule);
  const [confirm, setConfirm] = useState(/** @type {null | { title: string, message: string, onOk: () => void }} */ (null));
  const [blockUid, setBlockUid] = useState('');

  const open = useCallback((title, message, onOk) => setConfirm({ title, message, onOk }), []);

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <AdminPageHeader
        eyebrow="Mercado P2P"
        title="Control de órdenes"
        subtitle="Operaciones de libro: cancelar, ejecutar y pausar el mercado. Límites globales en Configuración."
      >
        <button
          type="button"
          onClick={() => setActiveModule('config')}
          className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100"
        >
          Ir a configuración
        </button>
      </AdminPageHeader>

      <motion.div variants={fadeUpBlur} className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            open(state.marketPaused ? 'Reanudar mercado' : 'Pausar mercado', '¿Confirmar?', () =>
              setMarketPaused(!state.marketPaused),
            )
          }
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            state.marketPaused
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600/90 text-white'
          }`}
        >
          {state.marketPaused ? 'Reanudar mercado' : 'Pausar mercado'}
        </button>
        <div className="flex items-center gap-2">
          <input
            value={blockUid}
            onChange={(e) => setBlockUid(e.target.value)}
            placeholder="User ID para bloqueo P2P"
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              open('Bloqueo P2P', `¿Bloquear ${blockUid} en P2P?`, () => p2pBlockUser(blockUid.trim(), true))
            }
            className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-200"
          >
            Bloquear
          </button>
          <button
            type="button"
            onClick={() => p2pBlockUser(blockUid.trim(), false)}
            className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs text-emerald-200"
          >
            Desbloquear
          </button>
        </div>
      </motion.div>

      {state.marketPaused ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/25 px-4 py-2 text-sm text-rose-100">
          Mercado en pausa — matching deshabilitado (mock).
        </p>
      ) : null}

      <motion.div variants={fadeUpBlur} className="overflow-x-auto rounded-2xl border border-white/[0.08]">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-slate-900/60 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Orden</th>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Lado</th>
              <th className="px-3 py-2">Cant.</th>
              <th className="px-3 py-2">Precio</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {(state.p2pOrders || []).map((o) => (
              <tr key={o.id}>
                <td className="px-3 py-2 font-mono text-xs text-cyan-200/80">{o.id}</td>
                <td className="px-3 py-2">{o.userId}</td>
                <td className="px-3 py-2 uppercase">{o.side}</td>
                <td className="px-3 py-2 font-mono">{o.amount}</td>
                <td className="px-3 py-2 font-mono">{o.price}</td>
                <td className="px-3 py-2">{o.status}</td>
                <td className="px-3 py-2 text-right">
                  {o.status === 'open' ? (
                    <span className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          open('Cancelar orden', `¿Cancelar ${o.id}?`, () => cancelP2POrder(o.id))
                        }
                        className="rounded bg-rose-600/80 px-2 py-1 text-[11px] text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          open('Forzar ejecución', `¿Ejecutar ${o.id}?`, () => forceExecuteOrder(o.id))
                        }
                        className="rounded bg-amber-600/85 px-2 py-1 text-[11px] text-white"
                      >
                        Forzar
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
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
