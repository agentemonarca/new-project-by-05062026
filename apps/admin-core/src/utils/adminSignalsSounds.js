/** Control global de feedback audible (activar/desactivar aquí). */
export const soundEnabled = true;

/** @type {AudioContext | null} */
let ctxRef = null;

/** Evita crear AudioContext antes de un gesto del usuario (Chrome no muestra entonces el warning repetido). */
let unlockScheduled = false;

function ensureAudioContextAfterUserGesture() {
  if (typeof window === 'undefined' || unlockScheduled) return;
  unlockScheduled = true;
  const unlock = () => {
    if (ctxRef) {
      if (ctxRef.state === 'suspended') void ctxRef.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || /** @type {typeof AudioContext | undefined} */ (window.webkitAudioContext);
    if (!AC) return;
    ctxRef = new AC();
    if (ctxRef.state === 'suspended') void ctxRef.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
}

ensureAudioContextAfterUserGesture();

function getAudioContext() {
  return ctxRef;
}

/**
 * @param {{ frequency: number, duration: number, type?: OscillatorType, gain?: number }} p
 */
function tone({ frequency, duration, type = 'sine', gain = 0.07 }) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const t0 = ctx.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function playNewSignalSound() {
  tone({ frequency: 880, duration: 0.12, type: 'sine', gain: 0.09 });
  window.setTimeout(() => {
    tone({ frequency: 1320, duration: 0.08, type: 'sine', gain: 0.06 });
  }, 60);
}

export function playWinSound() {
  tone({ frequency: 523.25, duration: 0.1, type: 'triangle', gain: 0.08 });
  window.setTimeout(() => {
    tone({ frequency: 659.25, duration: 0.14, type: 'triangle', gain: 0.085 });
  }, 95);
  window.setTimeout(() => {
    tone({ frequency: 783.99, duration: 0.18, type: 'triangle', gain: 0.07 });
  }, 210);
}

export function playLossSound() {
  tone({ frequency: 220, duration: 0.18, type: 'sawtooth', gain: 0.055 });
  window.setTimeout(() => {
    tone({ frequency: 165, duration: 0.22, type: 'sawtooth', gain: 0.045 });
  }, 140);
}
