/**
 * Short rolling window of telemetry for deterministic trend detection.
 */

export const SYSTEM_TREND = Object.freeze({
  STABLE: 'stable',
  RISING: 'rising',
  SPIKING: 'spiking',
});

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/**
 * @param {{ maxSamples?: number }} [opts]
 */
export function createTrendBuffer({ maxSamples = 16 } = {}) {
  /** @type {Array<{ q: number, f: number, at: number }>} */
  const samples = [];

  return {
    /**
     * @param {object} s
     * @param {number} s.queueWaiting
     * @param {number} s.failureRate
     * @param {number} s.avgConfirmationTime
     */
    push(s) {
      const q = Math.max(0, Number(s.queueWaiting) || 0);
      const f = clamp01(Number(s.failureRate));
      const t = Number(s.avgConfirmationTime);
      const at = Number.isFinite(t) ? t : NaN;
      samples.push({ q, f, at });
      while (samples.length > maxSamples) samples.shift();
    },

    /** @returns {'stable' | 'rising' | 'spiking'} */
    getTrend() {
      const n = samples.length;
      if (n < 4) return SYSTEM_TREND.STABLE;

      const mid = Math.floor(n / 2);
      const older = samples.slice(0, mid);
      const newer = samples.slice(mid);

      const avgQ = (arr) => arr.reduce((a, x) => a + x.q, 0) / arr.length;
      const avgF = (arr) => arr.reduce((a, x) => a + x.f, 0) / arr.length;

      const dq = avgQ(newer) - avgQ(older);
      const df = avgF(newer) - avgF(older);

      const finite = (arr) => arr.filter((x) => Number.isFinite(x.at));
      const oF = finite(older);
      const nF = finite(newer);
      let dAt = 0;
      if (oF.length && nF.length) {
        const mOld = oF.reduce((a, x) => a + x.at, 0) / oF.length;
        const mNew = nF.reduce((a, x) => a + x.at, 0) / nF.length;
        dAt = mNew - mOld;
      }

      if (dq >= 8 || df >= 0.12 || dAt >= 25_000) return SYSTEM_TREND.SPIKING;
      if (dq >= 3 || df >= 0.04 || dAt >= 8000) return SYSTEM_TREND.RISING;
      return SYSTEM_TREND.STABLE;
    },

    clear() {
      samples.length = 0;
    },
  };
}

/** One shared buffer per tab so Wallet + TrustPulse see the same trend. */
let sharedTrendBuffer = null;

export function getSharedTrendBuffer() {
  if (!sharedTrendBuffer) sharedTrendBuffer = createTrendBuffer({ maxSamples: 16 });
  return sharedTrendBuffer;
}
