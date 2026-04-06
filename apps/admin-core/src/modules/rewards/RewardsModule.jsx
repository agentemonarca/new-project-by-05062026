import React, { memo, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAdminCore } from '../../context/AdminCoreContext.jsx';
import { AdminTable } from '../../components/AdminTable.jsx';
import { AdminPageHeader } from '../../components/AdminPageHeader.jsx';
import { staggerContainer, fadeUpBlur } from '../../motion/variants.js';

function RewardsModuleInner() {
  const { projectUsers, projectRewards, currentProject, rewardSystemEnabled, setRewardSystem } = useAdminCore();

  const rows = useMemo(
    () =>
      projectUsers.map((u) => ({
        id: u.id,
        username: u.username,
        usd: u.balances?.usd ?? 0,
        aig: u.balances?.aig ?? 0,
        directPct: u.rewards?.directPct ?? '—',
        binaryPct: u.rewards?.binaryPct ?? '—',
        pending: u.rewards?.pendingPayout ?? '—',
        status: u.status,
      })),
    [projectUsers],
  );

  const columns = useMemo(
    () => [
      { key: 'id', header: 'ID', className: 'font-mono text-xs text-cyan-200/80' },
      { key: 'username', header: 'Usuario', render: (r) => <span className="text-white">{r.username}</span> },
      { key: 'usd', header: 'USD', className: 'font-mono text-right', render: (r) => Number(r.usd).toLocaleString() },
      { key: 'aig', header: 'AIG', className: 'font-mono text-right', render: (r) => Number(r.aig).toLocaleString() },
      { key: 'directPct', header: '% dir.', className: 'text-right text-xs', render: (r) => r.directPct },
      { key: 'binaryPct', header: '% bin.', className: 'text-right text-xs', render: (r) => r.binaryPct },
      {
        key: 'pending',
        header: 'Pend.',
        className: 'text-right font-mono text-xs',
        render: (r) => r.pending,
      },
      { key: 'status', header: 'Estado', render: (r) => <span className="text-xs text-slate-400">{r.status}</span> },
    ],
    [],
  );

  const toggleRewards = useCallback(() => {
    if (currentProject) setRewardSystem(currentProject, !rewardSystemEnabled);
  }, [currentProject, rewardSystemEnabled, setRewardSystem]);

  return (
    <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUpBlur}>
        <AdminPageHeader
          eyebrow="Recompensas"
          title="Pool y por usuario"
          subtitle={`rewardSystemByProject + datos por miembro · ${currentProject || '—'}`}
        >
          <button
            type="button"
            onClick={toggleRewards}
            className={`rounded-xl px-4 py-2 text-xs font-semibold ${
              rewardSystemEnabled ? 'border border-emerald-500/40 text-emerald-200' : 'bg-rose-600/80 text-white'
            }`}
          >
            {rewardSystemEnabled ? 'Sistema ON' : 'Activar sistema'}
          </button>
        </AdminPageHeader>
      </motion.div>

      <p className="text-xs text-slate-500">
        El toggle actualiza <span className="font-mono text-slate-600">rewardSystemByProject</span> y{' '}
        <span className="font-mono text-slate-600">rules.rewardsEnabled</span>. La política completa vive en{' '}
        <span className="text-slate-400">Economía → Bonos</span>.
      </p>

      {projectRewards ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-[10px] font-bold uppercase text-emerald-300/90">Pool</p>
            <p className="mt-1 font-mono text-xl text-white">{Number(projectRewards.poolUsd).toLocaleString()} USD</p>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <p className="text-[10px] font-bold uppercase text-cyan-300/90">Hoy</p>
            <p className="mt-1 font-mono text-xl text-white">
              {Number(projectRewards.distributedToday).toLocaleString()} USD
            </p>
          </div>
        </div>
      ) : null}

      <AdminTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyLabel="Sin usuarios en el proyecto." />
    </motion.div>
  );
}

export const RewardsModule = memo(RewardsModuleInner);
RewardsModule.displayName = 'RewardsModule';
