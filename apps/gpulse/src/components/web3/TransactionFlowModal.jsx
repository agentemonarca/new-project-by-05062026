import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, ExternalLink, X } from 'lucide-react';
import { useGpulseSystem } from '../../context/GpulseContext.jsx';
import { useSystemActions } from '../../hooks/useSystemActions.js';
import { DEFAULT_SYSTEM_MODE, SYSTEM_MODE } from '../../system/decisionEngine.js';

/** @typedef {'IDLE' | 'CONNECTING' | 'SIGNING' | 'BROADCASTING' | 'CONFIRMING' | 'SUCCESS' | 'ERROR'} TransactionFlowState */

export const TX_FLOW_STATE = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  SIGNING: 'SIGNING',
  BROADCASTING: 'BROADCASTING',
  CONFIRMING: 'CONFIRMING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
};

const DEFAULT_MESSAGES = {
  IDLE: '',
  CONNECTING: 'Connecting wallet...',
  SIGNING: 'Confirm in your wallet',
  BROADCASTING: 'Sending transaction...',
  CONFIRMING: 'Waiting for confirmation...',
  SUCCESS: 'Transaction complete',
  ERROR: 'Transaction failed',
};

/** Normalize to 0x-prefixed hex for explorers / copy. */
function normalizeTxHash(h) {
  const raw = String(h || '').trim();
  if (!raw) return '';
  const hex = raw.startsWith('0x') || raw.startsWith('0X') ? raw.slice(2) : raw;
  if (!hex) return '';
  return `0x${hex}`;
}

/** Display form e.g. 0x1234...abcd */
function shortenTxHash(h) {
  const s = normalizeTxHash(h);
  if (!s) return '';
  if (s.length <= 16) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

/**
 * @param {boolean} open
 * @param {string} state
 * @param {Record<string, string>} messages
 */
function useDelayedFlowText(open, state, messages, extraVisualDelay = 0) {
  const firstPaint = useRef(true);
  const [display, setDisplay] = useState({
    key: state,
    text: messages[state] || '',
    flowState: state,
  });

  useEffect(() => {
    if (!open) {
      firstPaint.current = true;
    }
  }, [open]);

  useEffect(() => {
    const next = messages[state] || DEFAULT_MESSAGES[state] || '';
    if (firstPaint.current) {
      firstPaint.current = false;
      setDisplay({ key: state, text: next, flowState: state });
      return;
    }
    const jitter = 200 + (Date.now() % 201);
    const delayMs = jitter + Math.max(0, Number(extraVisualDelay) || 0);
    const id = window.setTimeout(() => {
      setDisplay({ key: `${state}-${Date.now()}`, text: next, flowState: state });
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [state, messages, open, extraVisualDelay]);

  return display;
}

/**
 * Human-language status that evolves with elapsed time in long-running flow states
 * (reduces anxiety during CONFIRMING / BROADCASTING / slow wallet / connect).
 */
function useIntelligentTxNarrative(
  open,
  state,
  systemMode = DEFAULT_SYSTEM_MODE,
  uiFeedbackLevel = 'standard',
) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!open) {
      setElapsed(0);
      return undefined;
    }
    const started = Date.now();
    setElapsed(0);
    const tickMs = uiFeedbackLevel === 'minimal' ? 520 : uiFeedbackLevel === 'measured' ? 480 : 450;
    const id = window.setInterval(() => setElapsed(Date.now() - started), tickMs);
    return () => window.clearInterval(id);
  }, [open, state, uiFeedbackLevel]);

  return useMemo(() => {
    if (!open) return null;
    const sec = elapsed / 1000;

    const adapt = (text, tier) => {
      if (tier < 1) return { text, tier };
      if (uiFeedbackLevel === 'minimal') return { text, tier };
      if (systemMode === SYSTEM_MODE.PROTECTION_MODE) return { text: `Steady pace — ${text}`, tier };
      if (systemMode === SYSTEM_MODE.DELAYED_MODE) return { text: `Observing network load — ${text}`, tier };
      if (systemMode === SYSTEM_MODE.CAUTION_MODE) return { text: `Monitoring settlement — ${text}`, tier };
      return { text, tier };
    };

    if (state === TX_FLOW_STATE.CONFIRMING) {
      if (sec < 8) return { text: 'Your transaction is being validated by the network', tier: 0 };
      if (sec < 18) return adapt('Almost confirmed...', 1);
      return adapt('Finalizing...', 2);
    }

    if (state === TX_FLOW_STATE.BROADCASTING) {
      if (sec < 5) return { text: 'Sending your transaction — this only takes a moment.', tier: 0 };
      if (sec < 14) return adapt('Propagating across the network — validators are picking it up.', 1);
      return adapt('Still in flight — busy chains sometimes need a little longer.', 2);
    }

    if (state === TX_FLOW_STATE.SIGNING) {
      if (sec < 12) return null;
      return adapt('Waiting on your wallet — take a moment to review the details.', 1);
    }

    if (state === TX_FLOW_STATE.CONNECTING) {
      if (sec < 10) return null;
      return adapt('Still connecting — make sure your wallet extension is unlocked.', 1);
    }

    return null;
  }, [open, state, elapsed, systemMode, uiFeedbackLevel]);
}

const ENERGY_PARTICLE_COUNT = 14;
/** Aligned completion burst — sphere, flash, and particles */
const SUCCESS_BURST_S = 0.52;

/**
 * Cyan/violet energy field — radial breath + inward motes; reacts to TransactionFlowState.
 */
function TxFlowEnergyField({ state, isLight }) {
  const [successPhase, setSuccessPhase] = useState('idle');
  const wasSuccess = useRef(false);

  useLayoutEffect(() => {
    const ok = state === TX_FLOW_STATE.SUCCESS;
    if (ok && !wasSuccess.current) {
      setSuccessPhase('burst');
      wasSuccess.current = true;
      return undefined;
    }
    if (!ok) {
      wasSuccess.current = false;
      setSuccessPhase('idle');
    }
    return undefined;
  }, [state]);

  useEffect(() => {
    if (state !== TX_FLOW_STATE.SUCCESS || successPhase !== 'burst') return undefined;
    const t = window.setTimeout(() => setSuccessPhase('calm'), Math.round(SUCCESS_BURST_S * 1000) + 80);
    return () => window.clearTimeout(t);
  }, [state, successPhase]);

  const particles = useMemo(
    () =>
      Array.from({ length: ENERGY_PARTICLE_COUNT }, (_, i) => {
        const angle = (i / ENERGY_PARTICLE_COUNT) * Math.PI * 2 + i * 0.37;
        const radius = 34 + (i % 5) * 5.5;
        return {
          id: i,
          angle,
          radius,
          duration: 2.6 + (i % 5) * 0.45,
          delay: i * 0.16,
          size: 1.25 + (i % 4) * 0.35,
          violet: i % 3 === 1,
          scatter: 1 + (i % 7) * 0.035,
        };
      }),
    [],
  );

  const isConfirming = state === TX_FLOW_STATE.CONFIRMING;
  const isBroadcasting = state === TX_FLOW_STATE.BROADCASTING;
  const isError = state === TX_FLOW_STATE.ERROR;
  const isSuccess = state === TX_FLOW_STATE.SUCCESS;
  const calmRadial = isSuccess && successPhase === 'calm';
  const terminalSoft = isError || calmRadial || state === TX_FLOW_STATE.IDLE;

  const strength = isError ? 0.65 : terminalSoft ? 0.48 : isBroadcasting ? 1.08 : isConfirming ? 0.82 : 0.88;
  const radialDuration =
    isConfirming ? 8.5 : isBroadcasting ? 3.2 : isError ? 2.8 : calmRadial ? 6.8 : 5.5;

  const coreBlurDuration = isConfirming ? 6.6 : isBroadcasting ? 3.4 : calmRadial ? 5.5 : 4.2;

  const cyan = isLight ? 'rgba(6,182,212,' : 'rgba(34,211,238,';
  const violet = isLight ? 'rgba(124,58,237,' : 'rgba(167,139,246,';

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible" aria-hidden>
      {isError ? (
        <motion.div
          className="absolute inset-0 rounded-[40%]"
          style={{
            background: isLight
              ? 'radial-gradient(circle at 50% 45%, rgba(248,113,113,0.14), transparent 58%)'
              : 'radial-gradient(circle at 50% 45%, rgba(239,68,68,0.12), transparent 55%)',
          }}
          animate={{ opacity: [0.2, 0.55, 0.28, 0.5, 0.22] }}
          transition={{ duration: 0.45, repeat: Infinity, ease: 'linear' }}
        />
      ) : null}

      <motion.div
        className="absolute left-1/2 top-1/2 aspect-square w-[145%] max-w-[220px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: isLight
            ? `radial-gradient(circle at 48% 42%, ${cyan}0.1), transparent 52%), radial-gradient(circle at 58% 58%, ${violet}0.07), transparent 56%)`
            : `radial-gradient(circle at 48% 42%, ${cyan}${0.09 * strength}), transparent 54%), radial-gradient(circle at 56% 56%, ${violet}${0.07 * strength}), transparent 52%)`,
        }}
        animate={
          isSuccess && successPhase === 'burst'
            ? { scale: [1, 1.14, 1], opacity: [0.55, 0.92, 0.52] }
            : {
                scale: isConfirming ? [1, 1.03, 0.997, 1] : [1, 1.05, 0.99, 1],
                opacity: isConfirming ? [0.5, 0.72, 0.58, 0.5] : [0.55, 0.88, 0.62, 0.55],
              }
        }
        transition={
          isSuccess && successPhase === 'burst'
            ? { duration: SUCCESS_BURST_S, times: [0, 0.5, 1], ease: [0.2, 0.85, 0.35, 1] }
            : {
                duration: radialDuration,
                repeat: Infinity,
                ease: isConfirming ? [0.4, 0, 0.6, 1] : 'easeInOut',
              }
        }
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[100px] w-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{
          background: isLight
            ? `radial-gradient(circle, ${cyan}0.12), transparent 72%)`
            : `radial-gradient(circle, ${cyan}${0.1 * strength}) 0%, ${violet}${0.06 * strength}) 38%, transparent 68%)`,
        }}
        animate={
          isSuccess && successPhase === 'burst'
            ? { scale: [0.88, 1.28, 0.96], opacity: [0.32, 0.58, 0.26] }
            : {
                scale: isConfirming ? [0.94, 1.02, 0.96, 0.94] : [0.92, 1.04, 0.92],
                opacity: isConfirming ? [0.24, 0.36, 0.28, 0.24] : [0.28, 0.42, 0.28],
              }
        }
        transition={
          isSuccess && successPhase === 'burst'
            ? { duration: SUCCESS_BURST_S, times: [0, 0.48, 1], ease: [0.18, 0.9, 0.4, 1] }
            : { duration: coreBlurDuration, repeat: Infinity, ease: 'easeInOut' }
        }
      />

      {isSuccess && successPhase === 'burst' ? (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 z-[1] aspect-square w-20 max-w-[88px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: isLight
              ? 'radial-gradient(circle, rgba(16,185,129,0.35) 0%, rgba(6,182,212,0.12) 42%, transparent 68%)'
              : 'radial-gradient(circle, rgba(52,211,153,0.42) 0%, rgba(34,211,238,0.12) 38%, rgba(167,139,246,0.08) 52%, transparent 70%)',
          }}
          initial={{ scale: 0.55, opacity: 0.95 }}
          animate={{ scale: 2.35, opacity: 0 }}
          transition={{ duration: SUCCESS_BURST_S, ease: [0.12, 0.82, 0.2, 1] }}
        />
      ) : null}

      {isConfirming ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={`confirm-ripple-${i}`}
              className={`absolute left-1/2 top-1/2 aspect-square w-[42px] -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                isLight ? 'border-cyan-400/25' : 'border-cyan-300/22'
              }`}
              initial={{ scale: 0.55, opacity: 0.35 }}
              animate={{ scale: 2.35, opacity: 0 }}
              transition={{
                duration: 3.6,
                repeat: Infinity,
                ease: 'easeOut',
                delay: i * 0.9,
              }}
            />
          ))}
          {[0, 1, 2].map((i) => (
            <motion.span
              key={`confirm-ripple-v-${i}`}
              className={`absolute left-1/2 top-1/2 aspect-square w-[38px] -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                isLight ? 'border-violet-400/20' : 'border-violet-400/18'
              }`}
              initial={{ scale: 0.5, opacity: 0.28 }}
              animate={{ scale: 2.05, opacity: 0 }}
              transition={{
                duration: 4.1,
                repeat: Infinity,
                ease: 'easeOut',
                delay: 0.45 + i * 1.05,
              }}
            />
          ))}
        </>
      ) : null}

      {particles.map((p) => {
        const x0 = Math.cos(p.angle) * p.radius;
        const y0 = Math.sin(p.angle) * p.radius;
        const sc = p.scatter;

        let fill = p.violet ? `${violet}${isLight ? '0.18' : '0.14'})` : `${cyan}${isLight ? '0.16' : '0.12'})`;
        if (isError) {
          fill = p.violet
            ? `${isLight ? 'rgba(248,113,113,' : 'rgba(252,165,165,'}${isLight ? '0.2' : '0.16'})`
            : `${isLight ? 'rgba(239,68,68,' : 'rgba(248,113,113,'}${isLight ? '0.14' : '0.12'})`;
        }

        let animate;
        let transition;

        if (isError) {
          const ox = x0 * sc * 1.12;
          const oy = y0 * sc * 1.12;
          animate = {
            x: [ox * 0.7, ox * 1.22, ox * 0.85, ox * 1.08, ox * 0.75],
            y: [oy * 0.65, oy * 1.15, oy * 0.92, oy * 1.05, oy * 0.68],
            opacity: [0.07, 0.14, 0.09, 0.12, 0.07],
            scale: [1, 0.92, 1.05, 0.88, 1],
          };
          transition = {
            duration: 0.85 + (p.id % 4) * 0.12,
            repeat: Infinity,
            delay: p.delay * 0.4,
            ease: 'easeInOut',
          };
        } else if (isSuccess && successPhase === 'burst') {
          const out = 1.3;
          animate = {
            x: [0, x0 * out * 0.22, x0 * out, x0 * 0.12, 0],
            y: [0, y0 * out * 0.22, y0 * out, y0 * 0.12, 0],
            opacity: [0.09, 0.22, 0.2, 0.11, 0.06],
            scale: [0.52, 1.14, 1.1, 0.94, 0.82],
          };
          transition = {
            duration: SUCCESS_BURST_S,
            times: [0, 0.2, 0.42, 0.78, 1],
            ease: [0.22, 0.06, 0.25, 1],
          };
        } else if (isSuccess && successPhase === 'calm') {
          animate = {
            x: [x0 * 0.55, x0 * 0.22, 0],
            y: [y0 * 0.55, y0 * 0.22, 0],
            opacity: [0.05, 0.1, 0.05],
            scale: [1, 1.04, 0.4],
          };
          transition = {
            duration: p.duration * 1.35,
            repeat: Infinity,
            delay: p.delay,
            ease: [0.5, 0, 0.35, 1],
            repeatDelay: 0.5 + (p.id % 3) * 0.28,
          };
        } else if (isBroadcasting) {
          animate = {
            x: [x0, x0 * 0.14, 0],
            y: [y0, y0 * 0.14, 0],
            opacity: [0.07, 0.17, 0.05],
            scale: [1, 1.1, 0.32],
          };
          transition = {
            duration: p.duration * 0.68,
            repeat: Infinity,
            delay: p.delay * 0.85,
            ease: [0.08, 0.55, 0.2, 1],
            repeatDelay: 0.22 + (p.id % 3) * 0.12,
          };
        } else if (isConfirming) {
          animate = {
            x: [x0, x0 * 0.38, x0 * 0.18, 0],
            y: [y0, y0 * 0.38, y0 * 0.18, 0],
            opacity: [0.05, 0.11, 0.09, 0.05],
            scale: [1, 1.05, 0.95, 0.42],
          };
          transition = {
            duration: p.duration * 1.65,
            repeat: Infinity,
            delay: p.delay * 1.2,
            ease: [0.42, 0, 0.58, 1],
            repeatDelay: 0.65 + (p.id % 3) * 0.35,
          };
        } else {
          animate = {
            x: [x0, x0 * 0.32, 0],
            y: [y0, y0 * 0.32, 0],
            opacity: [0.06, 0.16, 0.05],
            scale: [1, 1.08, 0.35],
          };
          transition = {
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: [0.45, 0, 0.25, 1],
            repeatDelay: 0.35 + (p.id % 3) * 0.2,
          };
        }

        return (
          <motion.span
            key={`${p.id}-${isSuccess ? successPhase : state}`}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              background: fill,
              boxShadow: isLight ? `0 0 5px ${fill}` : `0 0 6px ${fill}`,
            }}
            initial={false}
            animate={animate}
            transition={transition}
          />
        );
      })}
    </div>
  );
}

function textClassForFlowState(flowState) {
  switch (flowState) {
    case TX_FLOW_STATE.CONNECTING:
      return 'text-cyan-200';
    case TX_FLOW_STATE.SIGNING:
      return 'text-violet-200';
    case TX_FLOW_STATE.BROADCASTING:
      return 'text-amber-100';
    case TX_FLOW_STATE.CONFIRMING:
      return 'text-sky-100';
    case TX_FLOW_STATE.SUCCESS:
      return 'text-emerald-100';
    case TX_FLOW_STATE.ERROR:
      return 'text-red-200';
    default:
      return 'text-white/70';
  }
}

/**
 * Premium full-screen Web3 flow overlay — Energy Sphere + glass panel.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {TransactionFlowState} props.state
 * @param {string} [props.txHash]
 * @param {string} [props.errorMessage]
 * @param {string} [props.title] — e.g. "Depósito", "Retiro"
 * @param {boolean} [props.isLight]
 * @param {() => void} props.onClose
 * @param {Record<string, string>} [props.messages] — optional overrides per state
 * @param {string} [props.explorerBaseUrl] — default https://bscscan.com (no trailing slash)
 * @param {Array<object>} [props.adaptationTransactions] — wallet rows for adaptive pacing (optional)
 * @param {number} [props.queueWaiting] — server queue depth for adaptation (optional)
 */
export default function TransactionFlowModal({
  open,
  state = TX_FLOW_STATE.IDLE,
  txHash = '',
  errorMessage = '',
  title = '',
  isLight = false,
  onClose,
  messages: messagesProp,
  explorerBaseUrl = 'https://bscscan.com',
  adaptationTransactions,
  queueWaiting = 0,
}) {
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef(null);
  const { systemMode: systemModeFromCtx } = useGpulseSystem();
  const systemMode = typeof systemModeFromCtx === 'string' ? systemModeFromCtx : DEFAULT_SYSTEM_MODE;
  const safeAdaptTx = Array.isArray(adaptationTransactions) ? adaptationTransactions : [];
  const { actions: systemActions } = useSystemActions({
    transactions: safeAdaptTx,
    queueWaiting: Number(queueWaiting) || 0,
  });

  /** >1 when txSpeedMultiplier < 1 — slightly slower feedback under stress (non-intrusive). */
  const adaptationPace = useMemo(
    () => Math.min(2.2, 1 / Math.max(0.35, systemActions.txSpeedMultiplier)),
    [systemActions.txSpeedMultiplier],
  );

  const flowVisualDelayMs = useMemo(() => {
    let base = 0;
    switch (systemMode) {
      case SYSTEM_MODE.DELAYED_MODE:
        base = 320;
        break;
      case SYSTEM_MODE.CAUTION_MODE:
        base = 160;
        break;
      case SYSTEM_MODE.PROTECTION_MODE:
        base = 240;
        break;
      default:
        base = 0;
    }
    const stressBump = systemActions.uiFeedbackLevel === 'minimal' ? 1.06 : 1;
    return Math.round(base * adaptationPace * stressBump);
  }, [systemMode, adaptationPace, systemActions.uiFeedbackLevel]);

  const messages = useMemo(() => ({ ...DEFAULT_MESSAGES, ...messagesProp }), [messagesProp]);
  const { key: textAnimKey, text: delayedLabel, flowState: labelFlowState } = useDelayedFlowText(
    open,
    state,
    messages,
    flowVisualDelayMs,
  );
  const narrative = useIntelligentTxNarrative(open, state, systemMode, systemActions.uiFeedbackLevel);
  const statusLine = narrative?.text ?? delayedLabel;
  const statusLineKey = narrative ? `intel-${state}-${narrative.tier}` : textAnimKey;
  const statusLinePalette = narrative ? textClassForFlowState(state) : textClassForFlowState(labelFlowState);

  const canDismiss =
    state === TX_FLOW_STATE.SUCCESS ||
    state === TX_FLOW_STATE.ERROR ||
    state === TX_FLOW_STATE.IDLE;

  const palette = useMemo(() => {
    const ap = adaptationPace;
    switch (state) {
      case TX_FLOW_STATE.CONNECTING:
        return {
          core: 'from-cyan-400/40 via-cyan-500/15 to-violet-600/25',
          ring: 'border-cyan-400/45 shadow-[0_0_48px_rgba(34,211,238,0.35)]',
          ringSpeed: 18 * ap,
          pulseDuration: 2.2 * ap,
          glowIntensity: 1,
          text: 'text-cyan-200',
        };
      case TX_FLOW_STATE.SIGNING:
        return {
          core: 'from-violet-500/45 via-fuchsia-500/20 to-violet-900/30',
          ring: 'border-violet-400/55 shadow-[0_0_40px_rgba(167,139,250,0.4)]',
          ringSpeed: 22 * ap,
          pulseDuration: 4.2 * ap,
          glowIntensity: 0.85,
          text: 'text-violet-200',
        };
      case TX_FLOW_STATE.BROADCASTING:
        return {
          core: 'from-amber-400/50 via-yellow-500/25 to-cyan-500/20',
          ring: 'border-amber-300/60 shadow-[0_0_52px_rgba(251,191,36,0.45)]',
          ringSpeed: 4.2 * ap,
          pulseDuration: 0.85 * ap,
          glowIntensity: 1.25,
          text: 'text-amber-100',
        };
      case TX_FLOW_STATE.CONFIRMING:
        return {
          core: 'from-sky-400/35 via-cyan-500/25 to-blue-600/25',
          ring: 'border-sky-400/50 shadow-[0_0_44px_rgba(56,189,248,0.35)]',
          ringSpeed: 14 * ap,
          pulseDuration: 1.85 * ap,
          glowIntensity: 0.95,
          text: 'text-sky-100',
        };
      case TX_FLOW_STATE.SUCCESS:
        return {
          core: 'from-emerald-400/50 via-emerald-500/30 to-teal-700/25',
          ring: 'border-emerald-400/70 shadow-[0_0_56px_rgba(52,211,153,0.55)]',
          ringSpeed: 28 * ap,
          pulseDuration: 1.6 * ap,
          glowIntensity: 1.35,
          text: 'text-emerald-100',
        };
      case TX_FLOW_STATE.ERROR:
        return {
          core: 'from-red-500/45 via-red-600/25 to-rose-950/40',
          ring: 'border-red-400/60 shadow-[0_0_40px_rgba(248,113,113,0.45)]',
          ringSpeed: 24 * ap,
          pulseDuration: 0.45 * ap,
          glowIntensity: 1.1,
          text: 'text-red-200',
        };
      default:
        return {
          core: 'from-white/15 via-white/5 to-white/5',
          ring: 'border-white/15 shadow-[0_0_24px_rgba(255,255,255,0.08)]',
          ringSpeed: 20 * ap,
          pulseDuration: 2 * ap,
          glowIntensity: 0.7,
          text: 'text-white/70',
        };
    }
  }, [state, adaptationPace]);

  const panelBg = isLight
    ? 'bg-white/92 border-slate-200/90 shadow-[0_24px_80px_rgba(15,23,42,0.12)]'
    : 'bg-black/75 border-white/12 shadow-[0_28px_100px_rgba(0,0,0,0.65)] backdrop-blur-2xl';

  const sphereAnimate = useMemo(() => {
    if (state === TX_FLOW_STATE.ERROR) {
      return {
        scale: 1,
        x: [0, -5, 5, -4, 4, -2, 0],
        rotate: [0, -1.2, 1.2, -0.8, 0],
      };
    }
    if (state === TX_FLOW_STATE.SUCCESS) {
      return { scale: [1, 1.3, 1], x: 0, rotate: 0 };
    }
    if (state === TX_FLOW_STATE.BROADCASTING) {
      return { scale: [1, 1.018, 0.985, 1.012, 1], x: 0, rotate: 0 };
    }
    if (state === TX_FLOW_STATE.CONFIRMING) {
      return { scale: [1, 1.006, 0.994, 1], x: 0, rotate: 0 };
    }
    if (state === TX_FLOW_STATE.CONNECTING) {
      return { scale: [1, 1.008, 0.996, 1], x: 0, rotate: 0 };
    }
    return { scale: 1, x: 0, rotate: 0 };
  }, [state]);

  const sphereTransition = useMemo(() => {
    const ap = adaptationPace;
    if (state === TX_FLOW_STATE.ERROR) {
      return { duration: 0.38 * ap, ease: 'easeOut' };
    }
    if (state === TX_FLOW_STATE.SUCCESS) {
      return { duration: SUCCESS_BURST_S * ap, times: [0, 0.52, 1], ease: [0.2, 0.88, 0.34, 1] };
    }
    if (state === TX_FLOW_STATE.BROADCASTING) {
      return { duration: 0.22 * ap, repeat: Infinity, ease: 'easeInOut' };
    }
    if (state === TX_FLOW_STATE.CONFIRMING) {
      return { duration: 0.35 * ap, repeat: Infinity, ease: 'easeInOut' };
    }
    if (state === TX_FLOW_STATE.CONNECTING) {
      return { duration: 0.4 * ap, repeat: Infinity, ease: 'easeInOut' };
    }
    return { duration: 0.3 * ap };
  }, [state, adaptationPace]);

  const fullHash = normalizeTxHash(txHash);
  const showTxExplorer =
    Boolean(fullHash) && (state === TX_FLOW_STATE.CONFIRMING || state === TX_FLOW_STATE.SUCCESS);
  const bscTxUrl = useMemo(() => {
    if (!fullHash) return '';
    const base = String(explorerBaseUrl || 'https://bscscan.com').replace(/\/$/, '');
    return `${base}/tx/${encodeURIComponent(fullHash)}`;
  }, [explorerBaseUrl, fullHash]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  useEffect(() => {
    setCopied(false);
  }, [fullHash]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
    };
  }, []);

  const handleCopyHash = () => {
    if (!fullHash || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(fullHash).then(() => {
      setCopied(true);
      if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
      copyResetRef.current = window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <AnimatePresence mode="wait">
      {open ? (
        <motion.div
          key="tx-flow-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tx-flow-title"
          aria-live="polite"
          className="fixed inset-0 z-[70] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/55 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (canDismiss) onClose?.();
            }}
          />
          <motion.div
            className={`relative z-10 w-full max-w-[380px] overflow-hidden rounded-3xl border ${panelBg}`}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{
              opacity: 1,
              scale: state === TX_FLOW_STATE.ERROR ? [1, 1.008, 0.996, 1] : 1,
              y: 0,
              x: state === TX_FLOW_STATE.ERROR ? [0, -3, 3, -2, 2, 0] : 0,
            }}
            transition={{
              duration: state === TX_FLOW_STATE.ERROR ? 0.42 : 0.38,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.12),transparent_55%)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-violet-500/20 blur-3xl"
              aria-hidden
            />

            <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p id="tx-flow-title" className={`text-[10px] font-black uppercase tracking-[0.28em] ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
                  {title || 'G-Pulse'} · Web3
                </p>
                <p className={`mt-1 text-sm font-semibold tracking-tight ${isLight ? 'text-slate-900' : 'text-white/95'}`}>Secure flow</p>
              </div>
              {canDismiss ? (
                <button
                  type="button"
                  onClick={() => onClose?.()}
                  className={`rounded-xl p-2 transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-white/45 hover:bg-white/10 hover:text-white'}`}
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>

            <div className="relative flex flex-col items-center px-6 pb-8 pt-6">
              <div className="relative mb-7 flex h-40 w-full max-w-[280px] items-center justify-center">
                <TxFlowEnergyField state={state} isLight={isLight} />
                {/* Energy sphere */}
                <motion.div
                  className="relative z-[2] flex h-36 w-36 items-center justify-center"
                  animate={sphereAnimate}
                  transition={sphereTransition}
                >
                {/* Outer glow — reacts to state intensity */}
                <motion.div
                  className={`pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br ${palette.core} blur-xl`}
                  animate={{
                    opacity: [0.35 * palette.glowIntensity, 0.65 * palette.glowIntensity, 0.4 * palette.glowIntensity],
                    scale: state === TX_FLOW_STATE.SUCCESS ? 1 : [1, 1.08, 1],
                  }}
                  transition={{
                    duration: state === TX_FLOW_STATE.SUCCESS ? SUCCESS_BURST_S : palette.pulseDuration,
                    times: state === TX_FLOW_STATE.SUCCESS ? [0, 0.5, 1] : undefined,
                    repeat: state === TX_FLOW_STATE.SUCCESS ? 0 : Infinity,
                    ease: state === TX_FLOW_STATE.SUCCESS ? [0.18, 0.9, 0.38, 1] : 'easeInOut',
                  }}
                />

                {/* CONFIRMING — soft ripples */}
                {state === TX_FLOW_STATE.CONFIRMING ? (
                  <>
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="pointer-events-none absolute inset-4 rounded-full border border-sky-400/35"
                        initial={{ scale: 0.65, opacity: 0.45 }}
                        animate={{ scale: 1.45, opacity: 0 }}
                        transition={{
                          duration: 2.4,
                          repeat: Infinity,
                          ease: 'easeOut',
                          delay: i * 0.8,
                        }}
                      />
                    ))}
                  </>
                ) : null}

                <motion.div
                  className={`absolute inset-2 rounded-full border-2 border-dashed ${palette.ring} opacity-80`}
                  animate={{ rotate: 360 }}
                  transition={{ duration: palette.ringSpeed, repeat: Infinity, ease: 'linear' }}
                />
                {/* BROADCASTING — electric flicker on ring */}
                {state === TX_FLOW_STATE.BROADCASTING ? (
                  <motion.div
                    className={`pointer-events-none absolute inset-2 rounded-full border-2 border-dashed border-amber-200/50`}
                    animate={{
                      opacity: [0.15, 0.95, 0.25, 1, 0.4, 0.9, 0.2],
                      rotate: -360,
                    }}
                    transition={{ opacity: { duration: 0.12, repeat: Infinity, repeatType: 'mirror' }, rotate: { duration: 3.2, repeat: Infinity, ease: 'linear' } }}
                  />
                ) : null}

                <motion.div
                  className={`absolute inset-0 rounded-full bg-gradient-to-br ${palette.core} opacity-90 blur-[2px]`}
                  animate={{
                    scale:
                      state === TX_FLOW_STATE.SIGNING
                        ? [1, 1.06, 1]
                        : state === TX_FLOW_STATE.SUCCESS
                          ? 1
                          : [1, 1.08, 1],
                    opacity:
                      state === TX_FLOW_STATE.ERROR
                        ? [0.75, 1, 0.55, 0.95, 0.72, 1, 0.6]
                        : state === TX_FLOW_STATE.SUCCESS
                          ? [0.85 * palette.glowIntensity, 1 * palette.glowIntensity, 0.75 * palette.glowIntensity]
                          : [0.7 * palette.glowIntensity, 1 * palette.glowIntensity, 0.72 * palette.glowIntensity],
                  }}
                  transition={{
                    duration:
                      state === TX_FLOW_STATE.SIGNING
                        ? palette.pulseDuration
                        : state === TX_FLOW_STATE.SUCCESS
                          ? SUCCESS_BURST_S
                          : state === TX_FLOW_STATE.ERROR
                            ? 0.11
                            : palette.pulseDuration,
                    times: state === TX_FLOW_STATE.SUCCESS ? [0, 0.48, 1] : undefined,
                    repeat: state === TX_FLOW_STATE.SUCCESS ? 0 : Infinity,
                    ease: state === TX_FLOW_STATE.SUCCESS ? [0.2, 0.85, 0.4, 1] : 'easeInOut',
                  }}
                />

                <motion.div
                  className="relative h-24 w-24 rounded-full bg-gradient-to-br from-white/25 via-white/5 to-transparent shadow-[inset_0_0_32px_rgba(255,255,255,0.15)]"
                  initial={false}
                  animate={{
                    boxShadow:
                      state === TX_FLOW_STATE.SUCCESS
                        ? [
                            'inset 0 0 32px rgba(52,211,153,0.25), 0 0 0 0 rgba(52,211,153,0.4)',
                            'inset 0 0 56px rgba(52,211,153,0.65), 0 0 48px rgba(52,211,153,0.55)',
                            'inset 0 0 36px rgba(52,211,153,0.35), 0 0 20px rgba(52,211,153,0.2)',
                          ]
                        : state === TX_FLOW_STATE.ERROR
                          ? [
                              'inset 0 0 32px rgba(248,113,113,0.4), 0 0 24px rgba(248,113,113,0.35)',
                              'inset 0 0 48px rgba(248,113,113,0.75), 0 0 40px rgba(239,68,68,0.5)',
                              'inset 0 0 32px rgba(248,113,113,0.45), 0 0 20px rgba(248,113,113,0.25)',
                            ]
                          : 'inset 0 0 32px rgba(255,255,255,0.15)',
                    scale:
                      state === TX_FLOW_STATE.SUCCESS
                        ? 1
                        : state === TX_FLOW_STATE.ERROR
                          ? [1, 0.94, 1.02, 1]
                          : [1, 1.04, 1],
                  }}
                  transition={{
                    duration: state === TX_FLOW_STATE.SUCCESS ? SUCCESS_BURST_S : state === TX_FLOW_STATE.ERROR ? 0.28 : palette.pulseDuration,
                    times: state === TX_FLOW_STATE.SUCCESS ? [0, 0.5, 1] : undefined,
                    repeat: state === TX_FLOW_STATE.SUCCESS || state === TX_FLOW_STATE.ERROR ? 0 : Infinity,
                    ease: state === TX_FLOW_STATE.SUCCESS ? [0.18, 0.92, 0.36, 1] : 'easeInOut',
                  }}
                />

                {state === TX_FLOW_STATE.BROADCASTING ? (
                  <motion.div
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      background:
                        'conic-gradient(from 0deg, transparent, rgba(34,211,238,0.35), transparent, rgba(168,85,247,0.35), transparent)',
                    }}
                    animate={{ rotate: -360, opacity: [0.35, 0.75, 0.4, 0.9, 0.35] }}
                    transition={{
                      rotate: { duration: 2.2, repeat: Infinity, ease: 'linear' },
                      opacity: { duration: 0.18, repeat: Infinity, ease: 'linear' },
                    }}
                  />
                ) : null}
                </motion.div>
              </div>

              {/* Status copy — crossfade + blur handoff */}
              <div className="relative flex min-h-[3.25rem] w-full max-w-[300px] items-center justify-center">
                <AnimatePresence mode="sync" initial={false}>
                  <motion.p
                    key={statusLineKey}
                    initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(5px)' }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    className={`absolute text-center text-[15px] font-medium leading-snug tracking-[-0.02em] ${statusLinePalette}`}
                  >
                    {statusLine}
                  </motion.p>
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {showTxExplorer ? (
                  <motion.div
                    key={`tx-row-${fullHash}`}
                    role="group"
                    aria-label="Transaction hash"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className={`mt-4 w-full max-w-[320px] rounded-2xl border px-3 py-3 ${
                      isLight
                        ? 'border-slate-200/90 bg-slate-50/90 shadow-sm'
                        : 'border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0 rgba(255,255,255,0.06)]'
                    }`}
                  >
                    <p
                      className={`text-center font-mono text-[12px] font-medium tracking-tight ${
                        isLight ? 'text-slate-800' : 'text-cyan-100/95'
                      }`}
                    >
                      {shortenTxHash(fullHash)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <a
                        href={bscTxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors ${
                          isLight
                            ? 'bg-slate-900 text-white hover:bg-slate-800'
                            : 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/35 hover:bg-cyan-500/30'
                        }`}
                      >
                        <span>View on BscScan</span>
                        <ExternalLink size={13} className="opacity-90" aria-hidden />
                      </a>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={handleCopyHash}
                          className={`rounded-xl p-2 transition-colors ${
                            isLight
                              ? 'text-slate-600 hover:bg-slate-200/90'
                              : 'text-cyan-200/90 hover:bg-white/10 hover:text-cyan-100'
                          }`}
                          aria-label="Copy transaction hash"
                        >
                          <Copy size={16} strokeWidth={2} />
                        </button>
                        <AnimatePresence>
                          {copied ? (
                            <motion.span
                              role="status"
                              initial={{ opacity: 0, y: 6, scale: 0.94 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 4, scale: 0.96 }}
                              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                              className={`pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 rounded-lg px-2 py-1 text-[10px] font-semibold shadow-lg ${
                                isLight
                                  ? 'border border-slate-200 bg-white text-emerald-700'
                                  : 'border border-emerald-500/40 bg-emerald-950/95 text-emerald-200'
                              }`}
                            >
                              Copied
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {state === TX_FLOW_STATE.ERROR && errorMessage ? (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="mt-4 max-h-24 overflow-y-auto rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-center text-[11px] leading-relaxed text-red-200/95"
                >
                  {errorMessage}
                </motion.p>
              ) : null}

              {state === TX_FLOW_STATE.SUCCESS ? (
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-3xl bg-emerald-400/14"
                  initial={{ opacity: 0.75, scale: 0.5 }}
                  animate={{ opacity: 0, scale: 2.35 }}
                  transition={{ duration: SUCCESS_BURST_S, ease: [0.14, 0.88, 0.35, 1] }}
                />
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
