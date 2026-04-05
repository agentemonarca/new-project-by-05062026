import React from 'react';
import {
  coreRemainingUsdt,
  getStakingLockedAig,
  isStakingFlexible,
  stakingLockRemainingDays,
} from '../../types/miningCore.js';

function coreDisplayIndex(core) {
  const tail = core.id.split('-').pop();
  return /^\d+$/.test(tail) ? tail : core.id.slice(-6);
}

/**
 * @param {{ cores: import('../../types/miningCore.js').MiningCore[] }} props
 */
export function StakingHistory({ cores }) {
  const now = Date.now();

  const rows = cores.map((core) => {
    const flex = isStakingFlexible(core);
    const rem = stakingLockRemainingDays(core, now);
    const headroom = coreRemainingUsdt(core);
    const lockComplete = !flex && (core.lockDurationDays ?? 0) > 0 && rem === 0;
    const participationDone = headroom <= 0 && core.accumulated <= 1e-8;
    const completed = lockComplete || participationDone;
    return {
      id: core.id,
      label: `Staking #${coreDisplayIndex(core)}`,
      aig: getStakingLockedAig(core),
      status: completed ? 'COMPLETADO' : 'ACTIVO',
    };
  });

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-white">Historial de staking</h2>
        <p className="mt-1 text-sm text-slate-500">Transparencia por cada bloqueo registrado en el protocolo.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Núcleo</th>
              <th className="px-4 py-3">Bloqueado</th>
              <th className="px-4 py-3 text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-200">{r.label}</td>
                <td className="px-4 py-3 tabular-nums text-slate-400">{r.aig.toLocaleString()} AIG</td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      r.status === 'ACTIVO'
                        ? 'border border-sky-500/35 bg-sky-500/10 text-sky-200'
                        : 'border border-slate-600/40 bg-slate-800/50 text-slate-400'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
