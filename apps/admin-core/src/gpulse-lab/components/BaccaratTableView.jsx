import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Stacking: --z-bg → ambient fx (calc(--z-table - 1)) → --z-table (strip) → --z-cards (stage + per-card) → result pill → --z-hud (footer chrome).
 * Ambient layers use pointer-events-none and stay strictly below --z-table.
 */
const Z_FX_UNDER_TABLE = 'calc(var(--z-table) - 1)';

const CARD_REM = 3.25;
const GAP_REM = 0.5;

function asSuitSymbol(suit) {
  const s = String(suit ?? '').toLowerCase();
  if (s.includes('heart')) return '♥';
  if (s.includes('diamond')) return '♦';
  if (s.includes('club')) return '♣';
  if (s.includes('spade')) return '♠';
  if (s === 'h') return '♥';
  if (s === 'd') return '♦';
  if (s === 'c') return '♣';
  if (s === 's') return '♠';
  return '•';
}

function isSuitRed(symbol) {
  return symbol === '♥' || symbol === '♦';
}

function suitColorClass(symbol) {
  if (symbol === '♥') return 'text-pink-500';
  if (symbol === '♦') return 'text-amber-400';
  if (symbol === '♠' || symbol === '♣') return 'text-cyan-400';
  return 'text-slate-700';
}

function parseCard(input) {
  if (input == null) return null;
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return null;
    const m = raw.match(/^([0-9]{1,2}|[AJQK])\s*([♥♦♣♠]|[HhDdCcSs])?/);
    const val = m?.[1] ?? raw.slice(0, 2).trim();
    const suitRaw = m?.[2] ?? raw.slice(-1);
    const symbol =
      suitRaw === 'H' || suitRaw === 'h'
        ? '♥'
        : suitRaw === 'D' || suitRaw === 'd'
          ? '♦'
          : suitRaw === 'C' || suitRaw === 'c'
            ? '♣'
            : suitRaw === 'S' || suitRaw === 's'
              ? '♠'
              : suitRaw === '♥' || suitRaw === '♦' || suitRaw === '♣' || suitRaw === '♠'
                ? suitRaw
                : '•';
    const red = isSuitRed(symbol);
    return { val: String(val).toUpperCase(), symbol, isRed: red };
  }
  if (typeof input === 'object' && !Array.isArray(input)) {
    const v = input.value ?? input.val ?? input.rank ?? input.card ?? null;
    const suit = input.suit ?? input.palo ?? input.symbol ?? null;
    const symbol = typeof suit === 'string' && ['♥', '♦', '♣', '♠'].includes(suit) ? suit : asSuitSymbol(suit);
    const red = isSuitRed(symbol);
    return { val: v != null ? String(v).toUpperCase() : '—', symbol, isRed: red };
  }
  return null;
}

function baccaratPipValue(v) {
  const s = String(v ?? '').toUpperCase();
  if (s === 'A') return 1;
  if (s === 'J' || s === 'Q' || s === 'K') return 0;
  const n = Number(s);
  if (Number.isFinite(n)) return n >= 10 ? 0 : Math.max(0, n);
  return 0;
}

function computeBaccaratScore(cards) {
  if (!Array.isArray(cards)) return null;
  const sum = cards.reduce((acc, c) => acc + baccaratPipValue(c?.val), 0);
  return sum % 10;
}

function winnerKey(winner) {
  const w = String(winner ?? '').trim().toUpperCase();
  if (w === 'P' || w.includes('PLAY')) return 'PLAYER';
  if (w === 'B' || w.includes('BANK')) return 'BANKER';
  if (w === 'T' || w.includes('TIE') || w.includes('EMP')) return 'TIE';
  return w || '—';
}

function glowClass(side, winner) {
  const w = winnerKey(winner);
  if (w === 'TIE') return side === 'CENTER' ? 'ring-2 ring-amber-400/40 shadow-[0_0_40px_rgba(245,158,11,0.18)]' : '';
  if (w === 'PLAYER') return side === 'PLAYER' ? 'ring-2 ring-cyan-400/35 shadow-[0_0_44px_rgba(34,211,238,0.18)]' : '';
  if (w === 'BANKER') return side === 'BANKER' ? 'ring-2 ring-pink-400/35 shadow-[0_0_44px_rgba(236,72,153,0.18)]' : '';
  return '';
}

function Card({ card, delay = 0, style: railStyle }) {
  const bgGradient =
    card?.symbol === '♥'
      ? 'from-pink-50 via-white to-pink-100'
      : card?.symbol === '♦'
        ? 'from-amber-50 via-white to-amber-100'
        : card?.symbol === '♠' || card?.symbol === '♣'
          ? 'from-cyan-50 via-white to-cyan-100'
          : 'from-slate-50 via-white to-slate-100';
  return (
    <motion.div
      data-baccarat-card
      initial={{ opacity: 0, y: 14, rotate: -3, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ duration: 0.36, delay, ease: [0.22, 1, 0.36, 1] }}
      style={railStyle}
      className={`absolute left-0 top-0 h-[clamp(3.25rem,4vh+2rem,4.25rem)] w-[clamp(2.5rem,1.5vw+1.9rem,3rem)] rounded-lg border border-white/20 bg-gradient-to-br shadow-[0_0_28px_rgba(34,211,238,0.35)] shadow-md shadow-black/50 ${bgGradient}`}
    >
      <div className="pointer-events-none absolute left-[clamp(0.375rem,1vw,0.5rem)] top-[clamp(0.125rem,0.5vw,0.25rem)] font-mono text-[clamp(0.625rem,0.6vw+0.5rem,0.75rem)] font-bold text-slate-900">
        {card?.val ?? '—'}
      </div>
      <div
        className={`pointer-events-none absolute bottom-[clamp(0.125rem,0.5vw,0.25rem)] right-[clamp(0.375rem,1vw,0.5rem)] text-[clamp(0.75rem,0.9vw+0.45rem,0.9375rem)] ${suitColorClass(card?.symbol)}`}
      >
        {card?.symbol ?? '•'}
      </div>
    </motion.div>
  );
}

function CardRow({
  label,
  cards,
  winner,
  sideKey,
  showDealAnim,
  waitingDeal,
  preResultActivation = false,
  railKey,
  railRef,
}) {
  const parsed = Array.isArray(cards) ? cards : [];
  const n = parsed.length;

  return (
    <div
      className={`relative flex min-h-0 min-w-0 flex-1 flex-col items-center rounded-xl border border-white/[0.08] bg-black/30 p-[clamp(0.5rem,1.2vw,0.875rem)] ${glowClass(sideKey, winner)} ${
        preResultActivation ? 'border-cyan-400/22 bg-black/[0.38] opacity-[0.98] shadow-[inset_0_0_36px_rgba(34,211,238,0.08)]' : ''
      } ${
        waitingDeal
          ? preResultActivation
            ? 'animate-gpulse-table-breathe-fast shadow-[inset_0_0_28px_rgba(34,211,238,0.09)]'
            : 'animate-gpulse-table-breathe shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
          : ''
      }`}
    >
      <span className="relative z-table font-mono text-[clamp(0.5625rem,0.45vw+0.45rem,0.625rem)] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      <div
        ref={railRef}
        data-baccarat-cards-rail={railKey}
        className="relative z-cards mt-[clamp(0.375rem,1vw,0.5rem)] min-h-[4.5rem] w-full max-w-full overflow-visible"
        style={
          n > 0
            ? { minHeight: '4.75rem', minWidth: `calc(${n} * ${CARD_REM}rem + ${Math.max(0, n - 1)} * ${GAP_REM}rem)` }
            : { minHeight: '4.75rem' }
        }
      >
        <AnimatePresence initial={false}>
          {n === 0 ? (
            <motion.div
              key={waitingDeal ? 'waiting-back' : 'empty'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={
                waitingDeal
                  ? 'relative z-cards inline-block h-[clamp(3.25rem,4vh+2rem,4.25rem)] w-[clamp(2.5rem,1.5vw+1.9rem,3rem)] rounded-lg border border-cyan-500/25 bg-gradient-to-br from-slate-800/90 to-slate-950/90 shadow-inner animate-gpulse-card-glow'
                  : 'relative z-cards rounded border border-white/[0.08] bg-black/20 px-3 py-2 font-mono text-[clamp(0.5625rem,0.5vw+0.45rem,0.625rem)] text-slate-600'
              }
            >
              {!waitingDeal ? '—' : null}
            </motion.div>
          ) : (
            parsed.map((c, idx) => (
              <Card
                key={`${c?.val ?? 'x'}-${c?.symbol ?? 'y'}-${idx}`}
                card={c}
                delay={showDealAnim ? idx * 0.12 : 0}
                style={{
                  left: `calc(${idx} * (${CARD_REM}rem + ${GAP_REM}rem))`,
                  top: 0,
                  zIndex: `calc(var(--z-cards) + ${idx})`,
                }}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Center stage: max width var(--gpulse-stage-max-w) = min(1400px, 96vw), aspect 16/9.
 * Layering: bg / fx (below --z-table) → strip (--z-table) → card stage (--z-cards) → footer scores (--z-hud).
 */
export default function BaccaratTableView({
  playerCards,
  bankerCards,
  playerScore,
  bankerScore,
  winner,
  status,
  intelligenceStrip = null,
  /** off | observing | stable | ready | watch | escalate — velos suaves en WAITING_RESULT */
  intelligentWaitingSurface = 'off',
  /** Sustituye línea corta bajo scores cuando hay espera inteligente */
  intelligentStatusLine = null,
}) {
  const railPlayerRef = useRef(null);
  const railBankerRef = useRef(null);

  const pCards = useMemo(() => (Array.isArray(playerCards) ? playerCards.map(parseCard).filter(Boolean) : []), [playerCards]);
  const bCards = useMemo(() => (Array.isArray(bankerCards) ? bankerCards.map(parseCard).filter(Boolean) : []), [bankerCards]);

  const pScore = playerScore != null ? Number(playerScore) : computeBaccaratScore(pCards);
  const bScore = bankerScore != null ? Number(bankerScore) : computeBaccaratScore(bCards);

  const w = winnerKey(winner);
  const winnerLabel = w === 'PLAYER' ? 'PLAYER' : w === 'BANKER' ? 'BANKER' : w === 'TIE' ? 'TIE' : '—';

  const resilienceHold = status === 'STREAM_INTERRUPTED';
  const ambientWaiting =
    status === 'WAITING_RESULT' || status === 'BETTING_CLOSED' || resilienceHold;
  const cardRowWaiting = ambientWaiting && !resilienceHold;
  const showDealAnim = status === 'RESULT_RECEIVED';

  let statusLine = '—';
  if (status === 'RESULT_RECEIVED') statusLine = 'Resultado confirmado…';
  else if (status === 'WAITING_RESULT' || status === 'BETTING_CLOSED') statusLine = 'Mesa en juego · observando…';
  else if (resilienceHold) statusLine = 'Vigilancia del stream…';
  else if (status != null) statusLine = String(status);
  const statusLineShown =
    intelligentStatusLine != null && String(intelligentStatusLine).trim() !== ''
      ? String(intelligentStatusLine).trim()
      : statusLine;

  const waitSurfaceOn =
    intelligentWaitingSurface != null &&
    intelligentWaitingSurface !== 'off' &&
    status === 'WAITING_RESULT';

  useLayoutEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const rails = [
      { ref: railPlayerRef, key: 'player', n: pCards.length },
      { ref: railBankerRef, key: 'banker', n: bCards.length },
    ];
    for (const { ref, key, n } of rails) {
      const el = ref.current;
      if (!el || n === 0) continue;
      const hasCardNodes = el.querySelectorAll('[data-baccarat-card]').length > 0;
      if (!hasCardNodes) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) {
        console.warn('[GPulse Lab] cards rendered but hidden by layout', { rail: key, rect: r });
      }
    }
    return undefined;
  }, [pCards.length, bCards.length]);

  return (
    <div
      className={`relative isolate flex h-full min-h-0 w-full flex-1 flex-col items-stretch transition-[filter,box-shadow] duration-500 ${
        resilienceHold
          ? 'drop-shadow-[0_0_22px_rgba(148,163,184,0.07)]'
          : ambientWaiting
            ? 'drop-shadow-[0_0_28px_rgba(34,211,238,0.07)]'
            : ''
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/50 via-transparent to-black/40"
        style={{ zIndex: 'var(--z-bg)' }}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute inset-0 ${
          resilienceHold
            ? 'bg-[radial-gradient(ellipse_at_50%_32%,rgba(148,163,184,0.11),transparent_58%)]'
            : intelligentWaitingSurface === 'ready'
              ? 'bg-[radial-gradient(ellipse_at_50%_30%,rgba(34,211,238,0.13),transparent_56%)]'
              : 'bg-[radial-gradient(ellipse_at_50%_28%,rgba(34,211,238,0.08),transparent_58%)]'
        }`}
        style={{ zIndex: Z_FX_UNDER_TABLE }}
        aria-hidden
      />
      {waitSurfaceOn && intelligentWaitingSurface === 'ready' ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(125,211,252,0.06),transparent_48%)]"
          style={{ zIndex: Z_FX_UNDER_TABLE }}
          aria-hidden
        />
      ) : null}
      {waitSurfaceOn ? (
        <div
          className={`pointer-events-none absolute inset-0 animate-gpulse-wait-shimmer bg-gradient-to-b from-cyan-400/[0.07] via-transparent to-sky-500/[0.04] ${
            intelligentWaitingSurface === 'escalate' ? 'from-amber-400/[0.06] to-transparent' : ''
          } ${intelligentWaitingSurface === 'ready' ? 'from-cyan-400/[0.1] via-cyan-400/[0.02] to-sky-500/[0.06]' : ''}`}
          style={{ zIndex: Z_FX_UNDER_TABLE }}
          aria-hidden
        />
      ) : null}

      {intelligenceStrip ? (
        <div className="relative z-table w-full shrink-0">{intelligenceStrip}</div>
      ) : null}

      <div className="relative z-cards flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-visible py-2">
        <div
          className={`baccarat-stage mx-auto flex w-full max-w-[var(--gpulse-stage-max-w)] min-w-0 shrink-0 flex-col justify-center [aspect-ratio:16/9] max-h-full min-h-0 [min-height:min(14rem,36vh)] ${
            resilienceHold
              ? 'shadow-[inset_0_0_48px_rgba(148,163,184,0.05)]'
              : waitSurfaceOn && intelligentWaitingSurface === 'ready'
                ? 'animate-gpulse-table-breathe-fast shadow-[inset_0_0_64px_rgba(34,211,238,0.09)]'
                : waitSurfaceOn && (intelligentWaitingSurface === 'stable' || intelligentWaitingSurface === 'watch')
                  ? 'animate-gpulse-table-breathe'
                  : ''
          }`}
        >
          <div
            className={`relative flex min-h-0 flex-1 flex-row items-center justify-between gap-2 overflow-visible px-1 sm:gap-3 sm:px-2 ${
              resilienceHold
                ? 'shadow-[inset_0_0_40px_rgba(148,163,184,0.05)]'
                : waitSurfaceOn
                  ? intelligentWaitingSurface === 'ready'
                    ? 'shadow-[inset_0_0_56px_rgba(34,211,238,0.08)]'
                    : 'shadow-[inset_0_0_48px_rgba(34,211,238,0.05)]'
                  : ''
            }`}
          >
            <CardRow
              label="PLAYER"
              cards={pCards}
              winner={winner}
              sideKey="PLAYER"
              showDealAnim={showDealAnim}
              waitingDeal={cardRowWaiting}
              preResultActivation={waitSurfaceOn && intelligentWaitingSurface === 'ready'}
              railKey="player"
              railRef={railPlayerRef}
            />

            <div
              className={`relative z-cards flex h-full min-h-[8rem] w-[min(28%,11rem)] min-w-[5.25rem] max-w-[11rem] shrink-0 flex-col items-center justify-center rounded-xl border border-white/[0.1] bg-black/40 p-2 ${glowClass('CENTER', winner)} ${
                resilienceHold
                  ? 'ring-1 ring-slate-500/22 shadow-[inset_0_0_24px_rgba(148,163,184,0.06)]'
                  : intelligentWaitingSurface === 'ready'
                    ? 'animate-gpulse-table-breathe-fast ring-1 ring-cyan-400/28 shadow-[0_0_52px_rgba(34,211,238,0.14)]'
                    : ambientWaiting
                      ? 'animate-gpulse-table-breathe ring-1 ring-white/[0.06]'
                      : ''
              }`}
            >
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">RESULT</span>
              <motion.p
                key={winnerLabel}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className={`mt-1 text-center font-mono text-lg font-bold tracking-[0.2em] sm:text-2xl ${
                  winnerLabel === 'PLAYER'
                    ? 'text-cyan-200'
                    : winnerLabel === 'BANKER'
                      ? 'text-pink-200'
                      : winnerLabel === 'TIE'
                        ? 'text-amber-200'
                        : 'text-slate-600'
                }`}
              >
                {winnerLabel}
              </motion.p>
            </div>

            <CardRow
              label="BANKER"
              cards={bCards}
              winner={winner}
              sideKey="BANKER"
              showDealAnim={showDealAnim}
              waitingDeal={cardRowWaiting}
              preResultActivation={waitSurfaceOn && intelligentWaitingSurface === 'ready'}
              railKey="banker"
              railRef={railBankerRef}
            />
          </div>
        </div>
      </div>

      <div className="relative z-hud mt-auto flex w-full max-w-none shrink-0 flex-col items-center gap-1 border-t border-white/[0.07] bg-black/20 px-2 py-3 sm:gap-2">
        <p
          className={`font-mono text-sm font-semibold tracking-[0.15em] sm:text-base ${
            winnerLabel === 'PLAYER'
              ? 'text-cyan-200/95'
              : winnerLabel === 'BANKER'
                ? 'text-pink-200/95'
                : winnerLabel === 'TIE'
                  ? 'text-amber-200/95'
                  : 'text-slate-500'
          }`}
        >
          {winnerLabel !== '—' ? `WINNER · ${winnerLabel}` : 'WINNER · —'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-sm tabular-nums text-slate-200 sm:text-base">
          <span>
            <span className="text-slate-500">P</span> {Number.isFinite(pScore) ? pScore : '—'}
          </span>
          <span className="text-slate-600">·</span>
          <span>
            <span className="text-slate-500">B</span> {Number.isFinite(bScore) ? bScore : '—'}
          </span>
        </div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 sm:text-xs">
          {statusLineShown}
        </p>
      </div>
    </div>
  );
}
