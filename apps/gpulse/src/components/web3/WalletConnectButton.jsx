import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Copy, LogOut, Wallet } from 'lucide-react';

function shorten(addr) {
  const a = String(addr || '');
  if (a.length < 12) return a || 'Connect Wallet';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Deterministic hue + secondary from address for gradient avatar. */
function addressGradient(addr) {
  const s = String(addr || '').replace(/^0x/i, '');
  let h = 0;
  let h2 = 0;
  for (let i = 0; i < s.length; i += 1) {
    const v = parseInt(s[i], 16);
    if (Number.isNaN(v)) continue;
    h = (h * 17 + v * 23) % 360;
    h2 = (h2 * 13 + v * 41) % 360;
  }
  const c1 = `hsl(${h} 88% 58%)`;
  const c2 = `hsl(${h2} 76% 42%)`;
  const c3 = `hsl(${(h + 48) % 360} 70% 48%)`;
  return { background: `linear-gradient(135deg, ${c1}, ${c2} 45%, ${c3})` };
}

function formatNativePreview(value, symbol) {
  if (value == null || value === '') return `— ${symbol}`;
  const n = Number(value);
  if (!Number.isFinite(n)) return `— ${symbol}`;
  if (n === 0) return `0 ${symbol}`;
  if (n < 0.0001) return `<0.0001 ${symbol}`;
  if (n < 1) return `${n.toFixed(4)} ${symbol}`;
  if (n < 1000) return `${n.toFixed(3)} ${symbol}`;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`;
}

/**
 * Wallet CTA — connect opens TransactionFlowModal via onPress when disconnected.
 * Connected: avatar, address, balance, menu (copy / disconnect).
 */
export default function WalletConnectButton({
  address = null,
  isLight = false,
  disabled = false,
  busy = false,
  onPress,
  onDisconnect,
  nativeBalance = null,
  nativeSymbol = 'BNB',
  className = '',
}) {
  const connected = Boolean(address);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef(null);
  const copyTimerRef = useRef(null);

  const avatarStyle = useMemo(() => addressGradient(address), [address]);
  const balanceLine = useMemo(
    () => formatNativePreview(nativeBalance, nativeSymbol),
    [nativeBalance, nativeSymbol],
  );

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target)) closeMenu();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!address || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(String(address));
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
    closeMenu();
  };

  const handleDisconnect = () => {
    onDisconnect?.();
    closeMenu();
  };

  const baseDisconnected = isLight
    ? 'border-cyan-500/30 bg-white text-slate-800 shadow-[0_0_0_1px_rgba(6,182,212,0.12)] hover:shadow-[0_0_24px_rgba(6,182,212,0.25),0_0_0_1px_rgba(6,182,212,0.35)]'
    : 'border-cyan-400/40 bg-gradient-to-br from-cyan-500/15 via-violet-600/10 to-transparent text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.2),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_0_32px_rgba(34,211,238,0.45),0_0_0_1px_rgba(34,211,238,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]';

  const baseConnected = isLight
    ? 'border-slate-200/90 bg-white/95 text-slate-900 shadow-[0_0_0_1px_rgba(15,23,42,0.06)] hover:shadow-[0_0_28px_rgba(6,182,212,0.18),0_0_0_1px_rgba(6,182,212,0.22)]'
    : 'border-white/15 bg-white/[0.07] text-white shadow-[0_0_20px_rgba(139,92,246,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_0_36px_rgba(34,211,238,0.22),0_0_28px_rgba(167,139,250,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]';

  return (
    <div ref={wrapRef} className={['relative inline-flex', className].filter(Boolean).join(' ')}>
      <motion.button
        type="button"
        disabled={disabled || busy}
        title={connected ? String(address) : 'Connect Wallet'}
        onClick={() => {
          if (!connected) {
            onPress?.();
            return;
          }
          setMenuOpen((v) => !v);
        }}
        className={[
          'group relative inline-flex max-w-[260px] items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 py-2 text-left transition-[border-color,transform] duration-300 disabled:opacity-45',
          connected ? baseConnected : baseDisconnected,
        ].join(' ')}
        whileHover={!disabled && !busy ? { scale: 1.02 } : undefined}
        whileTap={!disabled && !busy ? { scale: 0.98 } : undefined}
      >
        {!connected ? (
          <>
            <span
              className={[
                'pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-100',
                isLight ? 'bg-[radial-gradient(ellipse_at_30%_0%,rgba(6,182,212,0.35),transparent_55%)]' : 'bg-[radial-gradient(ellipse_at_30%_0%,rgba(34,211,238,0.35),transparent_50%)]',
              ].join(' ')}
            />
            <Wallet size={17} className={`relative z-[1] shrink-0 ${isLight ? 'text-cyan-600' : 'text-cyan-300'}`} />
            <span
              className={`relative z-[1] text-[10px] font-black uppercase tracking-[0.16em] ${isLight ? 'text-slate-800' : 'text-cyan-50/95'}`}
            >
              {busy ? 'Connecting…' : 'Connect Wallet'}
            </span>
          </>
        ) : (
          <>
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-xl opacity-70"
              style={{
                background: isLight
                  ? 'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.12), transparent 65%)'
                  : 'radial-gradient(circle at 50% 50%, rgba(34,211,238,0.15), transparent 62%)',
              }}
              animate={{ opacity: [0.45, 0.85, 0.45], scale: [1, 1.02, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.span
              className="relative z-[1] h-9 w-9 shrink-0 rounded-full shadow-[0_0_16px_rgba(0,0,0,0.25)] ring-2 ring-white/20"
              style={avatarStyle}
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative z-[1] min-w-0 flex-1">
              <p className={`truncate font-mono text-[11px] font-semibold tracking-tight ${isLight ? 'text-slate-900' : 'text-white/95'}`}>
                {shorten(address)}
              </p>
              <p className={`mt-0.5 truncate font-mono text-[9px] font-medium ${isLight ? 'text-slate-500' : 'text-white/45'}`}>
                {balanceLine}
              </p>
            </div>
            <ChevronDown
              size={16}
              className={`relative z-[1] shrink-0 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''} ${isLight ? 'text-slate-500' : 'text-white/50'}`}
            />
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {copied ? (
          <motion.span
            key="copy-toast"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-none absolute -top-8 right-0 z-20 rounded-lg px-2 py-1 text-[10px] font-semibold shadow-lg ${
              isLight ? 'border border-slate-200 bg-white text-emerald-700' : 'border border-emerald-500/40 bg-emerald-950/95 text-emerald-200'
            }`}
          >
            Copied
          </motion.span>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {connected && menuOpen ? (
          <motion.div
            key="wallet-menu"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute right-0 top-[calc(100%+6px)] z-30 min-w-[200px] overflow-hidden rounded-xl border py-1 shadow-2xl ${
              isLight ? 'border-slate-200 bg-white' : 'border-white/12 bg-[rgba(12,8,24,0.96)] backdrop-blur-xl'
            }`}
          >
            <button
              type="button"
              role="menuitem"
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[11px] font-semibold transition-colors ${
                isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-white/90 hover:bg-white/10'
              }`}
              onClick={handleCopy}
            >
              <Copy size={15} className="opacity-80" />
              Copy address
            </button>
            {onDisconnect ? (
              <button
                type="button"
                role="menuitem"
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[11px] font-semibold transition-colors ${
                  isLight ? 'text-red-600 hover:bg-red-50' : 'text-red-300 hover:bg-red-500/15'
                }`}
                onClick={handleDisconnect}
              >
                <LogOut size={15} className="opacity-80" />
                Disconnect
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
