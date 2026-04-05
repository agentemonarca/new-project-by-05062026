import React, { memo, useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownLeft,
  BarChart3,
  ChevronDown,
  ExternalLink,
  Layers,
  RefreshCw,
  Search,
} from 'lucide-react';
import { GlassCard } from '../GlassCard.jsx';
import { GradientButton } from '../GradientButton.jsx';
import { mapLedgerEventsToOperative } from '../../ledger/mapLedgerToOperative.js';
import { aggregateOperativeAnalytics } from '../../ledger/operativeAnalytics.js';
import {
  CORE_MINING_MONTHLY_PCT,
  MIN_AIG_HOLDING_PCT_DISPLAY,
  MIN_CONVERSION_USDT,
} from '../../ledger/operativeConstants.js';
import { RuleHint } from '../RuleHint.jsx';
import { operativeRowMatchesTab, operativeSmartSearch } from '../../ledger/operativeTabFilter.js';
import { fadeUpBlur } from '../../motion/variants.js';

const TABS = [
  { id: 'todos', label: 'Todos' },
  { id: 'mineria', label: 'Minería' },
  { id: 'bonos', label: 'Bonos' },
  { id: 'staking', label: 'Staking' },
  { id: 'conversiones', label: 'Conversiones' },
  { id: 'retiros', label: 'Retiros' },
  { id: 'compras', label: 'Compras' },
  { id: 'equipo', label: 'Equipo' },
];

/** @param {{ row: import('../../ledger/operativeLedgerModel.js').OperativeTransaction }} props */
function accentForRow(row) {
  if (row.type === 'withdrawal') return 'withdraw';
  if (row.type === 'conversion') return 'conversion';
  switch (row.source) {
    case 'mining':
      return 'mining';
    case 'direct':
      return 'direct';
    case 'binary':
      return 'binary';
    case 'staking':
      return 'staking';
    default:
      return 'neutral';
  }
}

const ACCENT_STYLES = {
  mining: {
    bar: 'bg-cyan-400',
    border: 'border-cyan-500/35',
    glow: 'shadow-[0_0_28px_-6px_rgba(34,211,238,0.45)]',
    label: 'text-cyan-200/95',
  },
  direct: {
    bar: 'bg-fuchsia-500',
    border: 'border-fuchsia-500/35',
    glow: 'shadow-[0_0_28px_-6px_rgba(217,70,239,0.4)]',
    label: 'text-fuchsia-200/95',
  },
  binary: {
    bar: 'bg-violet-500',
    border: 'border-violet-500/35',
    glow: 'shadow-[0_0_28px_-6px_rgba(139,92,246,0.45)]',
    label: 'text-violet-200/95',
  },
  staking: {
    bar: 'bg-amber-400',
    border: 'border-amber-500/30',
    glow: 'shadow-[0_0_24px_-6px_rgba(251,191,36,0.35)]',
    label: 'text-amber-200/95',
  },
  withdraw: {
    bar: 'bg-rose-500',
    border: 'border-rose-500/40',
    glow: 'shadow-[0_0_28px_-6px_rgba(244,63,94,0.4)]',
    label: 'text-rose-200/95',
  },
  conversion: {
    bar: 'bg-emerald-400',
    border: 'border-emerald-500/35',
    glow: 'shadow-[0_0_28px_-6px_rgba(52,211,153,0.4)]',
    label: 'text-emerald-200/95',
  },
  neutral: {
    bar: 'bg-slate-500',
    border: 'border-white/10',
    glow: '',
    label: 'text-slate-300',
  },
};

function shortenHash(h) {
  if (!h || h.length < 18) return h || '—';
  return `${h.slice(0, 10)}…${h.slice(-8)}`;
}

function statusPill(status) {
  const cls =
    status === 'pending'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
      : status === 'failed'
        ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
        : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100';
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

/** @param {{ row: import('../../ledger/operativeLedgerModel.js').OperativeTransaction, open: boolean, onToggle: () => void }} props */
const OperativeRow = memo(function OperativeRow({ row, open, onToggle }) {
  const a = accentForRow(row);
  const st = ACCENT_STYLES[a] || ACCENT_STYLES.neutral;
  const glowClass = row.importance === 'high' ? st.glow : '';

  return (
    <div
      className={`rounded-xl border ${st.border} bg-slate-950/55 backdrop-blur-sm transition ${glowClass} ${
        open ? 'ring-1 ring-white/10' : ''
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left md:items-center md:gap-4 md:p-4"
      >
        <div className={`mt-1 h-full w-1 shrink-0 self-stretch rounded-full md:mt-0 md:self-center ${st.bar}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${st.label}`}>{row.source}</span>
            <span className="font-mono text-[10px] text-slate-500">{row.type}</span>
            {statusPill(row.status)}
          </div>
          <p className="mt-1 font-display text-sm font-semibold text-white">{row.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{row.summary}</p>
          <p className="mt-2 font-mono text-[10px] text-slate-600">{shortenHash(row.hash)} · id {row.id}</p>
        </div>
        <div className="shrink-0 text-right">
          {row.amount_usdt > 0 ? (
            <p className="font-display text-sm font-bold tabular-nums text-white">{row.amount_usdt.toFixed(4)} USDT</p>
          ) : null}
          {row.amount_aig > 0 ? (
            <p className="mt-0.5 font-mono text-xs tabular-nums text-cyan-200/90">{row.amount_aig.toFixed(2)} AIG</p>
          ) : null}
          <ChevronDown
            className={`ml-auto mt-2 h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="space-y-3 p-4 pt-3 text-xs text-slate-300 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-2">
              <DetailLine label="Fuente de ingreso" value={row.source} />
              <DetailLine
                label="Usuario / wallet"
                value={
                  [row.related_user.username, row.related_user.wallet ? shortenHash(row.related_user.wallet) : null]
                    .filter(Boolean)
                    .join(' · ') || '—'
                }
              />
              <DetailLine label="Producto" value={row.product} />
              <DetailLine label="Volumen generado" value={row.volume_generated > 0 ? String(row.volume_generated) : '—'} />
              <DetailLine
                label="Comisión / ingreso"
                value={
                  row.commission_earned > 0
                    ? `${row.commission_earned.toFixed(4)} (equiv.)`
                    : row.amount_usdt > 0 || row.amount_aig > 0
                      ? `${row.amount_usdt.toFixed(4)} USDT / ${row.amount_aig.toFixed(2)} AIG`
                      : '—'
                }
              />
              {row.type === 'conversion' ? (
                <>
                  <DetailLine
                    label="Conversión"
                    value={`Mín. ${MIN_CONVERSION_USDT} USDT · Precio ${row.conversion_price != null ? row.conversion_price : '—'} USDT/AIG`}
                  />
                  <DetailLine
                    label="AIG recibido (final)"
                    value={
                      row.conversion_aig_out != null
                        ? `${row.conversion_aig_out.toFixed(2)} AIG`
                        : row.amount_aig > 0
                          ? `${row.amount_aig.toFixed(2)} AIG`
                          : '—'
                    }
                  />
                  {row.conversion_usdt_in != null && row.conversion_usdt_in > 0 && row.conversion_usdt_in < MIN_CONVERSION_USDT ? (
                    <p className="md:col-span-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-100/95">
                      Por debajo del mínimo operativo ({MIN_CONVERSION_USDT} USDT) — revisión de elegibilidad.
                    </p>
                  ) : null}
                </>
              ) : null}
              {(row.source === 'mining' || row.mining_track) && (
                <div className="md:col-span-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                  <p className="font-display text-[10px] font-bold uppercase tracking-wider text-cyan-200/80">
                    Seguimiento minería
                  </p>
                  {row.mining_track === 'booster' ? (
                    <p className="mt-1 text-slate-300">
                      Booster mining: tasa dinámica ~{row.booster_pct_dynamic != null ? `${row.booster_pct_dynamic}%` : 'variable'} · acumulación según multiplicador de protocolo.
                    </p>
                  ) : (
                    <p className="mt-1 text-slate-300">
                      Core mining: referencia ~{CORE_MINING_MONTHLY_PCT}% mensual con devengo diario.
                      {row.daily_accrual_usdt != null
                        ? ` · Acumulación diaria mostrada: ${row.daily_accrual_usdt.toFixed(6)} USDT/d`
                        : ''}
                    </p>
                  )}
                </div>
              )}
              {row.team && (row.team.level === 'direct' || row.team.level === 'indirect') ? (
                <div className="md:col-span-2 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
                  <p className="font-display text-[10px] font-bold uppercase tracking-wider text-violet-200/90">
                    Ingresos de equipo
                  </p>
                  <ul className="mt-2 space-y-1 text-slate-300">
                    <li>
                      <span className="text-slate-500">Usuario:</span> {row.team.username ?? '—'}
                    </li>
                    <li>
                      <span className="text-slate-500">Nivel:</span>{' '}
                      {row.team.level === 'direct' ? 'Directo' : 'Indirecto'}
                    </li>
                    <li>
                      <span className="text-slate-500">Volumen generado:</span>{' '}
                      {row.team.volumeGenerated != null ? row.team.volumeGenerated : row.volume_generated || '—'}
                    </li>
                    <li>
                      <span className="text-slate-500">Comisión ganada:</span>{' '}
                      {row.team.commissionEarned != null ? row.team.commissionEarned.toFixed(4) : row.commission_earned.toFixed(4)}
                    </li>
                  </ul>
                </div>
              ) : null}
              {!row.product_active ? (
                <p className="md:col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100/95">
                  Sin devengo: producto no activo en protocolo.
                </p>
              ) : null}
              {row.hash ? (
                <a
                  href={`https://bscscan.com/tx/${row.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 md:col-span-2"
                >
                  Explorador <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
});

function DetailLine({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-slate-200">{value}</p>
    </div>
  );
}

const PAGE_SIZE = 12;

/**
 * @param {{
 *   events: import('../../ledger/ledgerModel.js').LedgerEvent[],
 *   loading: boolean,
 *   onRefresh: () => void,
 *   accountFrozen: boolean,
 *   economicActive: boolean,
 *   hasSession: boolean,
 * }} props
 */
export function OperativeLedgerExplorer({
  events,
  loading,
  onRefresh,
  accountFrozen,
  economicActive,
  hasSession,
}) {
  const [tab, setTab] = useState('todos');
  const [search, setSearch] = useState('');
  const [analysis, setAnalysis] = useState(false);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(/** @type {string | null} */ (null));

  const rows = useMemo(() => mapLedgerEventsToOperative(events), [events]);

  const inactiveProductCount = useMemo(() => rows.filter((r) => !r.product_active).length, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const afterTab = rows.filter((r) => operativeRowMatchesTab(r, tab));
    return operativeSmartSearch(afterTab, q);
  }, [rows, tab, search]);

  const analytics = useMemo(() => aggregateOperativeAnalytics(rows), [rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  const toggle = useCallback((id) => {
    setOpenId((cur) => (cur === id ? null : id));
  }, []);

  return (
    <div className="space-y-6">
      {(accountFrozen || (!economicActive && hasSession) || inactiveProductCount > 0) && (
        <motion.div variants={fadeUpBlur} className="space-y-2">
          {accountFrozen ? (
            <div className="rounded-xl border border-rose-500/35 bg-rose-950/35 px-4 py-3 text-sm text-rose-100">
              Cuenta congelada: no cumple el {MIN_AIG_HOLDING_PCT_DISPLAY}% de holding AIG mínimo — algunos devengos pueden no acreditarse.
            </div>
          ) : null}
          {!economicActive && hasSession && !accountFrozen ? (
            <div className="rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
              Economía inactiva: revisa staking, holding y elegibilidad de red para devengos operativos.
            </div>
          ) : null}
          {inactiveProductCount > 0 ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
              Sin ingresos en {inactiveProductCount} registro(s): producto no activo.
            </div>
          ) : null}
        </motion.div>
      )}

      <GlassCard className="p-4 md:p-5" contentClassName="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-cyan-400/90" strokeWidth={1.5} />
            <div>
              <h3 className="font-display text-sm font-semibold text-white">Historial operativo</h3>
              <p className="text-[11px] text-slate-500">Explorador financiero · transparencia tipo cadena</p>
              <RuleHint
                variant="inline"
                className="mt-2"
                message={`Mínimo requerido: ${MIN_CONVERSION_USDT} USDT`}
                linkText="ℹ️ Detalles"
                modalTitle="Conversiones USDT → AIG"
                modalContent={
                  <div className="space-y-2 text-slate-300">
                    <p>
                      En la interfaz se muestra un piso mínimo de volumen para ciertas conversiones. El precio aplicado y el AIG
                      recibido dependen del motor y del estado de la cuenta.
                    </p>
                    <p className="text-[11px] text-slate-500">Revise cada fila en la pestaña Conversiones para importes concretos.</p>
                  </div>
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAnalysis((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                analysis
                  ? 'border-violet-500/40 bg-violet-500/15 text-violet-100'
                  : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Modo análisis
            </button>
            <GradientButton type="button" variant="ghost" className="!text-xs" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`mr-1.5 inline h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar
            </GradientButton>
          </div>
        </div>

        {analysis ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[
              { k: 'Minería (USDT)', v: analytics.mining_usdt, sub: `Core ${analytics.mining_core_usdt.toFixed(2)} · Booster ${analytics.mining_booster_usdt.toFixed(2)}`, tone: 'cyan' },
              { k: 'Binario (USDT)', v: analytics.binary_usdt, sub: 'Bonos red binaria', tone: 'violet' },
              { k: 'Directo (USDT)', v: analytics.direct_usdt, sub: 'Primer nivel / referral', tone: 'fuchsia' },
              { k: 'Convertido (AIG)', v: analytics.converted_aig, sub: `Vol. conv. ${analytics.conversion_volume_usdt.toFixed(2)} USDT`, tone: 'emerald' },
            ].map((card) => (
              <div
                key={card.k}
                className={`rounded-xl border border-white/10 bg-slate-950/60 p-4 shadow-inner ${
                  card.tone === 'cyan'
                    ? 'shadow-[inset_0_0_20px_-8px_rgba(34,211,238,0.25)]'
                    : card.tone === 'violet'
                      ? 'shadow-[inset_0_0_20px_-8px_rgba(139,92,246,0.25)]'
                      : card.tone === 'fuchsia'
                        ? 'shadow-[inset_0_0_20px_-8px_rgba(217,70,239,0.2)]'
                        : 'shadow-[inset_0_0_20px_-8px_rgba(52,211,153,0.2)]'
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{card.k}</p>
                <p className="mt-2 font-display text-xl font-bold tabular-nums text-white">{Number(card.v).toFixed(4)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{card.sub}</p>
              </div>
            ))}
          </motion.div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-1.5 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                tab === t.id ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-500/30' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="relative mt-4 flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar: TX, wallet, usuario, producto…"
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 py-2.5 pl-10 pr-4 font-mono text-xs text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          />
        </label>

        <div className="mt-6 min-h-[120px] space-y-3">
          {loading && rows.length === 0 ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
            </div>
          ) : paged.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/30 px-6 py-12 text-center text-sm text-slate-500">
              <ArrowDownLeft className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3">Sin movimientos con los filtros actuales.</p>
            </div>
          ) : (
            paged.map((row) => (
              <OperativeRow key={row.id} row={row} open={openId === row.id} onToggle={() => toggle(row.id)} />
            ))
          )}
        </div>

        {totalPages > 1 ? (
          <div className="mt-6 flex items-center justify-center gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="font-mono text-xs text-slate-500">
              {pageSafe} / {totalPages}
            </span>
            <button
              type="button"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
}
