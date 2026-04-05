import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronRight,
  Gift,
  Info,
  Sparkles,
} from 'lucide-react';
import { GlassCard } from './GlassCard.jsx';
import { usePaymentLedgerStore } from '../stores/paymentLedgerStore.js';
import { useGenesisNotificationStore } from '../stores/genesisNotificationStore.js';
import { buildGenesisNotifications } from '../notifications/buildGenesisNotifications.js';

/** @param {import('../notifications/buildGenesisNotifications.js').GenesisNotificationSeverity} s */
function severityRank(s) {
  if (s === 'critical') return 3;
  if (s === 'warning') return 2;
  return 1;
}

/** @param {import('../notifications/buildGenesisNotifications.js').GenesisNotificationSeverity} s */
function severityDotClass(s) {
  if (s === 'critical') return 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.9)]';
  if (s === 'warning') return 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.85)]';
  return 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.85)]';
}

function formatNotifTime(ts) {
  const d = Date.now() - ts;
  if (d < 45_000) return 'Hace un momento';
  if (d < 3600_000) return `Hace ${Math.max(1, Math.floor(d / 60_000))} min`;
  if (d < 86_400_000) return `Hace ${Math.floor(d / 3600_000)} h`;
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    ts,
  );
}

function CategoryIcon({ category }) {
  const cl = 'h-4 w-4 shrink-0';
  switch (category) {
    case 'rewards':
      return <Gift className={`${cl} text-fuchsia-300/90`} strokeWidth={1.75} />;
    case 'alerts':
      return <AlertTriangle className={`${cl} text-amber-300/90`} strokeWidth={1.75} />;
    case 'system':
      return <Info className={`${cl} text-cyan-300/90`} strokeWidth={1.75} />;
    default:
      return <Activity className={`${cl} text-violet-300/85`} strokeWidth={1.75} />;
  }
}

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'alerts', label: 'Alertas' },
  { id: 'rewards', label: 'Recompensas' },
  { id: 'system', label: 'Sistema' },
];

/**
 * Topbar notification bell + premium dropdown (GlassCard, neon accents).
 *
 * @param {{
 *   onNavigate: (navId: string) => void,
 *   hasSession: boolean,
 *   userHasActiveStaking: boolean,
 *   holdingPctAig: number,
 *   minHoldingPct: number,
 *   accountFrozen: boolean,
 *   userEconomicallyActive: boolean,
 *   leftPts: number,
 *   rightPts: number,
 *   directClaimUsdt: number,
 * }} props
 */
export function GenesisNotificationCenter({
  onNavigate,
  hasSession,
  userHasActiveStaking,
  holdingPctAig,
  minHoldingPct,
  accountFrozen,
  userEconomicallyActive,
  leftPts,
  rightPts,
  directClaimUsdt,
}) {
  const paymentEventsRaw = usePaymentLedgerStore((s) => s.events);
  const paymentEvents = useMemo(
    () =>
      (paymentEventsRaw || []).map((e) => ({
        id: e.id,
        ts: e.ts,
        title: e.title,
        summary: e.summary,
        category: e.category,
        kind: e.kind,
      })),
    [paymentEventsRaw],
  );

  const readAtById = useGenesisNotificationStore((s) => s.readAtById);
  const markRead = useGenesisNotificationStore((s) => s.markRead);
  const markAllReadStore = useGenesisNotificationStore((s) => s.markAllRead);
  const bumpArrival = useGenesisNotificationStore((s) => s.bumpArrival);

  const items = useMemo(
    () =>
      buildGenesisNotifications({
        hasSession,
        userHasActiveStaking,
        holdingPctAig,
        minHoldingPct,
        accountFrozen,
        userEconomicallyActive,
        leftPts,
        rightPts,
        directClaimUsdt,
        paymentEvents,
      }),
    [
      hasSession,
      userHasActiveStaking,
      holdingPctAig,
      minHoldingPct,
      accountFrozen,
      userEconomicallyActive,
      leftPts,
      rightPts,
      directClaimUsdt,
      paymentEvents,
    ],
  );

  const unreadMeta = useMemo(() => {
    let unread = 0;
    let maxSev = 0;
    for (const n of items) {
      if (readAtById[n.id]) continue;
      unread += 1;
      maxSev = Math.max(maxSev, severityRank(n.severity));
    }
    const badgeSeverity =
      maxSev >= 3 ? 'critical' : maxSev === 2 ? 'warning' : unread > 0 ? 'info' : null;
    return { unreadCount: unread, badgeSeverity };
  }, [items, readAtById]);

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState(/** @type {'all'|'alerts'|'rewards'|'system'} */ ('all'));
  const [pulse, setPulse] = useState(false);
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const prevUnreadRef = useRef(unreadMeta.unreadCount);
  const skipPulseMountRef = useRef(true);

  useEffect(() => {
    if (skipPulseMountRef.current) {
      skipPulseMountRef.current = false;
      prevUnreadRef.current = unreadMeta.unreadCount;
      return undefined;
    }
    if (unreadMeta.unreadCount > prevUnreadRef.current) {
      bumpArrival();
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 2400);
      prevUnreadRef.current = unreadMeta.unreadCount;
      return () => window.clearTimeout(t);
    }
    prevUnreadRef.current = unreadMeta.unreadCount;
    return undefined;
  }, [unreadMeta.unreadCount, bumpArrival]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      const el = rootRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((n) => {
      if (filter === 'alerts') return n.category === 'alerts';
      if (filter === 'rewards') return n.category === 'rewards';
      if (filter === 'system') return n.category === 'system';
      return true;
    });
  }, [items, filter]);

  const onAction = useCallback(
    (n) => {
      markRead(n.id);
      onNavigate(n.navId);
      setOpen(false);
    },
    [markRead, onNavigate],
  );

  const onMarkAll = useCallback(() => {
    markAllReadStore(filtered.map((n) => n.id));
  }, [markAllReadStore, filtered]);

  return (
    <div ref={rootRef} className="relative z-[95]">
      <motion.button
        type="button"
        aria-label="Notificaciones"
        aria-expanded={open}
        whileTap={{ scale: 0.94 }}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-slate-200 shadow-[0_0_20px_-6px_rgba(34,211,238,0.35)] transition hover:border-cyan-500/35 hover:bg-white/[0.09] hover:shadow-[0_0_28px_-4px_rgba(34,211,238,0.45)]"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {unreadMeta.badgeSeverity ? (
          <span
            className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-slate-950 ${severityDotClass(
              unreadMeta.badgeSeverity,
            )}`}
          />
        ) : null}
        {pulse && unreadMeta.unreadCount > 0 ? (
          <span
            className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-cyan-400/60 animate-[notif-pulse_1.6s_ease-out_infinite]"
            aria-hidden
          />
        ) : null}
      </motion.button>

      <style>{`
        @keyframes notif-pulse {
          0% { opacity: 0.85; transform: scale(1); }
          70% { opacity: 0; transform: scale(1.25); }
          100% { opacity: 0; transform: scale(1.35); }
        }
        .notif-scroll::-webkit-scrollbar { width: 6px; }
        .notif-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.22); border-radius: 6px; }
      `}</style>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar notificaciones"
              className="fixed inset-0 z-[85] bg-slate-950/45 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="absolute right-0 top-[calc(100%+0.5rem)] z-[90] w-[min(calc(100vw-1.5rem),22rem)] origin-top-right sm:w-[24rem]"
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              <GlassCard
                hover={false}
                glowClassName="border-cyan-500/20 shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)]"
                contentClassName="p-0"
              >
                <div className="border-b border-white/10 bg-slate-950/55 px-4 py-3 backdrop-blur-md">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-white">
                        <Sparkles className="h-3.5 w-3.5 text-cyan-300/90" />
                        Notificaciones
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {unreadMeta.unreadCount > 0
                          ? `${unreadMeta.unreadCount} sin leer`
                          : 'Todo al día'}
                      </p>
                    </div>
                    {filtered.some((n) => !readAtById[n.id]) ? (
                      <button
                        type="button"
                        onClick={onMarkAll}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 transition hover:border-cyan-500/30 hover:text-cyan-200/90"
                      >
                        Marcar leídas
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                          filter === f.id
                            ? 'bg-gradient-to-r from-cyan-500/25 to-violet-500/25 text-white ring-1 ring-cyan-400/35'
                            : 'border border-white/10 bg-white/[0.03] text-slate-500 hover:border-white/18 hover:text-slate-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <ul className="notif-scroll max-h-[min(70vh,420px)] divide-y divide-white/[0.06] overflow-y-auto">
                  {filtered.length === 0 ? (
                    <li className="px-4 py-10 text-center text-sm text-slate-500">No hay elementos en este filtro.</li>
                  ) : (
                    filtered.map((n) => {
                      const read = Boolean(readAtById[n.id]);
                      return (
                        <li key={n.id} className="list-none">
                          <motion.button
                            type="button"
                            initial={false}
                            whileHover={{ scale: 1.008 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                            className={`group relative w-full px-3 py-3 text-left transition outline-none ring-cyan-400/40 focus-visible:ring-2 ${
                              read ? 'opacity-70' : 'bg-cyan-500/[0.04]'
                            } hover:bg-white/[0.04] hover:shadow-[0_0_24px_-8px_rgba(34,211,238,0.2)]`}
                            onClick={() => onAction(n)}
                          >
                            {!read ? (
                              <span
                                className={`absolute left-1 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full ${severityDotClass(
                                  n.severity,
                                )}`}
                                aria-hidden
                              />
                            ) : null}
                            <div className="flex gap-3 pl-2">
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-950/50 shadow-[0_0_16px_-6px_rgba(34,211,238,0.15)]">
                                <CategoryIcon category={n.category} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-display text-sm font-semibold text-white">{n.title}</p>
                                <p className="mt-1 text-xs leading-snug text-slate-400">{n.description}</p>
                                <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                                  {formatNotifTime(n.ts)}
                                </p>
                                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-cyan-100/95 transition group-hover:border-cyan-500/35 group-hover:bg-cyan-500/10">
                                  <span>{n.actionLabel}</span>
                                  <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </GlassCard>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
