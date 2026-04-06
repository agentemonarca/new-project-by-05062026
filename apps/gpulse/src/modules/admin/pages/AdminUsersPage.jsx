import React, { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useAdmin } from '../context/AdminContext.jsx';
import { AdminPageHeader } from './AdminPageHeader.jsx';
import { UserDetailCard } from '../components/UserDetailCard.jsx';
import { UserControlDrawer } from '../components/UserControlDrawer.jsx';
import { staggerContainer, fadeUpBlur } from '@/ui-genesis/motion/variants.js';

function shortenWallet(w) {
  const s = String(w || '');
  if (s.length < 14) return s || '—';
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function AdminUsersPage() {
  const { state } = useAdmin();
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(/** @type {string | null} */ (null));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = state.users || [];
    if (!needle) return list;
    return list.filter((u) => {
      const fields = [
        u.email,
        u.username,
        u.id,
        u.wallet,
        u.referrerId,
      ].map((x) => String(x ?? '').toLowerCase());
      return fields.some((f) => f.includes(needle));
    });
  }, [state.users, q]);

  const onRowClick = useCallback((u) => setSelectedId(u.id), []);
  const closePanel = useCallback(() => setSelectedId(null), []);

  const selectedPreview = useMemo(
    () => state.users.find((u) => u.id === selectedId) ?? null,
    [state.users, selectedId],
  );

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <AdminPageHeader
        eyebrow="Control center"
        title="Usuarios"
        subtitle="Buscador global, tabla operativa y panel lateral: ejecuta acciones sin salir del flujo."
      />

      <motion.div variants={fadeUpBlur} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por email, username, wallet, ID o referidor…"
          className="w-full rounded-xl border border-white/10 bg-slate-950/80 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-cyan-500/40"
          aria-label="Buscar usuarios"
        />
      </motion.div>

      {selectedPreview ? (
        <motion.div variants={fadeUpBlur} className="lg:hidden">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Seleccionado</p>
          <UserDetailCard user={selectedPreview} />
        </motion.div>
      ) : null}

      <motion.div variants={fadeUpBlur} className="overflow-x-auto rounded-2xl border border-white/[0.08]">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-slate-900/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Wallet</th>
              <th className="px-4 py-3">Ref.</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">AIG</th>
              <th className="px-4 py-3 text-right">USD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.length ? (
              filtered.map((u) => {
                const activeRow = u.id === selectedId;
                return (
                  <tr
                    key={u.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onRowClick(u)}
                    onClick={() => onRowClick(u)}
                    className={`cursor-pointer transition ${
                      activeRow ? 'bg-cyan-500/[0.12]' : 'hover:bg-cyan-500/[0.07]'
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-cyan-200/80">{u.id}</td>
                    <td className="px-4 py-3 font-medium text-white">{u.username || '—'}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-400" title={u.email || ''}>
                      {u.email || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500" title={u.wallet || ''}>
                      {shortenWallet(u.wallet)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-400">
                      {u.referrerId || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-200">{u.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      {(u.balances?.aig ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      {(u.balances?.usd ?? 0).toLocaleString()}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  Sin resultados. Ajusta la búsqueda o el criterio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      <UserControlDrawer userId={selectedId} open={Boolean(selectedId)} onClose={closePanel} />
    </motion.div>
  );
}
