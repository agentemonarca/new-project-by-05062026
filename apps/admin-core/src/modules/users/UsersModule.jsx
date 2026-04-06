import React, { memo, useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdminCore } from '../../context/AdminCoreContext.jsx';
import { AdminTable } from '../../components/AdminTable.jsx';
import { UserControlDrawer } from '../../components/UserControlDrawer.jsx';
import { AdminPageHeader } from '../../components/AdminPageHeader.jsx';
import { staggerContainer, fadeUpBlur } from '../../motion/variants.js';

function UsersModuleInner() {
  const { projectUsers, currentProject } = useAdminCore();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(/** @type {null | string} */ (null));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return projectUsers;
    return projectUsers.filter(
      (u) =>
        String(u.email || '').toLowerCase().includes(needle) ||
        String(u.username || '').toLowerCase().includes(needle) ||
        String(u.wallet || '').toLowerCase().includes(needle) ||
        String(u.id || '').toLowerCase().includes(needle),
    );
  }, [projectUsers, q]);

  const columns = useMemo(
    () => [
      { key: 'id', header: 'ID', className: 'font-mono text-xs text-cyan-200/80' },
      { key: 'username', header: 'Usuario', render: (r) => <span className="text-white">{r.username}</span> },
      { key: 'email', header: 'Email', render: (r) => <span className="max-w-[180px] truncate">{r.email}</span> },
      {
        key: 'status',
        header: 'Estado',
        render: (r) => <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-xs">{r.status}</span>,
      },
      {
        key: 'referrerId',
        header: 'Referidor',
        className: 'font-mono text-[11px] text-slate-400',
        render: (r) => r.referrerId ?? '—',
      },
      {
        key: 'usd',
        header: 'USD',
        className: 'text-right font-mono',
        render: (r) => Number(r.balances?.usd || 0).toLocaleString(),
      },
      {
        key: 'open',
        header: '',
        className: 'w-28 text-right',
        render: (r) => (
          <button
            type="button"
            onClick={() => setSelected(r.id)}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
          >
            Control center
          </button>
        ),
      },
    ],
    [],
  );

  const closeDrawer = useCallback(() => setSelected(null), []);

  return (
    <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUpBlur}>
        <AdminPageHeader
          eyebrow="Usuarios"
          title="User control center"
          subtitle={`Fuente: usersByProject[currentProject] · ${currentProject || '—'}`}
        />
      </motion.div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar email, usuario, wallet…"
          className="w-full rounded-xl border border-white/10 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-cyan-500/30"
        />
      </div>

      <label className="block text-xs text-slate-500 lg:hidden">
        Abrir usuario
        <select
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
          value={selected ?? ''}
          onChange={(e) => setSelected(e.target.value || null)}
        >
          <option value="">—</option>
          {filtered.map((u) => (
            <option key={u.id} value={u.id}>
              {u.username}
            </option>
          ))}
        </select>
      </label>

      <AdminTable columns={columns} rows={filtered} rowKey={(r) => r.id} emptyLabel="No hay usuarios en este proyecto." />

      <UserControlDrawer userId={selected} open={Boolean(selected)} onClose={closeDrawer} />
    </motion.div>
  );
}

export const UsersModule = memo(UsersModuleInner);
UsersModule.displayName = 'UsersModule';
