import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GitBranch } from 'lucide-react';
import { GlassCard } from '../GlassCard.jsx';
import { SectionHeader } from '../SectionHeader.jsx';
import { useStakingEngineStore } from '../../stores/stakingEngineStore.js';

const FILTER_LABELS = {
  all: 'Todos',
  active: 'Solo activos',
  inactive: 'Sin staking',
  top: 'Top generadores',
  expiring: 'Por vencer',
};

function formatRemain(sec) {
  if (!sec) return '—';
  const d = Math.floor(sec / 86400);
  return `${d} d`;
}

function TreeNode({ u, small = false }) {
  const reduceMotion = useReducedMotion();
  const active = u.active;
  return (
    <motion.div
      whileHover={reduceMotion ? {} : { scale: 1.02 }}
      className={`min-w-[140px] rounded-xl border p-3 text-center ${
        active ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-rose-500/35 bg-rose-950/30'
      }`}
    >
      <p className="font-mono text-xs font-semibold text-white">{u.username}</p>
      <p className="mt-1 text-[10px] uppercase text-slate-500">{active ? 'ACTIVE' : 'INACTIVE'}</p>
      {!active ? (
        <p className="mt-1 text-[10px] font-semibold text-rose-400">Sin staking</p>
      ) : null}
      <p className="mt-1 font-mono text-[11px] text-cyan-200">{active ? `$${u.amount}` : '—'}</p>
      <p className="text-[10px] text-slate-500">{active ? `${u.plan}` : '—'}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">⏱ {formatRemain(u.remainingSec)}</p>
      <p className="mt-1 text-[10px] text-violet-300">+${u.bonusYou} p/ti</p>
    </motion.div>
  );
}

/**
 * Network tree + filtered detail table.
 */
export function StakingTeamVisibility() {
  const tableFilter = useStakingEngineStore((s) => s.tableFilter);
  const setTableFilter = useStakingEngineStore((s) => s.setTableFilter);
  const teamFlat = useStakingEngineStore((s) => s.teamFlat);
  const rows = useMemo(() => {
    let r = [...teamFlat];
    if (tableFilter === 'active') r = r.filter((u) => u.active);
    else if (tableFilter === 'inactive') r = r.filter((u) => !u.active);
    else if (tableFilter === 'top') r.sort((a, b) => b.volume - a.volume);
    else if (tableFilter === 'expiring') {
      r = r.filter((u) => u.active && u.remainingSec > 0).sort((a, b) => a.remainingSec - b.remainingSec);
    }
    return r;
  }, [teamFlat, tableFilter]);

  const tree = useMemo(() => {
    const root = { username: '@Tú', active: true, amount: 8200, plan: '6m', remainingSec: 90 * 86400, bonusYou: 0 };
    const safe = (i) => teamFlat[i] ?? { username: '—', active: false, amount: 0, plan: '—', remainingSec: 0, bonusYou: 0 };
    return { root, l: safe(0), r: safe(1), ll: safe(2), lr: safe(3) };
  }, [teamFlat]);

  return (
    <section className="space-y-8">
      <div>
        <SectionHeader
          title="Visibilidad de staking del equipo"
          description="Árbol binario y detalle por miembro. Estados en vivo respecto al plan y volumen."
        />
      </div>

      <GlassCard hover={false} glowClassName="shadow-glowCyan border-violet-500/15" contentClassName="p-5 md:p-8">
        <div className="mb-6 flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-violet-300" />
          <h3 className="font-display text-sm font-semibold text-white">Vista de red (árbol)</h3>
        </div>
        <div className="flex flex-col items-center gap-6">
          <TreeNode u={tree.root} />
          <div className="flex w-full max-w-lg justify-center gap-8 border-t border-white/10 pt-6">
            <div className="flex flex-col items-center gap-3">
              <TreeNode u={tree.l} />
              <div className="flex gap-2">
                <TreeNode u={tree.ll} small />
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <TreeNode u={tree.r} />
              <div className="flex gap-2">
                <TreeNode u={tree.lr} small />
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="space-y-4">
        <h3 className="font-display text-sm font-semibold text-white">Vista tabla (detalle)</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(FILTER_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTableFilter(key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                tableFilter === key
                  ? 'border-cyan-400/45 bg-cyan-500/15 text-cyan-100'
                  : 'border-white/12 bg-slate-950/40 text-slate-400 hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <GlassCard hover={false} glowClassName="border-white/10" contentClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Usuario</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Plan</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Monto</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tiempo restante</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Estado</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Volumen gen.</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Bonus p/ti</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <motion.tr
                    key={u.id}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                    className="border-b border-white/[0.06]"
                  >
                    <td className="px-4 py-3 font-mono text-violet-200">{u.username}</td>
                    <td className="px-4 py-3">{u.plan}</td>
                    <td className="px-4 py-3 font-mono">${u.amount.toLocaleString('es-ES')}</td>
                    <td className="px-4 py-3">{formatRemain(u.remainingSec)}</td>
                    <td className="px-4 py-3">
                      <span className={u.active ? 'text-emerald-300' : 'text-rose-400'}>{u.active ? 'ACTIVE' : 'SIN STAKING'}</span>
                    </td>
                    <td className="px-4 py-3 font-mono">${u.volume.toLocaleString('es-ES')}</td>
                    <td className="px-4 py-3 font-mono text-cyan-200">${u.bonusYou}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
