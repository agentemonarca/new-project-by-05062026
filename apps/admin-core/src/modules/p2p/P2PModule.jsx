import React, { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Gavel,
  PauseCircle,
  PlayCircle,
  Save,
  Search,
  ShieldOff,
} from 'lucide-react';
import { useAdminCore, marketPausedFromConfig } from '../../context/AdminCoreContext.jsx';
import { AdminPageHeader } from '../../components/AdminPageHeader.jsx';
import { AdminSidePanel } from '../../components/AdminSidePanel.jsx';
import { ConfirmModal } from '../../components/ConfirmModal.jsx';
import { staggerContainer, fadeUpBlur } from '../../motion/variants.js';
import { P2P_CONFIG_DEFAULTS } from '../../data/mockMaster.js';

function orderNotional(o) {
  const a = Number(o?.amount);
  const p = Number(o?.price);
  if (!Number.isFinite(a) || !Number.isFinite(p)) return 0;
  return a * p;
}

function parseOrderTs(o) {
  const t = Date.parse(o?.createdAt ?? '');
  return Number.isFinite(t) ? t : 0;
}

function formatMoney(n) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDateShort(iso) {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return String(iso);
  return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * @param {object[]} orders
 * @param {object} f
 * @param {(userId: string) => string} [usernameHint]
 */
function filterP2POrders(orders, f, usernameHint) {
  const list = Array.isArray(orders) ? orders : [];
  const userN = f.userNeedle.trim().toLowerCase();
  const side = f.side.trim().toLowerCase();
  const status = f.status.trim().toLowerCase();
  const minP = f.minPrice === '' ? null : Number(f.minPrice);
  const maxP = f.maxPrice === '' ? null : Number(f.maxPrice);
  const from = f.dateFrom ? new Date(`${f.dateFrom}T00:00:00`).getTime() : null;
  const to = f.dateTo ? new Date(`${f.dateTo}T23:59:59.999`).getTime() : null;

  return list.filter((o) => {
    if (side && String(o.side || '').toLowerCase() !== side) return false;
    if (status && String(o.status || '').toLowerCase() !== status) return false;
    const price = Number(o.price);
    if (minP != null && Number.isFinite(minP) && price < minP) return false;
    if (maxP != null && Number.isFinite(maxP) && price > maxP) return false;
    const ts = parseOrderTs(o);
    if (from != null && ts < from) return false;
    if (to != null && ts > to) return false;
    if (userN) {
      const uid = String(o.userId ?? '').toLowerCase();
      const uname = String(usernameHint?.(o.userId) ?? '').toLowerCase();
      if (!uid.includes(userN) && !uname.includes(userN)) return false;
    }
    return true;
  });
}

function KpiCard({ icon: Icon, label, value, sub, tone = 'cyan' }) {
  const toneCls =
    tone === 'amber'
      ? 'border-amber-500/25 bg-amber-500/[0.06] text-amber-100'
      : tone === 'rose'
        ? 'border-rose-500/25 bg-rose-500/[0.06] text-rose-100'
        : tone === 'emerald'
          ? 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-100'
          : 'border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-100';
  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneCls}`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-90">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <p className="mt-1.5 font-display text-xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] opacity-75">{sub}</p> : null}
    </div>
  );
}

function P2PModuleInner() {
  const {
    projectOrders,
    projectUsers,
    projectConfig,
    currentProject,
    cancelOrder,
    forceExecuteOrder,
    markDisputed,
    resolveDispute,
    pauseMarket,
    blockUserP2P,
    saveProjectConfig,
    isLoading,
  } = useAdminCore();

  const [confirm, setConfirm] = useState(
    /** @type {null | { title: string, message: string, onOk: () => void, danger?: boolean, confirmLabel?: string }} */ (
      null
    ),
  );
  const [sideFilter, setSideFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userNeedle, setUserNeedle] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState(/** @type {object | null} */ (null));
  const [disputeNoteDraftPanel, setDisputeNoteDraftPanel] = useState('');
  const [p2pDraft, setP2pDraft] = useState(() => ({ ...P2P_CONFIG_DEFAULTS }));

  const ask = useCallback((title, message, onOk, opts) => {
    setConfirm({
      title,
      message,
      onOk,
      danger: opts?.danger ?? true,
      confirmLabel: opts?.confirmLabel ?? 'Confirmar',
    });
  }, []);

  const userLabel = useCallback(
    (uid) => projectUsers.find((u) => u.id === uid)?.username ?? uid ?? '—',
    [projectUsers],
  );

  const userRecord = useCallback((uid) => projectUsers.find((u) => u.id === uid) ?? null, [projectUsers]);

  const marketPaused = marketPausedFromConfig(projectConfig);
  const p2pEnabled = Boolean(projectConfig?.rules?.p2pEnabled ?? projectConfig?.flags?.p2pEnabled ?? true);

  useEffect(() => {
    const raw = projectConfig?.p2p;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      setP2pDraft({ ...P2P_CONFIG_DEFAULTS, ...raw });
    } else {
      setP2pDraft({ ...P2P_CONFIG_DEFAULTS });
    }
  }, [currentProject, projectConfig]);

  const filters = useMemo(
    () => ({
      side: sideFilter,
      status: statusFilter,
      userNeedle,
      minPrice,
      maxPrice,
      dateFrom,
      dateTo,
    }),
    [sideFilter, statusFilter, userNeedle, minPrice, maxPrice, dateFrom, dateTo],
  );

  const filteredOrders = useMemo(() => {
    const unameHint = (uid) => projectUsers.find((u) => u.id === uid)?.username ?? '';
    const list = filterP2POrders(projectOrders, filters, unameHint);
    return [...list].sort((a, b) => parseOrderTs(b) - parseOrderTs(a));
  }, [projectOrders, filters, projectUsers]);

  const kpis = useMemo(() => {
    const openBook = projectOrders.filter((o) => o.status === 'open' || o.status === 'disputed');
    const volume = openBook.reduce((s, o) => s + orderNotional(o), 0);
    const activeCount = projectOrders.filter((o) => o.status === 'open' || o.status === 'disputed').length;
    const disputeCount = projectOrders.filter((o) => o.status === 'disputed').length;
    let marketLabel = 'Activo';
    let marketTone = /** @type {'emerald' | 'amber' | 'rose' | 'cyan'} */ ('emerald');
    if (!p2pEnabled) {
      marketLabel = 'P2P deshabilitado';
      marketTone = 'rose';
    } else if (marketPaused) {
      marketLabel = 'Mercado pausado';
      marketTone = 'amber';
    }
    return { volume, activeCount, disputeCount, marketLabel, marketTone };
  }, [projectOrders, marketPaused, p2pEnabled]);

  const saveP2pConfig = useCallback(async () => {
    if (!currentProject) return;
    const key = 'config-p2p';
    const loading = isLoading(key);
    if (loading) return;
    await saveProjectConfig(currentProject, { p2p: { ...p2pDraft } });
  }, [currentProject, p2pDraft, saveProjectConfig, isLoading]);

  const onP2pNumber = useCallback((field) => (e) => {
    const v = e.target.value;
    const fallback = P2P_CONFIG_DEFAULTS[field] ?? 0;
    const n = v === '' ? fallback : Number(v);
    setP2pDraft((d) => ({
      ...d,
      [field]: Number.isFinite(n) ? n : d[field],
    }));
  }, []);

  const selectedUser = selected ? userRecord(selected.userId) : null;

  useEffect(() => {
    if (selected?.disputeNote != null) setDisputeNoteDraftPanel(String(selected.disputeNote));
    else setDisputeNoteDraftPanel('');
  }, [selected?.id, selected?.disputeNote]);

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUpBlur}>
        <AdminPageHeader
          eyebrow="P2P Control Center"
          title="Mercado P2P"
          subtitle="Libro, disputas y parámetros operativos · vista exchange"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!p2pEnabled}
              onClick={() =>
                ask(
                  marketPaused ? 'Reanudar mercado' : 'Pausar mercado',
                  marketPaused
                    ? '¿Reanudar matching y colocación de órdenes?'
                    : 'Las nuevas operaciones quedarán en espera. ¿Continuar?',
                  () => currentProject && pauseMarket(currentProject, !marketPaused),
                  { danger: !marketPaused, confirmLabel: marketPaused ? 'Reanudar' : 'Pausar' },
                )
              }
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition disabled:opacity-40 ${
                marketPaused
                  ? 'bg-emerald-600/90 text-white hover:bg-emerald-500'
                  : 'border border-amber-400/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15'
              }`}
            >
              {marketPaused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
              {marketPaused ? 'Reanudar mercado' : 'Pausar mercado'}
            </button>
          </div>
        </AdminPageHeader>
      </motion.div>

      <motion.div variants={fadeUpBlur} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={BookOpen}
          label="Volumen libro (notional)"
          value={`$${formatMoney(kpis.volume)}`}
          sub="Suma open + disputas"
        />
        <KpiCard
          icon={Activity}
          label="Órdenes activas"
          value={String(kpis.activeCount)}
          sub="Estado open o disputed"
          tone="cyan"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Disputas abiertas"
          value={String(kpis.disputeCount)}
          sub="Requieren resolución"
          tone={kpis.disputeCount > 0 ? 'rose' : 'cyan'}
        />
        <KpiCard
          icon={Gavel}
          label="Estado mercado"
          value={kpis.marketLabel}
          sub={p2pEnabled ? (marketPaused ? 'Matching detenido' : 'Operativo') : 'Reglas proyecto'}
          tone={kpis.marketTone}
        />
      </motion.div>

      <motion.div
        variants={fadeUpBlur}
        className="rounded-2xl border border-white/[0.08] bg-slate-950/45 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Configuración P2P · config.p2p
          </p>
          <button
            type="button"
            onClick={() => saveP2pConfig()}
            disabled={!currentProject || isLoading('config-save')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600/85 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Guardar
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[
            ['escrowTimeoutMinutes', 'Escrow (min)'],
            ['disputeWindowHours', 'Ventana disputa (h)'],
            ['takerFeeBps', 'Fee taker (bps)'],
            ['makerFeeBps', 'Fee maker (bps)'],
            ['minNotionalUsd', 'Mín. notional USD'],
            ['maxOpenOrdersPerUser', 'Max órdenes / usuario'],
          ].map(([key, label]) => (
            <label key={key} className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">{label}</span>
              <input
                type="number"
                min={0}
                value={p2pDraft[key] ?? ''}
                onChange={onP2pNumber(key)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
              />
            </label>
          ))}
          <label className="flex items-end gap-2 pb-0.5 sm:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(p2pDraft.requireKycForSell)}
              onChange={(e) => setP2pDraft((d) => ({ ...d, requireKycForSell: e.target.checked }))}
              className="h-4 w-4 rounded border-white/20"
            />
            <span className="text-sm text-slate-300">Exigir KYC para ofertas de venta</span>
          </label>
        </div>
      </motion.div>

      <motion.div
        variants={fadeUpBlur}
        className="rounded-2xl border border-white/[0.08] bg-slate-950/40 p-4"
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filtros de órdenes</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Tipo</span>
            <select
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
            >
              <option value="">Todos</option>
              <option value="buy">Compra</option>
              <option value="sell">Venta</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Estado</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
            >
              <option value="">Todos</option>
              <option value="open">open</option>
              <option value="filled">filled</option>
              <option value="cancelled">cancelled</option>
              <option value="disputed">disputed</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Usuario (id)</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={userNeedle}
                onChange={(e) => setUserNeedle(e.target.value)}
                placeholder="ID o nombre de usuario…"
                className="w-full rounded-lg border border-white/10 bg-slate-900 py-2 pl-8 pr-3 text-sm text-white"
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Precio mín.</span>
            <input
              type="number"
              step="any"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Precio máx.</span>
            <input
              type="number"
              step="any"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-xs text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-xs text-white"
              />
            </label>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSideFilter('');
            setStatusFilter('');
            setUserNeedle('');
            setMinPrice('');
            setMaxPrice('');
            setDateFrom('');
            setDateTo('');
          }}
          className="mt-3 text-xs font-semibold text-cyan-400/90 hover:text-cyan-300"
        >
          Limpiar filtros
        </button>
      </motion.div>

      <motion.div variants={fadeUpBlur} className="overflow-x-auto rounded-2xl border border-white/[0.08]">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-slate-900/65 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-3">Usuario</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">Precio</th>
              <th className="px-3 py-3">Cantidad</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3 text-right">Notional</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filteredOrders.length ? (
              filteredOrders.map((o) => {
                const disputed = o.status === 'disputed';
                const activeRow = disputed || o.status === 'open';
                return (
                  <tr
                    key={o.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(o)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(o);
                      }
                    }}
                    className={`cursor-pointer transition ${
                      disputed
                        ? 'bg-amber-500/[0.08] ring-1 ring-inset ring-amber-400/20'
                        : activeRow
                          ? 'hover:bg-white/[0.03]'
                          : 'hover:bg-white/[0.02] opacity-90'
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-slate-200">{userLabel(o.userId)}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{o.userId}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                          o.side === 'buy'
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : 'bg-rose-500/15 text-rose-200'
                        }`}
                      >
                        {o.side}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-200">{formatMoney(Number(o.price))}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-300">{formatMoney(Number(o.amount))}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          disputed
                            ? 'bg-amber-500/25 text-amber-100'
                            : o.status === 'open'
                              ? 'bg-cyan-500/15 text-cyan-100'
                              : o.status === 'filled'
                                ? 'bg-slate-500/20 text-slate-200'
                                : 'bg-slate-600/30 text-slate-300'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-slate-500">
                      {formatDateShort(o.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-cyan-200/80">
                      ${formatMoney(orderNotional(o))}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-slate-500">
                  Sin órdenes que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      <AdminSidePanel
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        eyebrow="Orden P2P"
        title={selected?.id ?? '—'}
        subtitle={selected ? `${userLabel(selected.userId)} · ${selected.side?.toUpperCase?.() ?? ''}` : ''}
        widthClassName="md:max-w-lg"
      >
        {selected ? (
          <div className="space-y-5 text-sm">
            <dl className="grid gap-2 text-xs">
              {[
                ['Usuario', userLabel(selected.userId)],
                ['userId', selected.userId],
                ['Tipo', String(selected.side ?? '—').toUpperCase()],
                ['Precio', formatMoney(Number(selected.price))],
                ['Cantidad', formatMoney(Number(selected.amount))],
                ['Notional', `$${formatMoney(orderNotional(selected))}`],
                ['Estado', selected.status],
                ['Creada', formatDateShort(selected.createdAt)],
                ...(selected.status === 'disputed'
                  ? [
                      ['Disputa desde', formatDateShort(selected.disputedAt)],
                      ['Nota', selected.disputeNote || '—'],
                    ]
                  : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-white/[0.06] py-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="max-w-[60%] text-right text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>

            {selectedUser?.p2pBlocked ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                Usuario con P2P bloqueado administrativamente.
              </p>
            ) : null}

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-slate-500">Acciones</p>
              <div className="flex flex-col gap-2">
                {selected.status === 'open' ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        ask(
                          'Marcar disputa',
                          'La orden quedará en estado disputed hasta resolución.',
                          () =>
                            currentProject &&
                            markDisputed(currentProject, selected.id, disputeNoteDraftPanel.trim()),
                          { danger: true, confirmLabel: 'Marcar disputa' },
                        )
                      }
                      className="rounded-xl border border-amber-400/35 bg-amber-500/10 py-2.5 text-xs font-semibold text-amber-100"
                    >
                      Marcar disputa
                    </button>
                    <textarea
                      value={disputeNoteDraftPanel}
                      onChange={(e) => setDisputeNoteDraftPanel(e.target.value)}
                      placeholder="Nota operador (opcional)"
                      rows={2}
                      className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                  </>
                ) : null}

                {selected.status === 'disputed' ? (
                  <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
                    <p className="text-[11px] font-semibold text-amber-100">Resolver disputa</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          ask(
                            'Reabrir orden',
                            'Volverá a open para continuar el ciclo P2P.',
                            () => currentProject && resolveDispute(currentProject, selected.id, 'reopen'),
                            { danger: false, confirmLabel: 'Reabrir' },
                          )
                        }
                        className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-white"
                      >
                        Reabrir (open)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          ask(
                            'Completar operación',
                            'Marcar orden como filled (ej. liberar a favor del trade).',
                            () => currentProject && resolveDispute(currentProject, selected.id, 'complete'),
                            { danger: false, confirmLabel: 'Completar' },
                          )
                        }
                        className="rounded-lg bg-emerald-600/85 px-3 py-2 text-xs text-white"
                      >
                        Completar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          ask(
                            'Cancelar tras disputa',
                            'La orden pasará a cancelled.',
                            () => currentProject && resolveDispute(currentProject, selected.id, 'cancel'),
                            { danger: true, confirmLabel: 'Cancelar' },
                          )
                        }
                        className="rounded-lg bg-rose-600/80 px-3 py-2 text-xs text-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}

                {selected.status === 'open' || selected.status === 'disputed' ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        ask(
                          'Cancelar orden',
                          `¿Cancelar ${selected.id}?`,
                          () => currentProject && cancelOrder(currentProject, selected.id),
                          { danger: true },
                        )
                      }
                      className="rounded-xl border border-rose-500/40 py-2.5 text-xs font-semibold text-rose-200"
                    >
                      Cancelar orden
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        ask(
                          'Forzar ejecución',
                          'Simulación administrativa: estado filled.',
                          () => currentProject && forceExecuteOrder(currentProject, selected.id),
                          { danger: true, confirmLabel: 'Ejecutar' },
                        )
                      }
                      className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 py-2.5 text-xs font-semibold text-cyan-100"
                    >
                      Forzar ejecución (filled)
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    ask(
                      selectedUser?.p2pBlocked ? 'Desbloquear P2P' : 'Bloquear P2P',
                      `Usuario ${selected.userId}`,
                      () =>
                        currentProject &&
                        blockUserP2P(currentProject, selected.userId, !selectedUser?.p2pBlocked),
                      { danger: !selectedUser?.p2pBlocked },
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 py-2.5 text-xs font-semibold text-slate-200"
                >
                  <ShieldOff className="h-4 w-4 opacity-80" />
                  {selectedUser?.p2pBlocked ? 'Desbloquear usuario en P2P' : 'Bloquear usuario en P2P'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </AdminSidePanel>

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        danger={confirm?.danger ?? true}
        confirmLabel={confirm?.confirmLabel ?? 'Confirmar'}
        onConfirm={() => {
          confirm?.onOk?.();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </motion.div>
  );
}

export const P2PModule = memo(P2PModuleInner);
P2PModule.displayName = 'P2PModule';
