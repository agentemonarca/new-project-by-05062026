import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { unlockAudio } from '../utils/audioUnlock.js';

const COOLDOWN_MS = {
  hot: 90_000,
  signal_access: 120_000,
  /** Cierre de venta (vista Upgrade en Access): mínimo entre mensajes */
  closing_upgrade: 120_000,
};

/** Texto en pantalla (varias líneas); voz usa frase fluida */
const CLOSING_DISPLAY = `Ya lo estás viendo…

No es lo mismo observar… que estar sincronizado.

Este nivel cambia la forma en que operas.`;

const CLOSING_SPEECH =
  'Ya lo estás viendo. No es lo mismo observar que estar sincronizado. Este nivel cambia la forma en que operas.';

/** Permanencia mínima en Upgrade antes del cierre (8–10 s, un valor por visita). */
function randomUpgradeDwellMs() {
  return 8000 + Math.floor(Math.random() * 2001);
}

/** En App, la vista Upgrade es Access + sub-vista interna `upgrade` (no existe `activeView === "upgrade"` a nivel raíz). */
function isUpgradeRoute(activeView, accessSubView) {
  return activeView === 'access' && accessSubView === 'upgrade';
}

/** Texto en pantalla (varias líneas); voz usa frase fluida */
const MESSAGES = {
  welcome: 'Bienvenido. G Pulse está activo y sincronizado contigo. Avanza con calma.',
  hot: 'La actividad del flujo es elevada. Es un buen momento para decidir con claridad y firmeza.',
  signal: 'Tu acceso actual es parcial. Cuando decidas ampliarlo, verás el contexto completo.',
};

const KNOWN = new Set(['SIGNAL', 'OPERATOR', 'ARCHITECT', 'VERTEX']);

function normalizePlan(raw) {
  if (raw == null || raw === '') return null;
  const u = String(raw).trim().toUpperCase();
  return KNOWN.has(u) ? u : null;
}

function canUseSpeech() {
  return typeof window !== 'undefined' && window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined';
}

/**
 * Asistente de voz G_Pulse: guía breve, tono sereno; evita repetición por ventanas de tiempo.
 *
 * @param {{
 *   gpulse?: { zone?: string },
 *   userPlan?: string | null,
 *   activeView?: string,
 *   accessSubView?: 'overview' | 'compare' | 'upgrade' | string,
 *   isLightMode?: boolean,
 *   anchor?: 'main' | 'fixed',
 * }} props
 */
export default function GpulseVoiceAssistant({
  gpulse = null,
  userPlan = null,
  activeView = 'dashboard',
  accessSubView = 'overview',
  isLightMode = false,
  anchor = 'main',
}) {
  const [caption, setCaption] = useState(null);
  const [kind, setKind] = useState(null);

  const lastSpokenAt = useRef({});
  const welcomeScheduledRef = useRef(false);
  const welcomeDoneRef = useRef(false);
  const prevZoneRef = useRef(undefined);
  /** Una sola reproducción del cierre por sesión de página (Upgrade). */
  const upgradeClosingPlayedSessionRef = useRef(false);
  const hideTimerRef = useRef(null);

  const gpulseRef = useRef(gpulse);
  const userPlanRef = useRef(userPlan);
  const activeViewRef = useRef(activeView);
  const accessSubViewRef = useRef(accessSubView);
  gpulseRef.current = gpulse;
  userPlanRef.current = userPlan;
  activeViewRef.current = activeView;
  accessSubViewRef.current = accessSubView;

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const canSpeak = useCallback((id, cooldownMs) => {
    const now = Date.now();
    if (cooldownMs > 0 && now - (lastSpokenAt.current[id] || 0) < cooldownMs) return false;
    lastSpokenAt.current[id] = now;
    return true;
  }, []);

  const speakAloud = useCallback(async (text) => {
    if (!canUseSpeech()) return null;
    await unlockAudio();
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES';
      u.rate = 0.9;
      u.pitch = 1;
      const voices = window.speechSynthesis.getVoices();
      const es =
        voices.find((v) => v.lang?.startsWith?.('es')) || voices.find((v) => String(v.lang || '').includes('es'));
      if (es) u.voice = es;
      window.speechSynthesis.speak(u);
      return u;
    } catch {
      return null;
    }
  }, []);

  const deliver = useCallback(
    async (_id, text, speechKind) => {
      clearHideTimer();
      if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        setCaption(text);
        setKind(speechKind);
        hideTimerRef.current = window.setTimeout(() => {
          setCaption(null);
          setKind(null);
        }, speechKind === 'closing' ? 18_000 : 12_000);
        return;
      }

      setCaption(text);
      setKind(speechKind);
      const speakText = speechKind === 'closing' ? CLOSING_SPEECH : text;
      const u = await speakAloud(speakText);

      const scheduleHide = (ms) => {
        clearHideTimer();
        hideTimerRef.current = window.setTimeout(() => {
          setCaption(null);
          setKind(null);
        }, ms);
      };

      const afterEndMs = speechKind === 'closing' ? 7000 : 5000;
      const fallbackMs = speechKind === 'closing' ? 20_000 : 14_000;

      if (u && typeof u === 'object' && 'onend' in u) {
        u.onend = () => scheduleHide(afterEndMs);
        u.onerror = () => scheduleHide(speechKind === 'closing' ? 12_000 : 8000);
      } else {
        scheduleHide(fallbackMs);
      }
    },
    [clearHideTimer, speakAloud],
  );

  useEffect(() => {
    if (!canUseSpeech()) return undefined;
    const sync = () => window.speechSynthesis.getVoices();
    sync();
    window.speechSynthesis.onvoiceschanged = sync;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      clearHideTimer();
      if (canUseSpeech()) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
      }
    };
  }, [clearHideTimer]);

  useEffect(() => {
    const z = gpulse?.zone;
    const becameHot = z === 'hot' && prevZoneRef.current !== 'hot';
    prevZoneRef.current = z;
    if (!becameHot) return;
    if (!canSpeak('hot', COOLDOWN_MS.hot)) return;
    welcomeDoneRef.current = true;
    deliver('hot', MESSAGES.hot, 'hot');
  }, [gpulse?.zone, canSpeak, deliver]);

  useEffect(() => {
    const p = normalizePlan(userPlan);
    if (p !== 'SIGNAL') return;
    if (activeView !== 'access') return;
    if (!canSpeak('signal_access', COOLDOWN_MS.signal_access)) return;
    welcomeDoneRef.current = true;
    deliver('signal', MESSAGES.signal, 'signal');
  }, [activeView, userPlan, canSpeak, deliver]);

  useEffect(() => {
    if (welcomeScheduledRef.current) return;
    welcomeScheduledRef.current = true;
    const id = window.setTimeout(() => {
      if (welcomeDoneRef.current) return;
      const g = gpulseRef.current;
      const p = normalizePlan(userPlanRef.current);
      const v = activeViewRef.current;
      if (g?.zone === 'hot') return;
      if (p === 'SIGNAL' && v === 'access') return;
      if (isUpgradeRoute(v, accessSubViewRef.current)) return;
      welcomeDoneRef.current = true;
      deliver('welcome', MESSAGES.welcome, 'welcome');
    }, 2800);
    return () => window.clearTimeout(id);
  }, [deliver]);

  useEffect(() => {
    if (!isUpgradeRoute(activeView, accessSubView)) {
      return undefined;
    }
    if (upgradeClosingPlayedSessionRef.current) {
      return undefined;
    }

    const dwellMs = randomUpgradeDwellMs();
    const dwellTimer = window.setTimeout(() => {
      if (upgradeClosingPlayedSessionRef.current) return;
      if (!isUpgradeRoute(activeViewRef.current, accessSubViewRef.current)) return;
      if (!canSpeak('closing_upgrade', COOLDOWN_MS.closing_upgrade)) return;
      upgradeClosingPlayedSessionRef.current = true;
      welcomeDoneRef.current = true;
      deliver('closing_upgrade', CLOSING_DISPLAY, 'closing');
    }, dwellMs);
    return () => window.clearTimeout(dwellTimer);
  }, [activeView, accessSubView, canSpeak, deliver]);

  const rootClass =
    anchor === 'main'
      ? 'pointer-events-none absolute bottom-3 right-3 z-[42] max-w-[min(20rem,calc(100%-1rem))] sm:bottom-4 sm:right-4'
      : 'pointer-events-none fixed bottom-24 right-4 z-[45] max-w-[min(22rem,calc(100vw-2rem))] md:bottom-8 md:right-8';

  const chipClass = isLightMode
    ? 'border-slate-200/90 bg-white/85 shadow-[0_2px_20px_rgba(15,23,42,0.08)]'
    : 'border-white/12 bg-black/50 shadow-[0_0_28px_rgba(0,0,0,0.45)]';

  const chipLabel = isLightMode ? 'text-slate-500' : 'text-white/55';

  return (
    <div className={rootClass} aria-live="polite">
      <div className="flex flex-col items-end gap-2">
        <AnimatePresence mode="wait">
          {caption ? (
            <motion.div
              key={String(kind)}
              role="status"
              initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
              transition={{
                duration: kind === 'closing' ? 0.55 : 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`pointer-events-none max-w-full rounded-2xl border px-3.5 py-2.5 text-left shadow-[0_0_36px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:px-4 sm:py-3 ${
                kind === 'hot'
                  ? isLightMode
                    ? 'border-red-200 bg-red-50/95 text-red-950'
                    : 'border-red-500/25 bg-red-950/40 text-red-50/95'
                  : kind === 'signal'
                    ? isLightMode
                      ? 'border-amber-200 bg-amber-50/95 text-amber-950'
                      : 'border-amber-500/25 bg-amber-950/35 text-amber-50/90'
                    : kind === 'closing'
                      ? isLightMode
                        ? 'border-violet-200 bg-violet-50/95 text-violet-950'
                        : 'border-violet-500/30 bg-violet-950/25 text-white/[0.92]'
                      : isLightMode
                        ? 'border-slate-200 bg-white/90 text-slate-800'
                        : 'border-white/12 bg-black/60 text-white/88'
              }`}
            >
              <p
                className={`text-[9px] font-semibold uppercase tracking-[0.28em] ${isLightMode ? 'text-slate-400' : 'text-white/40'}`}
              >
                G_Pulse
              </p>
              <p
                className={`mt-1.5 text-[11px] font-light leading-relaxed tracking-[-0.01em] sm:text-[12px] ${kind === 'closing' ? 'whitespace-pre-line' : ''}`}
              >
                {caption}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Presencia constante: indicador + etiqueta (no captura eventos) */}
        <div className={`pointer-events-none flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-md ${chipClass}`}>
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full ${isLightMode ? 'bg-cyan-500/35' : 'bg-cyan-400/45'}`}
              aria-hidden
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.65)] ${isLightMode ? 'bg-cyan-500' : 'bg-cyan-400'}`}
              aria-hidden
            />
          </span>
          <span className={`text-[9px] font-black uppercase tracking-[0.22em] ${chipLabel}`}>G_Pulse</span>
        </div>
      </div>
    </div>
  );
}
