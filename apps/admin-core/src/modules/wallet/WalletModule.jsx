import React, { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAdminCore } from '../../context/AdminCoreContext.jsx';
import { ConfirmModal } from '../../components/ConfirmModal.jsx';
import { WalletLedgerFilterBar, DEFAULT_FILTERS } from '../../components/WalletLedgerFilterBar.jsx';
import { WalletLedgerTable } from '../../components/WalletLedgerTable.jsx';
import { WalletBulkActionBar } from '../../components/WalletBulkActionBar.jsx';
import { filterWalletLedger } from '../../utils/walletLedgerFilters.js';
import {
  computeWalletAlerts,
  countAlertsInView,
  mergeWalletMonitoring,
} from '../../utils/walletAlertDetection.js';
import { AdminPageHeader } from '../../components/AdminPageHeader.jsx';
import { WalletAlertPanel } from '../../components/WalletAlertPanel.jsx';
import { staggerContainer, fadeUpBlur } from '../../motion/variants.js';

function WalletModuleInner() {
  const {
    projectWalletLedger,
    projectUsers,
    projectConfig,
    currentProject,
    approveWithdraw,
    rejectWithdraw,
    freezeFunds,
    adjustBalance,
    approveMultipleWithdraw,
    rejectMultipleWithdraw,
    freezeMultiple,
    exportSelection,
    isLoading,
  } = useAdminCore();

  const [confirm, setConfirm] = useState(/** @type {null | { title: string, message: string, onOk: () => void }} */ (null));
  const [quickUser, setQuickUser] = useState('');
  const [qUsd, setQUsd] = useState('');
  const [qAig, setQAig] = useState('');
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [selection, setSelection] = useState(/** @type {string[]} */ ([]));
  const [alertsOnly, setAlertsOnly] = useState(false);

  useEffect(() => {
    setSelection([]);
  }, [currentProject]);

  const wm = useMemo(() => mergeWalletMonitoring(projectConfig), [projectConfig]);

  const alertState = useMemo(
    () => computeWalletAlerts(projectWalletLedger, projectConfig),
    [projectWalletLedger, projectConfig],
  );

  const ask = useCallback((title, message, onOk) => setConfirm({ title, message, onOk }), []);

  const userById = useMemo(() => new Map(projectUsers.map((u) => [u.id, u])), [projectUsers]);

  const filteredLedger = useMemo(
    () => filterWalletLedger(projectWalletLedger, projectUsers, filters),
    [projectWalletLedger, projectUsers, filters],
  );

  const inViewAlerts = useMemo(
    () => countAlertsInView(filteredLedger, alertState.byRowId),
    [filteredLedger, alertState.byRowId],
  );

  const displayedLedger = useMemo(() => {
    if (!alertsOnly) return filteredLedger;
    return filteredLedger.filter((r) => alertState.byRowId[r.id]);
  }, [filteredLedger, alertsOnly, alertState.byRowId]);

  const selectionSet = useMemo(() => new Set(selection), [selection]);

  const selectedRows = useMemo(() => {
    if (!selectionSet.size) return [];
    return projectWalletLedger.filter((r) => selectionSet.has(r.id));
  }, [projectWalletLedger, selectionSet]);

  const pendingWithdrawalIds = useMemo(
    () => selectedRows.filter((r) => r.type === 'withdrawal' && r.status === 'pending').map((r) => r.id),
    [selectedRows],
  );

  const uniqueUsersForFreeze = useMemo(() => {
    const u = [...new Set(selectedRows.map((r) => r.userId).filter(Boolean))];
    return u.length;
  }, [selectedRows]);

  const uniqueUserIdsForFreeze = useMemo(
    () => [...new Set(selectedRows.map((r) => r.userId).filter(Boolean))],
    [selectedRows],
  );

  const bulkBusy = isLoading('wallet-bulk');

  const clearSelection = useCallback(() => setSelection([]), []);

  const toggleRow = useCallback((id) => {
    setSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const onBulkSelectAll = useCallback(
    (selectAll) => {
      const ids = displayedLedger.map((r) => r.id);
      setSelection((prev) => {
        if (selectAll) return [...new Set([...prev, ...ids])];
        const rm = new Set(ids);
        return prev.filter((x) => !rm.has(x));
      });
    },
    [displayedLedger],
  );

  const onApprove = useCallback(
    (id) => {
      if (!currentProject) return;
      ask('Aprobar retiro', `¿Aprobar movimiento ${id}?`, () => approveWithdraw(currentProject, id));
    },
    [ask, approveWithdraw, currentProject],
  );

  const onReject = useCallback(
    (id) => {
      if (!currentProject) return;
      ask('Rechazar retiro', `¿Rechazar ${id}?`, () => rejectWithdraw(currentProject, id));
    },
    [ask, rejectWithdraw, currentProject],
  );

  const onBulkApprove = useCallback(() => {
    if (!currentProject || !pendingWithdrawalIds.length) return;
    const n = pendingWithdrawalIds.length;
    ask(
      'Aprobar en lote',
      `¿Aprobar ${n} retiro(s) pendiente(s)? Esta acción quedará auditada.`,
      () => {
        approveMultipleWithdraw(currentProject, pendingWithdrawalIds).then((r) => {
          if (r?.ok) clearSelection();
        });
      },
    );
  }, [ask, approveMultipleWithdraw, currentProject, pendingWithdrawalIds, clearSelection]);

  const onBulkReject = useCallback(() => {
    if (!currentProject || !pendingWithdrawalIds.length) return;
    const n = pendingWithdrawalIds.length;
    ask(
      'Rechazar en lote',
      `¿Rechazar ${n} retiro(s) pendiente(s)?`,
      () => {
        rejectMultipleWithdraw(currentProject, pendingWithdrawalIds).then((r) => {
          if (r?.ok) clearSelection();
        });
      },
    );
  }, [ask, rejectMultipleWithdraw, currentProject, pendingWithdrawalIds, clearSelection]);

  const onBulkFreeze = useCallback(() => {
    if (!currentProject || !uniqueUserIdsForFreeze.length) return;
    const n = uniqueUserIdsForFreeze.length;
    ask(
      'Congelar en lote',
      `¿Congelar fondos de ${n} usuario(s) distinto(s) según la selección actual?`,
      () => {
        freezeMultiple(currentProject, uniqueUserIdsForFreeze).then((r) => {
          if (r?.ok) clearSelection();
        });
      },
    );
  }, [ask, freezeMultiple, currentProject, uniqueUserIdsForFreeze, clearSelection]);

  const onExport = useCallback(() => {
    exportSelection(selectedRows);
  }, [exportSelection, selectedRows]);

  const toggleAlertsOnly = useCallback(() => setAlertsOnly((v) => !v), []);

  return (
    <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUpBlur}>
        <AdminPageHeader
          eyebrow="Tesorería"
          title="Wallet / ledger global"
          subtitle={`walletLedgerByProject[currentProject] · monitoreo + selección masiva · ${currentProject || '—'}`}
        >
          {wm.enabled && alertState.summary.totalFlagged > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-100">
                {alertState.summary.totalFlagged} alerta{alertState.summary.totalFlagged !== 1 ? 's' : ''}
                {alertState.summary.high > 0 ? (
                  <span className="font-mono text-rose-50">· {alertState.summary.high} alta</span>
                ) : null}
              </span>
            </div>
          ) : wm.enabled ? (
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100/90">
              Sin alertas
            </span>
          ) : null}
        </AdminPageHeader>
      </motion.div>

      <div className="rounded-xl border border-white/[0.08] bg-slate-950/50 p-4">
        <p className="text-[10px] font-bold uppercase text-slate-500">Acciones rápidas</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={quickUser}
            onChange={(e) => setQuickUser(e.target.value)}
            placeholder="User ID"
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <input
            value={qUsd}
            onChange={(e) => setQUsd(e.target.value)}
            placeholder="Δ USD"
            className="w-24 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
          />
          <input
            value={qAig}
            onChange={(e) => setQAig(e.target.value)}
            placeholder="Δ AIG"
            className="w-24 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              currentProject &&
              adjustBalance(currentProject, quickUser.trim(), { usd: Number(qUsd), aig: Number(qAig) })
            }
            className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white"
          >
            Ajustar balance
          </button>
          <button
            type="button"
            onClick={() =>
              ask('Congelar', '¿Congelar fondos?', () =>
                currentProject && freezeFunds(currentProject, quickUser.trim(), true),
              )
            }
            className="rounded-lg border border-rose-500/35 px-3 py-2 text-xs text-rose-200"
          >
            Congelar
          </button>
          <button
            type="button"
            onClick={() =>
              ask('Liberar', '¿Liberar fondos?', () =>
                currentProject && freezeFunds(currentProject, quickUser.trim(), false),
              )
            }
            className="rounded-lg border border-emerald-500/35 px-3 py-2 text-xs text-emerald-200"
          >
            Liberar
          </button>
        </div>
      </div>

      <WalletLedgerFilterBar
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onReset={() => setFilters({ ...DEFAULT_FILTERS })}
        resultCount={displayedLedger.length}
        totalCount={projectWalletLedger.length}
      />

      <WalletAlertPanel
        summary={alertState.summary}
        inViewCount={inViewAlerts}
        alertsOnly={alertsOnly}
        onToggleAlertsOnly={toggleAlertsOnly}
        monitoringEnabled={wm.enabled}
      />

      {alertsOnly ? (
        <p className="text-center text-[11px] text-amber-200/85">
          Vista filtrada: {displayedLedger.length} de {filteredLedger.length} movimientos (post-filtros de columna) tienen
          alerta.
        </p>
      ) : null}

      <WalletLedgerTable
        rows={displayedLedger}
        userById={userById}
        onApproveWithdrawal={onApprove}
        onRejectWithdrawal={onReject}
        selectionSet={selectionSet}
        onToggleRow={toggleRow}
        onBulkSelectAll={onBulkSelectAll}
        bulkDisabled={bulkBusy}
        alertsByRowId={wm.enabled ? alertState.byRowId : undefined}
      />

      <WalletBulkActionBar
        visible={selection.length > 0}
        totalSelected={selection.length}
        pendingWithdrawCount={pendingWithdrawalIds.length}
        uniqueUsersForFreeze={uniqueUsersForFreeze}
        busy={bulkBusy}
        onApproveMultiple={onBulkApprove}
        onRejectMultiple={onBulkReject}
        onFreezeMultiple={onBulkFreeze}
        onExport={onExport}
        onClearSelection={clearSelection}
      />

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

export const WalletModule = memo(WalletModuleInner);
WalletModule.displayName = 'WalletModule';
