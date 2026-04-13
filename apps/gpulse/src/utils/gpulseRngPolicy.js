/**
 * RNG policy for G-Pulse: in real provider execution mode (`VITE_GPULSE_REAL_PROVIDER_EXECUTION=1`),
 * no `Math.random` may influence decisions, outcomes, or state flow. Use deterministic PRNGs or
 * `crypto.randomUUID` / `getRandomValues` for opaque IDs.
 */

const REAL =
  String(import.meta.env.VITE_GPULSE_REAL_PROVIDER_EXECUTION ?? '1').trim() === '1';

const AUDIT =
  String(import.meta.env.VITE_GPULSE_RNG_AUDIT ?? '0').trim() === '1';

/** @returns {boolean} */
export function isGpulseRealProviderExecution() {
  return REAL;
}

/**
 * Validation: `VITE_GPULSE_RNG_AUDIT=1` logs every call; otherwise logs when real provider mode and `allowed` is false.
 * @param {string} location
 * @param {boolean} allowed — true when legacy/mock Math.random is permitted (`VITE_GPULSE_REAL_PROVIDER_EXECUTION=0`)
 */
export function rngCheck(location, allowed) {
  if (AUDIT) {
    console.log('🔍 RNG CHECK', { location, allowed });
    return;
  }
  if (REAL && !allowed) {
    console.log('🔍 RNG CHECK', { location, allowed });
  }
}

let _mulberrySeed = 0xfeedface;

/** Deterministic PRNG in [0,1); no Math.random. */
export function createDeterministic01(seed = _mulberrySeed) {
  let a = (Number(seed) ^ 0x6d2b79f5) >>> 0;
  return function deterministic01() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _singletonEngineRng = null;

/**
 * Default RNG for `domain/engine` sim paths: deterministic when real provider is on (legacy scheduler
 * is skipped in App, but callers must not pass Math.random).
 * @returns {() => number}
 */
export function getDefaultEngineRng() {
  if (_singletonEngineRng) return _singletonEngineRng;
  if (REAL) {
    _singletonEngineRng = createDeterministic01(0x9e3779b9);
  } else {
    _singletonEngineRng = Math.random;
  }
  return _singletonEngineRng;
}

let _simOutcomeRng = null;

/** RNG for `gpulseOutcomeEngine` simulation (never Math.random when real provider). */
export function getSimOutcomeRng() {
  if (_simOutcomeRng) return _simOutcomeRng;
  if (REAL) {
    _simOutcomeRng = createDeterministic01(0xdeadbeef);
  } else {
    _simOutcomeRng = Math.random;
  }
  return _simOutcomeRng;
}

let _opaqueSeq = 0;

/**
 * Opaque id without Math.random: prefers `crypto.randomUUID`, else monotonic counter.
 * @param {string} [prefix]
 * @returns {string}
 */
export function nextOpaqueId(prefix = 'id') {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch (e) {
    /* ignore */
  }
  _opaqueSeq += 1;
  return `${prefix}-${Date.now()}-${_opaqueSeq}`;
}

/** Deterministic 64-char hex (no Math.random) for environments without WebCrypto. */
export function fallbackDeterministicTxHex(seed = Date.now()) {
  const s = String(seed);
  let hex = '';
  for (let i = 0; i < 64; i++) {
    const c = (s.charCodeAt(i % s.length) + i * 17) % 16;
    hex += c.toString(16);
  }
  return hex;
}
