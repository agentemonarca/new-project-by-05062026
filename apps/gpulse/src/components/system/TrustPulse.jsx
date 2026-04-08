import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TX_FLOW_STATE } from '../web3/TransactionFlowModal.jsx';
import { useGpulseSystem } from '../../context/GpulseContext.jsx';
import { DEFAULT_SYSTEM_MODE, SYSTEM_MODE } from '../../system/decisionEngine.js';
import { QUEUE_WAITING_THRESHOLD_MEDIUM } from '../../system/queueThresholds.js';
import { useSystemActions } from '../../hooks/useSystemActions.js';

export const TRUST_LAYER_MODE = {
  HEALTHY: 'HEALTHY',
  PROCESSING: 'PROCESSING',
  ERROR: 'ERROR',
};

const TERMINAL_FLOW = new Set([TX_FLOW_STATE.SUCCESS, TX_FLOW_STATE.ERROR, TX_FLOW_STATE.IDLE, 'IDLE', '']);

function flowProcessing(open, state) {
  if (!open) return false;
  return !TERMINAL_FLOW.has(state);
}

function trustPulsePropsEqual(prev, next) {
  if (prev.isLight !== next.isLight) return false;
  if (prev.successGlowUntil !== next.successGlowUntil) return false;
  if (prev.pendingTxCount !== next.pendingTxCount) return false;
  if (prev.lastConfirmedAt !== next.lastConfirmedAt) return false;
  if (prev.enableHealthPing !== next.enableHealthPing) return false;
  if (prev.walletRecentFailureCount !== next.walletRecentFailureCount) return false;
  if (prev.systemMode !== next.systemMode) return false;
  if (prev.queueWaiting !== next.queueWaiting) return false;
  if (prev.systemStressScore !== next.systemStressScore) return false;
  if (prev.congestionProbability !== next.congestionProbability) return false;

  const a = prev.walletFlow;
  const b = next.walletFlow;
  if (a.open !== b.open || a.state !== b.state) return false;
  const pa = prev.premiumFlow;
  const pb = next.premiumFlow;
  if (pa.open !== pb.open || pa.state !== pb.state) return false;

  const h = prev.systemHealth;
  const nh = next.systemHealth;
  if (h === nh) return true;
  if (!h || !nh) return false;
  return (
    h.network === nh.network &&
    h.signer === nh.signer &&
    h.mempool === nh.mempool &&
    h.backend === nh.backend &&
    h.riskLevel === nh.riskLevel
  );
}

/**
 * @param {object} props
 */
function TrustPulse({
  isLight = false,
  walletFlow = { open: false, state: TX_FLOW_STATE.IDLE },
  premiumFlow = { open: false, state: TX_FLOW_STATE.IDLE },
  successGlowUntil = 0,
  pendingTxCount = 0,
  lastConfirmedAt = null,
  enableHealthPing = true,
  systemHealth = null,
  walletRecentFailureCount = 0,
  systemMode = DEFAULT_SYSTEM_MODE,
  queueWaiting = 0,
  systemStressScore = 0,
  congestionProbability = 0,
}) {
  const resolvedSystemMode = typeof systemMode === 'string' ? systemMode : DEFAULT_SYSTEM_MODE;
  const qw = Math.max(0, Number(queueWaiting) || 0);
  const cp = Math.min(1, Math.max(0, Number(congestionProbability) || 0));
  const ss = Math.min(100, Math.max(0, Number(systemStressScore) || 0));
  const queuePace =
    (1 + Math.min(0.38, qw / 72)) * (1 + Math.min(0.1, cp * 0.12 + (ss / 100) * 0.08));

  const [, setTick] = useState(0);
  const [backendOk, setBackendOk] = useState(null);

  const needsLiveClock =
    pendingTxCount > 0 ||
    lastConfirmedAt != null ||
    (typeof successGlowUntil === 'number' && successGlowUntil > Date.now());

  useEffect(() => {
    if (!needsLiveClock) return undefined;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [needsLiveClock]);

  useEffect(() => {
    if (!enableHealthPing || typeof window === 'undefined') return undefined;
    const base = String(import.meta.env.VITE_BACKEND_URL || '').trim();
    if (!base) {
      setBackendOk(null);
      return undefined;
    }
    let cancelled = false;
    const ping = async () => {
      if (cancelled) return;
      try {
        const url = `${base.replace(/\/$/, '')}/health`;
        const r = await fetch(url, { method: 'GET', cache: 'no-store' });
        if (!cancelled) setBackendOk(r.ok);
      } catch {
        if (!cancelled) setBackendOk(false);
      }
    };
    ping();
    const iv = window.setInterval(ping, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [enableHealthPing]);

  const mode = useMemo(() => {
    const wErr = walletFlow.open && walletFlow.state === TX_FLOW_STATE.ERROR;
    const pErr = premiumFlow.open && premiumFlow.state === TX_FLOW_STATE.ERROR;
    if (wErr || pErr) return TRUST_LAYER_MODE.ERROR;

    const processing =
      flowProcessing(walletFlow.open, walletFlow.state) ||
      flowProcessing(premiumFlow.open, premiumFlow.state) ||
      pendingTxCount > 0;
    if (processing) return TRUST_LAYER_MODE.PROCESSING;

    return TRUST_LAYER_MODE.HEALTHY;
  }, [walletFlow.open, walletFlow.state, premiumFlow.open, premiumFlow.state, pendingTxCount]);

  const now = Date.now();
  const inSuccessMemory = typeof successGlowUntil === 'number' && now < successGlowUntil;
  const healthyBoost = mode === TRUST_LAYER_MODE.HEALTHY && inSuccessMemory;

  const secondsSinceConfirm =
    lastConfirmedAt != null ? Math.max(0, Math.floor((now - lastConfirmedAt) / 1000)) : null;

  const confirmationSlow =
    pendingTxCount > 0 && lastConfirmedAt != null && now - lastConfirmedAt > 90_000;

  const consciousnessDetail = useMemo(() => {
    const parts = [];
    if (resolvedSystemMode === SYSTEM_MODE.PROTECTION_MODE) {
      parts.push('System operating in protection mode');
    } else if (resolvedSystemMode === SYSTEM_MODE.CAUTION_MODE) {
      parts.push('Irregular activity detected');
    } else if (resolvedSystemMode === SYSTEM_MODE.DELAYED_MODE) {
      parts.push('Network congestion detected');
    } else {
      const h = systemHealth;
      if (h?.network === 'degraded' || h?.network === 'offline' || h?.mempool === 'congested') {
        parts.push('Network congestion detected');
      }
    }
    const h = systemHealth;
    if (resolvedSystemMode !== SYSTEM_MODE.DELAYED_MODE && (h?.backend === 'lagging' || h?.signer === 'delayed')) {
      parts.push('Delays expected');
    }
    if (confirmationSlow) parts.push('Confirmations slower than usual');
    if (walletRecentFailureCount >= 2) parts.push('Repeated settlement issues observed');
    if (qw > QUEUE_WAITING_THRESHOLD_MEDIUM) parts.push('Settlement pipeline carrying extra load');
    if (resolvedSystemMode === SYSTEM_MODE.NORMAL_MODE) {
      if (cp > 0.42) parts.push('System load increasing');
      if (cp > 0.35 || ss >= 40) parts.push('Latency may rise');
    }
    return parts.length ? parts.join(' · ') : null;
  }, [systemHealth, confirmationSlow, walletRecentFailureCount, resolvedSystemMode, qw, cp, ss]);

  const tooltipTitle = useMemo(() => {
    if (mode === TRUST_LAYER_MODE.ERROR) {
      return 'Transaction or verification issue — check the flow modal.';
    }
    if (mode === TRUST_LAYER_MODE.PROCESSING) {
      return 'Transaction processing…';
    }
    if (backendOk === false) {
      return 'System operational · API health check failing (operations may still work).';
    }
    if (healthyBoost) {
      return 'Last action confirmed — funds tracked.';
    }
    if (consciousnessDetail && mode === TRUST_LAYER_MODE.HEALTHY) {
      return 'System aware — monitoring conditions';
    }
    return 'System operational';
  }, [mode, backendOk, healthyBoost, consciousnessDetail]);

  const tooltipDetail = useMemo(() => {
    const parts = [];
    if (pendingTxCount > 0) parts.push(`${pendingTxCount} pending in wallet queue`);
    if (secondsSinceConfirm != null) parts.push(`Last confirmed: ${secondsSinceConfirm}s ago`);
    else parts.push('No recent on-wallet confirmations');
    if (enableHealthPing && backendOk != null) parts.push(`API: ${backendOk ? 'reachable' : 'unreachable'}`);
    if (consciousnessDetail) parts.push(consciousnessDetail);
    return parts.join(' · ');
  }, [pendingTxCount, secondsSinceConfirm, enableHealthPing, backendOk, consciousnessDetail]);

  const palette =
    mode === TRUST_LAYER_MODE.ERROR
      ? {
          dot: isLight ? 'bg-red-500' : 'bg-red-400',
          glow: isLight ? 'shadow-[0_0_10px_rgba(239,68,68,0.45)]' : 'shadow-[0_0_12px_rgba(248,113,113,0.5)]',
          ring: isLight ? 'border-red-400/35' : 'border-red-400/40',
          flicker: true,
        }
      : mode === TRUST_LAYER_MODE.PROCESSING
        ? {
            dot: isLight ? 'bg-amber-500' : 'bg-amber-400',
            glow: isLight ? 'shadow-[0_0_10px_rgba(245,158,11,0.35)]' : 'shadow-[0_0_14px_rgba(251,191,36,0.35)]',
            ring: isLight ? 'border-amber-400/35' : 'border-amber-300/40',
            flicker: false,
          }
        : {
            dot: isLight ? 'bg-emerald-600' : 'bg-emerald-400',
            glow: healthyBoost
              ? isLight
                ? 'shadow-[0_0_14px_rgba(16,185,129,0.45)]'
                : 'shadow-[0_0_16px_rgba(52,211,153,0.45)]'
              : isLight
                ? 'shadow-[0_0_8px_rgba(16,185,129,0.28)]'
                : 'shadow-[0_0_10px_rgba(52,211,153,0.28)]',
            ring: isLight ? 'border-emerald-500/30' : 'border-emerald-400/35',
            flicker: false,
          };

  const ringPulse =
    mode === TRUST_LAYER_MODE.PROCESSING
      ? { scale: [1, 1.52, 1], opacity: [0.3, 0.07, 0.3] }
      : mode === TRUST_LAYER_MODE.ERROR
        ? { scale: [1, 1.32, 1], opacity: [0.26, 0.1, 0.26] }
        : healthyBoost
          ? { scale: [1, 1.62, 1], opacity: [0.36, 0.04, 0.36] }
          : { scale: [1, 1.42, 1], opacity: [0.2, 0.035, 0.2] };

  const ringDuration =
    (mode === TRUST_LAYER_MODE.PROCESSING ? 2.25 : mode === TRUST_LAYER_MODE.ERROR ? 1.05 : healthyBoost ? 1.4 : 2.7) *
    queuePace;

  const dotPulse =
    mode === TRUST_LAYER_MODE.PROCESSING
      ? { scale: [1, 1.12, 1], opacity: [0.85, 1, 0.85] }
      : { scale: [1, 1.06, 1], opacity: mode === TRUST_LAYER_MODE.ERROR ? [0.9, 1, 0.75, 1, 0.9] : [0.88, 1, 0.88] };

  const dotTransition =
    mode === TRUST_LAYER_MODE.ERROR
      ? { duration: 0.35, repeat: Infinity, ease: 'easeInOut' }
      : {
          duration: (mode === TRUST_LAYER_MODE.PROCESSING ? 2.0 : healthyBoost ? 1.35 : 2.4) * queuePace,
          repeat: Infinity,
          ease: 'easeInOut',
        };

  const nativeTitle = `${tooltipTitle} — ${tooltipDetail}`;

  return (
    <div className="group relative flex items-center" title={nativeTitle}>
      <div
        className={`relative flex h-9 w-9 cursor-default items-center justify-center rounded-xl border transition-colors duration-300 ${
          isLight ? 'border-slate-200/90 bg-white/80' : 'border-white/10 bg-white/[0.06]'
        }`}
        role="status"
        aria-label={nativeTitle}
      >
        {palette.flicker ? (
          <motion.span
            aria-hidden
            className={`pointer-events-none absolute inset-0 rounded-xl border ${palette.ring}`}
            animate={{ opacity: [0.2, 0.62, 0.22, 0.5, 0.2], scale: [1, 1.02, 1] }}
            transition={{ duration: 0.52, repeat: Infinity, ease: 'linear' }}
          />
        ) : null}
        <motion.span
          aria-hidden
          className={`pointer-events-none absolute h-3 w-3 rounded-full border ${palette.ring} bg-transparent`}
          animate={ringPulse}
          transition={{
            duration: ringDuration,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
        <motion.span
          aria-hidden
          className={`relative z-[1] h-2 w-2 rounded-full ${palette.dot} ${palette.glow}`}
          animate={dotPulse}
          transition={dotTransition}
        />
      </div>
      <div
        className={`pointer-events-none absolute right-0 top-full z-[80] mt-2 hidden w-56 translate-y-1 rounded-xl border px-3 py-2.5 text-left opacity-0 shadow-xl backdrop-blur-md transition-all duration-200 sm:block group-hover:translate-y-0 group-hover:opacity-100 ${
          isLight ? 'border-slate-200 bg-white/95 text-slate-800' : 'border-white/12 bg-[rgba(10,2,28,0.94)] text-white/92'
        }`}
      >
        <p className="text-[10px] font-semibold leading-snug tracking-tight">{tooltipTitle}</p>
        <p className={`mt-1.5 text-[9px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-white/55'}`}>{tooltipDetail}</p>
      </div>
    </div>
  );
}

const TrustPulseMemo = React.memo(TrustPulse, trustPulsePropsEqual);
export default TrustPulseMemo;

/**
 * TrustPulse with GpulseContext `systemHealth` and derived recent failure count.
 */
export function BoundTrustPulse({ walletTxHistory = [], queueWaiting = 0, ...rest }) {
  const { systemHealth, systemMode } = useGpulseSystem();
  const { confidence } = useSystemActions({ transactions: walletTxHistory, queueWaiting });
  const walletRecentFailureCount = useMemo(() => {
    const arr = (Array.isArray(walletTxHistory) ? walletTxHistory : []).slice(0, 16);
    return arr.filter((t) => String(t?.status || '').toUpperCase() === 'FAILED').length;
  }, [walletTxHistory]);

  return (
    <TrustPulseMemo
      {...rest}
      queueWaiting={queueWaiting}
      systemHealth={systemHealth}
      systemMode={systemMode}
      walletRecentFailureCount={walletRecentFailureCount}
      systemStressScore={confidence?.systemStressScore ?? 0}
      congestionProbability={confidence?.congestionProbability ?? 0}
    />
  );
}
