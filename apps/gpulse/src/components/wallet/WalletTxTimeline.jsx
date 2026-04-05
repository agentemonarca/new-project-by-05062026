import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';
import * as RW from 'react-window';
import { useRenderCount } from '../../hooks/useRenderCount.js';

const STATUS_PENDING = new Set(['PENDING', 'CONFIRMING']);
const STATUS_CONFIRMED = new Set(['COMPLETED']);
const STATUS_FAILED = new Set(['FAILED']);

const FLOW_DISPLAY_ORDER = ['CONNECTING', 'SIGNING', 'BROADCASTING', 'CONFIRMING', 'SUCCESS'];

/** Fixed virtual row height (react-window FixedSizeList). */
const ROW_HEIGHT = 80;
const LIST_VIEWPORT_MAX = 520;

function flowStateMap(flowStates) {
  const by = {};
  for (const e of flowStates || []) {
    const s = String(e?.state || '');
    if (!s) continue;
    const t = Number(e?.at);
    if (!Number.isFinite(t)) continue;
    if (by[s] == null || t < by[s]) by[s] = t;
  }
  return by;
}

function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s`;
}

function normalizeEntries(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const sorted = [...list].sort((a, b) => Number(a?.at || 0) - Number(b?.at || 0));
  const merged = new Map();
  for (const tx of sorted) {
    const key = tx?.requestId
      ? `rid:${tx.requestId}`
      : tx?.txHash
        ? String(tx.txHash)
        : String(tx?.id ?? `${tx?.at}-${Math.random()}`);
    const prev = merged.get(key) || {};
    merged.set(key, { ...prev, ...tx });
  }
  return Array.from(merged.values()).sort((a, b) => Number(b?.at || 0) - Number(a?.at || 0));
}

function statusTier(status) {
  const s = String(status || '').toUpperCase();
  if (STATUS_FAILED.has(s)) return 'failed';
  if (STATUS_CONFIRMED.has(s)) return 'confirmed';
  return 'pending';
}

function kindLabel(kind) {
  const k = String(kind || '').toLowerCase();
  if (k === 'withdraw') return 'Withdraw';
  if (k === 'purchase') return 'Purchase';
  return 'Deposit';
}

function formatTime(at) {
  const t = Number(at);
  if (!Number.isFinite(t) || t <= 0) return '—';
  try {
    return new Date(t).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function shortenHash(h) {
  const s = String(h || '');
  if (s.length < 18) return s || '—';
  return `${s.slice(0, 10)}…${s.slice(-6)}`;
}

function isLikelyOnChainHash(h) {
  const s = String(h || '').trim();
  return /^0x[0-9a-fA-F]{64}$/.test(s);
}

function rowDataSignature(tx) {
  if (!tx) return '';
  return `${tx.requestId}|${tx.txHash}|${tx.status}|${tx.at}|${tx.amount}|${tx.note}|${JSON.stringify(tx.flowStates || [])}`;
}

function traceProps(tx, tier, id, isLight) {
  const fMap = flowStateMap(tx?.flowStates);
  const hasFlows = Object.keys(fMap).length > 0;
  const startAt = hasFlows ? Math.min(...Object.values(fMap)) : Number(tx?.at);
  const endAt = fMap.SUCCESS ?? (tier === 'confirmed' ? Number(tx?.at) : null);
  const confirmMs =
    tier === 'confirmed' && Number.isFinite(startAt) && Number.isFinite(endAt) ? endAt - startAt : null;
  return { fMap, hasFlows, confirmMs, id, isLight, tier, tx };
}

function ExecutionTraceBlock({ fMap, hasFlows, confirmMs, id, isLight, tier, tx }) {
  if (!hasFlows && tier === 'pending') {
    return (
      <p className={`mt-3 text-[10px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
        Flow trace will appear as the wallet modal advances.
      </p>
    );
  }
  if (!hasFlows) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
        Execution trace
      </p>
      <p className={`text-[10px] font-mono ${isLight ? 'text-slate-600' : 'text-white/55'}`}>
        Time to confirm:{' '}
        <span className={isLight ? 'text-slate-900' : 'text-white/85'}>{formatDurationMs(confirmMs)}</span>
        {tx?.confirmations != null ? (
          <>
            {' '}
            · confirmations:{' '}
            <span className={isLight ? 'text-slate-900' : 'text-white/85'}>{Number(tx.confirmations)}</span>
          </>
        ) : null}
      </p>
      <motion.ul
        className="space-y-1.5"
        initial="hidden"
        animate="show"
        variants={{
          show: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
        }}
      >
        {FLOW_DISPLAY_ORDER.map((st) => {
          const done = Boolean(fMap[st]);
          const muted = !done;
          return (
            <motion.li
              key={`${id}-${st}`}
              variants={{
                hidden: { opacity: 0, x: -8 },
                show: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
              }}
              style={{ willChange: 'transform, opacity' }}
              className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 ${
                isLight ? 'bg-white/90 ring-1 ring-slate-200/90' : 'bg-white/[0.04] ring-1 ring-white/10'
              }`}
            >
              <span
                className={`text-[10px] font-black uppercase tracking-widest ${
                  muted
                    ? isLight
                      ? 'text-slate-400'
                      : 'text-white/35'
                    : isLight
                      ? 'text-slate-800'
                      : 'text-cyan-100/90'
                }`}
              >
                {st}
              </span>
              <span
                className={`shrink-0 text-[11px] font-bold ${
                  done
                    ? isLight
                      ? 'text-emerald-700'
                      : 'text-emerald-300'
                    : isLight
                      ? 'text-slate-300'
                      : 'text-white/25'
                }`}
              >
                {done ? '✓' : '···'}
              </span>
            </motion.li>
          );
        })}
        {tier === 'failed' && fMap.ERROR ? (
          <motion.li
            variants={{
              hidden: { opacity: 0, x: -8 },
              show: { opacity: 1, x: 0 },
            }}
            style={{ willChange: 'transform, opacity' }}
            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 ${
              isLight ? 'bg-red-50 ring-1 ring-red-200/90' : 'bg-red-500/10 ring-1 ring-red-400/25'
            }`}
          >
            <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-red-800' : 'text-red-200'}`}>
              ERROR
            </span>
            <span className={`text-[11px] font-bold ${isLight ? 'text-red-700' : 'text-red-300'}`}>✓</span>
          </motion.li>
        ) : null}
      </motion.ul>
    </div>
  );
}

const ExecutionTraceMemo = React.memo(ExecutionTraceBlock);

function timelineRowPropsEqual(prev, next) {
  if (!prev?.data || !next?.data) return false;
  if (!prev.data.rows || !next.data.rows) return false;
  if (prev.index !== next.index) return false;
  const index = prev.index;
  if (!prev.data.rows[index] || !next.data.rows[index]) return false;
  if (prev.style.top !== next.style.top || prev.style.left !== next.style.left) return false;
  if (prev.style.width !== next.style.width) return false;
  if (prev.style.height !== next.style.height) return false;
  const pd = prev.data;
  const nd = next.data;
  if (pd.openId !== nd.openId) return false;
  if (pd.isLight !== nd.isLight) return false;
  if (pd.explorerBaseUrl !== nd.explorerBaseUrl) return false;
  const pr = pd.rows[index];
  const nr = nd.rows[index];
  return rowDataSignature(pr) === rowDataSignature(nr);
}

/**
 * Single virtualized timeline row (fixed-height cell; scroll inside row when expanded).
 */
const WalletTimelineRow = React.memo(function WalletTimelineRow({ index, style, data }) {
  if (data == null) {
    return <div style={style} />;
  }
  const { rows, openId, setOpenId, isLight, bscTxUrl } = data;
  if (!Array.isArray(rows)) {
    return <div style={style} />;
  }
  const tx = rows[index];
  const id = String(tx?.id ?? tx?.txHash ?? index);
  const tier = statusTier(tx?.status);
  const expanded = openId === id;
  const hash = String(tx?.txHash || '').trim();
  const url = hash && isLikelyOnChainHash(hash) ? bscTxUrl(hash) : '';

  const traceMemoProps = useMemo(() => traceProps(tx, tier, id, isLight), [tx, tier, id, isLight]);

  const toggle = useCallback(() => {
    setOpenId((prev) => (prev === id ? null : id));
  }, [id, setOpenId]);

  const nodeColors =
    tier === 'failed'
      ? {
          core: isLight ? 'bg-red-500' : 'bg-red-400',
          glow: isLight ? 'shadow-[0_0_14px_rgba(239,68,68,0.55)]' : 'shadow-[0_0_18px_rgba(248,113,113,0.45)]',
          ring: isLight ? 'border-red-400/50' : 'border-red-400/45',
        }
      : tier === 'confirmed'
        ? {
            core: isLight ? 'bg-emerald-600' : 'bg-emerald-400',
            glow: isLight ? 'shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'shadow-[0_0_14px_rgba(52,211,153,0.35)]',
            ring: isLight ? 'border-emerald-500/45' : 'border-emerald-400/40',
          }
        : {
            core: isLight ? 'bg-amber-500' : 'bg-amber-400',
            glow: isLight ? 'shadow-[0_0_14px_rgba(245,158,11,0.5)]' : 'shadow-[0_0_16px_rgba(251,191,36,0.4)]',
            ring: isLight ? 'border-amber-400/50' : 'border-amber-300/45',
          };

  return (
    <div style={{ ...style, overflowX: 'hidden', overflowY: 'auto' }} className="box-border">
      <div className="relative flex gap-3 pb-5 pr-1">
        <div className="relative z-[1] flex w-8 shrink-0 justify-center pt-1">
          <motion.div
            className="relative flex h-8 w-8 items-center justify-center"
            initial={false}
            layout={false}
            animate={tier === 'pending' ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={tier === 'pending' ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
            style={{ willChange: 'transform' }}
          >
            <span className={`absolute inset-0 rounded-full border ${nodeColors.ring} opacity-80`} />
            {tier === 'pending' ? (
              <motion.span
                className={`pointer-events-none absolute inset-[-4px] rounded-full border ${nodeColors.ring} border-dashed opacity-40`}
                layout={false}
                animate={{ scale: [1, 1.65], opacity: [0.35, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                style={{ willChange: 'transform, opacity' }}
              />
            ) : null}
            {tier === 'failed' ? (
              <motion.span
                className={`pointer-events-none absolute inset-0 rounded-full ${nodeColors.core} opacity-30`}
                layout={false}
                animate={{ opacity: [0.25, 0.5, 0.3, 0.45, 0.25] }}
                transition={{ duration: 0.45, repeat: Infinity, ease: 'linear' }}
                style={{ willChange: 'opacity' }}
              />
            ) : null}
            <span className={`relative z-[1] h-2.5 w-2.5 rounded-full ${nodeColors.core} ${nodeColors.glow}`} />
          </motion.div>
        </div>

        <motion.button
          type="button"
          layout={false}
          onClick={toggle}
          className={`min-w-0 flex-1 rounded-2xl border text-left transition-colors ${
            isLight
              ? `border-slate-200/90 bg-white/90 shadow-sm hover:border-cyan-300/60 ${expanded ? 'ring-1 ring-cyan-400/25' : ''}`
              : `border-white/10 bg-white/[0.06] hover:border-cyan-500/30 hover:bg-white/[0.08] ${expanded ? 'ring-1 ring-cyan-400/20' : ''}`
          }`}
        >
          <div className="flex items-start justify-between gap-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[9px] font-black uppercase tracking-[0.2em] ${
                    tx?.kind === 'withdraw'
                      ? isLight
                        ? 'text-pink-600'
                        : 'text-pink-300'
                      : tx?.kind === 'purchase'
                        ? isLight
                          ? 'text-violet-600'
                          : 'text-violet-300'
                        : isLight
                          ? 'text-cyan-600'
                          : 'text-cyan-300'
                  }`}
                >
                  {kindLabel(tx?.kind)}
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                    tier === 'failed'
                      ? isLight
                        ? 'bg-red-100 text-red-700'
                        : 'bg-red-500/20 text-red-200'
                      : tier === 'confirmed'
                        ? isLight
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-emerald-500/15 text-emerald-200'
                        : isLight
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-amber-500/15 text-amber-200'
                  }`}
                >
                  {tier === 'failed' ? 'Failed' : tier === 'confirmed' ? 'Confirmed' : 'Pending'}
                </span>
              </div>
              <p className={`mt-2 font-mono text-sm font-semibold tracking-tight ${isLight ? 'text-slate-900' : 'text-white/95'}`}>
                {tx?.kind === 'withdraw' ? '−' : '+'}
                {Number(tx?.amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}{' '}
                <span className={isLight ? 'text-slate-600' : 'text-white/55'}>{String(tx?.token || '—')}</span>
              </p>
              {tx?.note ? (
                <p className={`mt-1 text-[10px] leading-snug ${isLight ? 'text-slate-500' : 'text-white/40'}`}>{tx.note}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={`text-[9px] font-mono ${isLight ? 'text-slate-500' : 'text-white/45'}`}>
                {formatTime(tx?.at)}
              </span>
              <motion.span
                layout={false}
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ willChange: 'transform' }}
              >
                <ChevronDown size={16} className={isLight ? 'text-slate-400' : 'text-white/35'} aria-hidden />
              </motion.span>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.div
                layout={false}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className={`overflow-hidden border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}
                style={{ willChange: 'opacity, transform' }}
              >
                <div className={`space-y-2 px-4 py-3 ${isLight ? 'bg-slate-50/80' : 'bg-black/25'}`}>
                  <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
                    Transaction
                  </p>
                  {hash ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <code
                        className={`break-all rounded-lg px-2 py-1.5 text-[11px] font-mono ${
                          isLight ? 'bg-white text-slate-800 ring-1 ring-slate-200' : 'bg-white/5 text-cyan-100/90 ring-1 ring-white/10'
                        }`}
                      >
                        {shortenHash(hash)}
                      </code>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${
                            isLight
                              ? 'bg-slate-900 text-white hover:bg-slate-800'
                              : 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/35 hover:bg-cyan-500/30'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          BscScan
                          <ExternalLink size={12} />
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-white/45'}`}>No hash recorded for this entry.</p>
                  )}

                  <ExecutionTraceMemo {...traceMemoProps} />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}, timelineRowPropsEqual);

/**
 * Vertical “living ledger” timeline for wallet Web3 activity (virtualized).
 *
 * @param {object} props
 * @param {Array<object>} props.entries
 * @param {boolean} [props.isLight]
 * @param {string} [props.explorerBaseUrl]
 */
export default function WalletTxTimeline({ entries = [], isLight = false, explorerBaseUrl = 'https://bscscan.com' }) {
  useRenderCount('WalletTxTimeline');
  const [openId, setOpenId] = useState(null);
  const outerRef = useRef(null);
  const [listWidth, setListWidth] = useState(0);

  const safeItems = Array.isArray(entries) ? entries : [];
  const rows = useMemo(() => normalizeEntries(safeItems), [safeItems]);

  const bscTxUrl = useCallback(
    (hash) => {
      const h = String(hash || '').trim();
      if (!h) return '';
      const base = String(explorerBaseUrl || 'https://bscscan.com').replace(/\/$/, '');
      return `${base}/tx/${encodeURIComponent(h)}`;
    },
    [explorerBaseUrl],
  );

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setListWidth(el.clientWidth));
    ro.observe(el);
    setListWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('Timeline mounted');
    }
  }, []);

  useEffect(() => {
    if (!RW.FixedSizeList) {
      console.warn('react-window not loaded correctly — FixedSizeList missing; using BasicTimelineListFallback');
    }
  }, []);

  const itemData = useMemo(
    () => ({
      rows,
      openId,
      setOpenId,
      isLight,
      bscTxUrl,
      explorerBaseUrl,
    }),
    [rows, openId, isLight, bscTxUrl, explorerBaseUrl],
  );

  const rail = isLight
    ? 'bg-gradient-to-b from-cyan-400/25 via-violet-400/20 to-transparent'
    : 'bg-gradient-to-b from-cyan-400/35 via-fuchsia-500/25 to-transparent';

  const listHeight = listWidth > 0 ? Math.min(LIST_VIEWPORT_MAX, Math.max(220, rows.length * ROW_HEIGHT)) : 0;

  if (rows.length === 0) {
    return (
      <div
        className={`rounded-2xl border border-dashed py-14 text-center text-sm ${
          isLight ? 'border-slate-200 bg-slate-50/50 text-slate-500' : 'border-white/10 bg-white/[0.03] text-white/45'
        }`}
      >
        No on-wallet movements yet.
      </div>
    );
  }

  return (
    <div ref={outerRef} className="relative min-h-0 pl-1">
      {listWidth > 0 && listHeight > 0 ? (
        <>
          <div
            aria-hidden
            className={`pointer-events-none absolute left-[15px] z-0 w-px rounded-full ${rail}`}
            style={{
              top: 12,
              height: Math.max(0, listHeight - 24),
              boxShadow: isLight ? '0 0 12px rgba(6,182,212,0.15)' : '0 0 16px rgba(34,211,238,0.12)',
            }}
          />

          {RW.FixedSizeList ? (
            <RW.FixedSizeList
              height={listHeight}
              width={listWidth}
              itemCount={rows.length}
              itemSize={ROW_HEIGHT}
              itemData={itemData}
              overscanCount={8}
            >
              {WalletTimelineRow}
            </RW.FixedSizeList>
          ) : (
            <BasicTimelineListFallback
              rows={rows}
              itemData={itemData}
              listHeight={listHeight}
              listWidth={listWidth}
              rowHeight={ROW_HEIGHT}
            />
          )}
        </>
      ) : (
        <div className="h-[240px] w-full" aria-hidden />
      )}
    </div>
  );
}
