/**
 * Centralized AudioContext unlock for Tone.js (single CDN instance; no second bundled context).
 */

let isUnlocked = false;
let inFlight = null;

const unlockListeners = new Set();
let unlockEpoch = 0;

function notifyUnlockSubscribers() {
  unlockEpoch += 1;
  unlockListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/** @param {() => void} listener */
export function subscribeAudioUnlock(listener) {
  unlockListeners.add(listener);
  return () => unlockListeners.delete(listener);
}

export function getAudioUnlockEpoch() {
  return unlockEpoch;
}

function getWindowTone() {
  if (typeof window === 'undefined') return null;
  return window.Tone ?? null;
}

/**
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
      return false;
    }
    await Tone.start();
    if (!isUnlocked) {
      isUnlocked = true;
      notifyUnlockSubscribers();
    }
    return true;
  } catch {
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

/**
 * Idempotent: call from click handlers to ensure the audio graph can start after unlockAudio().
 * @returns {Promise<boolean>}
 */
export async function resumeAudioFromUserGesture() {
  return unlockAudio();
}
