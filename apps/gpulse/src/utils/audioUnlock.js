/**
 * Centralized AudioContext unlock for Tone.js (and coordinated “audio ready” for UX).
 * Uses `window.Tone` — same instance as SoundEngine (CDN) — never a second bundled context.
 */

let isUnlocked = false;
let inFlight = null;

function getWindowTone() {
  if (typeof window === 'undefined') return null;
  return window.Tone ?? null;
}

/**
 * Wait briefly for CDN Tone to attach (script is async in App).
 * @param {number} [maxMs]
 */
async function resolveTone(maxMs = 5000) {
  const Tone = getWindowTone();
  if (Tone) return Tone;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  while ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 < maxMs) {
    await new Promise((r) => setTimeout(r, 90));
    const t = getWindowTone();
    if (t) return t;
  }
  return getWindowTone();
}

async function runUnlock() {
  try {
    const Tone = await resolveTone();
    if (!Tone || typeof Tone.start !== 'function') {
      console.warn('Audio unlock failed: Tone.js not available');
      return false;
    }
    await Tone.start();
    isUnlocked = true;
    console.log('🔊 Audio unlocked successfully');
    console.log('🔊 Audio system ready');
    return true;
  } catch (error) {
    console.warn('Audio unlock failed:', error);
    return false;
  } finally {
    inFlight = null;
  }
}

/**
 * Resume AudioContext after a user gesture. Safe to call repeatedly; coalesces concurrent calls.
 * @returns {Promise<boolean>}
 */
export async function unlockAudio() {
  if (isUnlocked) return true;
  if (!inFlight) {
    inFlight = runUnlock();
  }
  return inFlight;
}

export function isAudioUnlocked() {
  return isUnlocked;
}
