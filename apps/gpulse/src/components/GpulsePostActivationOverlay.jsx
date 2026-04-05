import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { gpulseVoice } from '../utils/gpulseVoice.js';

const DISPLAY_MS = 2500;
const fadeEase = [0.22, 1, 0.36, 1];

/**
 * Micro-experiencia post-activación: ancla emocional breve antes de continuar el flujo.
 */
export default function GpulsePostActivationOverlay({ show, onComplete }) {
  const voiceOnceRef = useRef(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    if (!show) {
      voiceOnceRef.current = false;
      return undefined;
    }

    const t = window.setTimeout(() => {
      completeRef.current?.();
    }, DISPLAY_MS);

    return () => window.clearTimeout(t);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    if (voiceOnceRef.current) return;
    voiceOnceRef.current = true;
    const id = window.requestAnimationFrame(() => {
      void gpulseVoice
        .speak('No todos llegan hasta aquí.', {
          tone: 'soft',
          gender: 'female',
          style: 'intimate-intelligent',
        })
        .catch(() => {});
    });
    return () => window.cancelAnimationFrame(id);
  }, [show]);

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="gpulse-post-activation"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: fadeEase }}
          className="absolute inset-0 z-[52] flex flex-col items-center justify-center overflow-hidden rounded-[inherit] bg-black/96 px-6"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_38%,rgba(139,92,246,0.28),transparent_60%),radial-gradient(ellipse_80%_55%_at_50%_72%,rgba(34,211,238,0.14),transparent_58%)]"
            aria-hidden
          />
          <motion.div
            className="pointer-events-none absolute h-44 w-44 rounded-full bg-violet-500/18 blur-3xl"
            animate={{ scale: [1, 1.06, 1], opacity: [0.4, 0.62, 0.4] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.55, ease: fadeEase }}
            className="relative max-w-sm text-center"
          >
            <p className="text-[15px] font-medium leading-relaxed tracking-[-0.02em] text-white/92">
              Tu acceso ya está activo…
            </p>
            <p className="mt-5 text-[14px] font-light leading-relaxed text-white/58">
              Pero lo que viene ahora…
              <br />
              <span className="font-medium text-white/78">es donde empieza todo.</span>
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
