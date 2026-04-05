/**
 * G_Pulse voice facade — Web Speech API with tunable emotional parameters.
 * Mirrors: speak(text, { tone, gender, style })
 */

import { unlockAudio } from './audioUnlock.js';

function canUseSpeech() {
  return typeof window !== 'undefined' && window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined';
}

function pickVoice(gender) {
  const voices = window.speechSynthesis.getVoices();
  if (!voices?.length) return null;

  const es = voices.filter((v) => String(v.lang || '').toLowerCase().includes('es'));
  const pool = es.length ? es : voices;

  if (gender === 'female') {
    const byName = pool.find((v) => {
      const n = `${v.name} ${v.voiceURI || ''}`.toLowerCase();
      return (
        n.includes('female') ||
        n.includes('mujer') ||
        n.includes('españa') ||
        n.includes('monica') ||
        n.includes('paulina') ||
        n.includes('soledad') ||
        n.includes('helena')
      );
    });
    if (byName) return byName;
    const zira = pool.find((v) => v.name.toLowerCase().includes('zira'));
    if (zira) return zira;
    return pool[0];
  }

  return pool[0];
}

/**
 * @param {'soft' | string} tone
 */
function toneToRatePitch(tone) {
  if (tone === 'soft') {
    return { rate: 0.82, pitch: 0.96 };
  }
  return { rate: 0.9, pitch: 1 };
}

export const gpulseVoice = {
  /**
   * @param {string} text
   * @param {{
   *   tone?: string,
   *   gender?: 'female' | 'male',
   *   style?: string,
   * }} [options]
   * @returns {Promise<SpeechSynthesisUtterance | null>}
   */
  async speak(text, options = {}) {
    if (!canUseSpeech()) return null;
    await unlockAudio();
    const { tone = 'soft', gender = 'female', style: _style = 'intimate-intelligent' } = options;
    void _style;

    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES';
      const { rate, pitch } = toneToRatePitch(tone);
      u.rate = rate;
      u.pitch = pitch;
      const voice = pickVoice(gender);
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
      return u;
    } catch {
      return null;
    }
  },
};

export function primeGpulseVoices() {
  if (!canUseSpeech()) return;
  try {
    window.speechSynthesis.getVoices();
  } catch {
    /* ignore */
  }
}
