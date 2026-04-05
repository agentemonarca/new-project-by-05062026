import { useCallback, useEffect, useRef, useState } from 'react';
import { gpulseVoice, primeGpulseVoices } from '../utils/gpulseVoice.js';

const INITIAL = 18;
const CAP = 99;
const THRESHOLDS = [25, 40, 60];
const VOICE_LINE = 'Tu lectura está mejorando.';

/**
 * Métrica de “sincronización” — engagement interno (voz) + porcentaje HUD ligado a fase (syncTarget).
 * @param {{ isPremium?: boolean, syncTarget?: number }} options
 */
export function useSynchronization(options = {}) {
  const { isPremium = false, syncTarget: syncTargetProp = 5 } = options;
  const syncTarget = Math.max(0, Math.min(100, Number(syncTargetProp) || 0));

  const [engagementPercent, setEngagementPercent] = useState(INITIAL);
  const [syncPercent, setSyncPercent] = useState(5);

  const startRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const interactionsRef = useRef(0);
  const spokenRef = useRef(new Set());

  const maybeSpeakThresholds = useCallback((next) => {
    if (!isPremium) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    for (const th of THRESHOLDS) {
      if (next >= th && !spokenRef.current.has(th)) {
        spokenRef.current.add(th);
        void gpulseVoice
          .speak(VOICE_LINE, {
            tone: 'soft',
            gender: 'female',
            style: 'intimate-intelligent',
          })
          .catch(() => {});
        break;
      }
    }
  }, [isPremium]);

  const recompute = useCallback(() => {
    const t0 = startRef.current;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const minutes = Math.max(0, (now - t0) / 60000);
    const timePart = Math.min(22, minutes * 1.15 + Math.log1p(minutes * 2) * 3.2);
    const clickPart = Math.min(35, interactionsRef.current * 1.05);
    const raw = INITIAL + timePart * 0.45 + clickPart * 0.55;
    const next = Math.min(CAP, Math.round(raw * 10) / 10);
    setEngagementPercent(next);
    return next;
  }, []);

  useEffect(() => {
    primeGpulseVoices();
    const onVoices = () => primeGpulseVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = onVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = recompute();
      maybeSpeakThresholds(next);
    }, 1800);
    return () => window.clearInterval(id);
  }, [recompute, maybeSpeakThresholds]);

  /** Animación suave del HUD hacia syncTarget (fase del motor). */
  useEffect(() => {
    const id = window.setInterval(() => {
      setSyncPercent((prev) => {
        const t = syncTarget;
        if (prev < t) return Math.min(t, prev + 1);
        if (prev > t) return Math.max(t, prev - 1);
        return prev;
      });
    }, 50);
    return () => window.clearInterval(id);
  }, [syncTarget]);

  const registerInteraction = useCallback(() => {
    interactionsRef.current += 1;
    const next = recompute();
    maybeSpeakThresholds(next);
  }, [recompute, maybeSpeakThresholds]);

  return {
    syncPercent,
    registerInteraction,
  };
}
