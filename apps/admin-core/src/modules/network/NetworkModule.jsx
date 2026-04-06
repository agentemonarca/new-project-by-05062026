import React, { memo, useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdminCore } from '../../context/AdminCoreContext.jsx';
import { AdminPageHeader } from '../../components/AdminPageHeader.jsx';
import { ConfirmModal } from '../../components/ConfirmModal.jsx';
import { staggerContainer, fadeUpBlur } from '../../motion/variants.js';

function NetworkModuleInner() {
  const { projectUsers, currentProject, networkActions } = useAdminCore();
  const [userId, setUserId] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [confirm, setConfirm] = useState(/** @type {null | { title: string, message: string, onOk: () => void }} */ (null));

  const totals = useMemo(() => {
    let L = 0;
    let R = 0;
    for (const u of projectUsers) {
      L += Number(u.network?.volumeLeft) || 0;
      R += Number(u.network?.volumeRight) || 0;
    }
    return { L, R, total: L + R };
  }, [projectUsers]);

  const u = useMemo(() => projectUsers.find((x) => x.id === userId.trim()), [projectUsers, userId]);

  const run = useCallback(
    (fn) => {
      const id = userId.trim();
      if (!id) return;
      fn(id);
    },
    [userId],
  );

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUpBlur}>
        <AdminPageHeader
          eyebrow="Red / Binario"
          title="Topología y volumen"
          subtitle={`Volumen agregado por pierna · proyecto ${currentProject || '—'}`}
        />
      </motion.div>

      <motion.div variants={fadeUpBlur} className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-slate-950/70 px-4 py-4">
          <p className="text-[10px] font-bold uppercase text-slate-500">Pierna izquierda</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-cyan-200">{totals.L.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-slate-950/70 px-4 py-4">
          <p className="text-[10px] font-bold uppercase text-slate-500">Pierna derecha</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-violet-200">{totals.R.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-slate-950/70 px-4 py-4">
          <p className="text-[10px] font-bold uppercase text-slate-500">Total referencia</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">{totals.total.toLocaleString()}</p>
        </div>
      </motion.div>

      <motion.div
        variants={fadeUpBlur}
        className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-center text-sm text-slate-500"
      >
        Visualización de árbol (placeholder) — integra react-flow o canvas cuando exista API de genealogía.
      </motion.div>

      <motion.div variants={fadeUpBlur} className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/80">Acciones de red</p>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="ID usuario objetivo"
          className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
        />
        {u ? (
          <p className="mt-2 text-xs text-slate-400">
            Seleccionado: {u.username} · pierna actual {u.network?.leg ?? '—'}
          </p>
        ) : userId.trim() ? (
          <p className="mt-2 text-xs text-rose-400/90">Usuario no encontrado en este proyecto.</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setConfirm({
                title: 'Mover a pierna L',
                message: '¿Mover usuario a la pierna izquierda?',
                onOk: () => run((id) => networkActions.moveUser(id, 'L')),
              })
            }
            className="rounded-lg bg-cyan-600/80 px-3 py-2 text-xs font-semibold text-white"
          >
            Mover → L
          </button>
          <button
            type="button"
            onClick={() =>
              setConfirm({
                title: 'Mover a pierna R',
                message: '¿Mover usuario a la pierna derecha?',
                onOk: () => run((id) => networkActions.moveUser(id, 'R')),
              })
            }
            className="rounded-lg bg-violet-600/80 px-3 py-2 text-xs font-semibold text-white"
          >
            Mover → R
          </button>
          <button
            type="button"
            onClick={() =>
              setConfirm({
                title: 'Corregir posición',
                message: '¿Recalcular posición simulada?',
                onOk: () => run((id) => networkActions.correct(id)),
              })
            }
            className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200"
          >
            Corregir posición
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          <input
            value={sponsorId}
            onChange={(e) => setSponsorId(e.target.value)}
            placeholder="Nuevo sponsor ID"
            className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              setConfirm({
                title: 'Reasignar sponsor',
                message: 'Operación sensible — continuar?',
                onOk: () => {
                  const id = userId.trim();
                  const sp = sponsorId.trim();
                  if (id && sp) networkActions.reassignSponsor(id, sp);
                },
              })
            }
            className="rounded-lg bg-amber-600/85 px-3 py-2 text-xs font-semibold text-white"
          >
            Reasignar sponsor
          </button>
        </div>
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

export const NetworkModule = memo(NetworkModuleInner);
NetworkModule.displayName = 'NetworkModule';
