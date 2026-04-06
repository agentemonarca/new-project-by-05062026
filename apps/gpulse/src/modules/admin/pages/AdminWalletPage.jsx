import React, { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdmin } from '../context/AdminContext.jsx';
import { AdminPageHeader } from './AdminPageHeader.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';
import {
  WalletLedgerFilterBar,
  DEFAULT_FILTERS,
} from '../components/WalletLedgerFilterBar.jsx';
import { WalletLedgerTable } from '../components/WalletLedgerTable.jsx';
import { filterWalletLedger } from '../utils/walletLedgerFilters.js';
import { staggerContainer, fadeUpBlur } from '@/ui-genesis/motion/variants.js';

export function AdminWalletPage() {
  const { state, walletActions, adjustUserBalance } = useAdmin();
  const [confirm, setConfirm] = useState(/** @type {null | { title: string, message: string, onOk: () => void }} */ (null));
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [adjUser, setAdjUser] = useState('');
  const [adjAig, setAdjAig] = useState('');
  const [adjUsd, setAdjUsd] = useState('');

  const ledger = state.walletLedger ?? [];

  const openConfirm = useCallback((title, message, onOk) => setConfirm({ title, message, onOk }), []);

  const onFilterChange = useCallback((patch) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  const onResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const userById = useMemo(() => {
    const m = new Map();
    for (const u of state.users || []) m.set(u.id, u);
    return m;
  }, [state.users]);

  const filteredLedger = useMemo(
    () => filterWalletLedger(ledger, state.users || [], filters),
    [ledger, state.users, filters],
  );

  const onApproveWithdrawal = useCallback(
    (id) =>
      openConfirm('Aprobar retiro', `¿Aprobar ${id}?`, () => walletActions.approveWithdrawal(id)),
    [openConfirm, walletActions],
  );

  const onRejectWithdrawal = useCallback(
    (id) =>
      openConfirm('Rechazar retiro', `¿Rechazar ${id}?`, () => walletActions.rejectWithdrawal(id)),
    [openConfirm, walletActions],
  );

  const runConfirm = useCallback(() => {
    confirm?.onOk?.();
    setConfirm(null);
  }, [confirm]);

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <AdminPageHeader
        eyebrow="Tesorería"
        title="Wallet"
        subtitle="Movimientos unificados con filtros avanzados, retiros y controles operativos (mock)."
      />

      <motion.div variants={fadeUpBlur} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(state.users || []).map((u) => (
          <div
            key={u.id}
            className="rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 py-3 text-sm"
          >
            <p className="font-mono text-[10px] text-cyan-300/80">{u.id}</p>
            <p className="truncate font-medium text-white">{u.username}</p>
            <p className="mt-2 font-mono text-xs text-slate-300">
              AIG {Number(u.balances?.aig || 0).toLocaleString()}
            </p>
            <p className="font-mono text-xs text-slate-300">
              USD {Number(u.balances?.usd || 0).toLocaleString()}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {u.fundsFrozen ? 'Congelado' : 'Liquidez activa'}
            </p>
          </div>
        ))}
      </motion.div>

      <motion.div variants={fadeUpBlur} className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Libro mayor / tesorería</p>
        <WalletLedgerFilterBar
          filters={filters}
          onChange={onFilterChange}
          onReset={onResetFilters}
          resultCount={filteredLedger.length}
          totalCount={ledger.length}
        />
        <WalletLedgerTable
          rows={filteredLedger}
          userById={userById}
          onApproveWithdrawal={onApproveWithdrawal}
          onRejectWithdrawal={onRejectWithdrawal}
        />
      </motion.div>

      <motion.div variants={fadeUpBlur} className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
        <p className="text-[10px] font-bold uppercase text-slate-500">Ajuste / congelación rápida</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={adjUser}
            onChange={(e) => setAdjUser(e.target.value)}
            placeholder="User ID"
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/30"
          />
          <input
            value={adjAig}
            onChange={(e) => setAdjAig(e.target.value)}
            placeholder="Δ AIG"
            className="w-24 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/30"
          />
          <input
            value={adjUsd}
            onChange={(e) => setAdjUsd(e.target.value)}
            placeholder="Δ USD"
            className="w-24 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/30"
          />
          <button
            type="button"
            onClick={() => adjustUserBalance(adjUser.trim(), { aig: Number(adjAig), usd: Number(adjUsd) })}
            className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
          >
            Ajustar balance
          </button>
          <button
            type="button"
            onClick={() =>
              openConfirm('Congelar fondos', '¿Congelar fondos del usuario?', () =>
                walletActions.freezeFunds(adjUser.trim(), true),
              )
            }
            className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/10"
          >
            Congelar
          </button>
          <button
            type="button"
            onClick={() =>
              openConfirm('Liberar fondos', '¿Liberar fondos del usuario?', () =>
                walletActions.freezeFunds(adjUser.trim(), false),
              )
            }
            className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/10"
          >
            Liberar
          </button>
        </div>
      </motion.div>

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        danger
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </motion.div>
  );
}
