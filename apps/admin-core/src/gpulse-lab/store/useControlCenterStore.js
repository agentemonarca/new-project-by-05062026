import { create } from 'zustand';
import { buildDealSequence } from '../utils/replaySnapshotHelpers.js';

/** @typedef {{ uiStatus: string, delayMsLab: number | null, at: number, labTimeout: boolean, resynced: boolean }} CycleMini */

function createEmptyMesaStats() {
  return {
    totalCycles: 0,
    incompleteCycles: 0,
    timeoutCount: 0,
    resyncCount: 0,
    delaySum: 0,
    delaySamples: 0,
    avgDelayMs: null,
    lastIssue: null,
    last10: /** @type {CycleMini[]} */ ([]),
    prevScore: null,
    score: 100,
    trend: null,
  };
}

/**
 * @param {typeof createEmptyMesaStats extends () => infer R ? R : never} s
 */
function computeProviderScore(s) {
  let score = 100;
  score -= 20 * s.timeoutCount;
  score -= 5 * s.resyncCount;
  if (s.avgDelayMs != null && s.avgDelayMs > 35_000) score -= 10;
  const completeness =
    s.totalCycles > 0 ? Math.max(0, 1 - s.incompleteCycles / s.totalCycles) : 1;
  if (completeness < 1) score -= 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * @param {number} rate01
 */
export function classifyHeatmapLevel(rate01) {
  if (!Number.isFinite(rate01) || rate01 < 0) return 'LOW';
  if (rate01 < 0.05) return 'LOW';
  if (rate01 <= 0.15) return 'MEDIUM';
  return 'HIGH';
}

/**
 * @param {number} score
 */
export function classifyProviderLabel(score) {
  if (score >= 90) return { emoji: '🟢', label: 'Excelente' };
  if (score >= 70) return { emoji: '🟡', label: 'Estable' };
  return { emoji: '🔴', label: 'Inestable' };
}

/**
 * @param {unknown} v
 */
function safeClone(v) {
  if (v == null) return null;
  try {
    if (typeof structuredClone === 'function') return structuredClone(v);
  } catch {
    /* fall through */
  }
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return null;
  }
}

export const useControlCenterStore = create((set, get) => ({
  /** @type {Record<string, ReturnType<typeof createEmptyMesaStats>>} */
  perMesa: {},
  /** @type {Record<string, unknown[]>} last N replay payloads per mesa */
  replayHistoryByMesa: {},

  reset: () => set({ perMesa: {}, replayHistoryByMesa: {} }),

  /**
   * @param {string} mesaKey
   * @param {Record<string, unknown>} meta
   * @param {Record<string, unknown>} cycle
   * @param {Record<string, unknown> | null | undefined} labRow
   */
  ingestCycle(mesaKey, meta, cycle, labRow) {
    const id = String(mesaKey ?? '').trim();
    if (!id) return;

    const uiStatus = String(cycle.uiStatus ?? '');
    const success = uiStatus === 'COMPLETE' || uiStatus === 'COMPLETE_RESYNC';
    const labTimeout = Boolean(cycle.labTimeout);
    const resynced = Boolean(meta.resyncApplied);
    const delayMsLab = typeof cycle.delayMsLab === 'number' ? cycle.delayMsLab : null;

    let issueLine = null;
    if (!success) issueLine = uiStatus || 'incomplete';
    if (labTimeout) issueLine = 'labTimeout';

    set((state) => {
      const prev = state.perMesa[id] ?? createEmptyMesaStats();
      const totalCycles = prev.totalCycles + 1;
      const incompleteCycles = prev.incompleteCycles + (success ? 0 : 1);
      const timeoutCount = prev.timeoutCount + (labTimeout ? 1 : 0);
      const resyncCount = prev.resyncCount + (resynced ? 1 : 0);

      let delaySum = prev.delaySum;
      let delaySamples = prev.delaySamples;
      if (delayMsLab != null && delayMsLab >= 0 && delayMsLab < 3600_000) {
        delaySum += delayMsLab;
        delaySamples += 1;
      }
      const avgDelayMs = delaySamples > 0 ? Math.round(delaySum / delaySamples) : null;

      const mini = {
        uiStatus,
        delayMsLab,
        at: typeof cycle.labEmittedAt === 'number' ? cycle.labEmittedAt : Date.now(),
        labTimeout,
        resynced,
      };
      const last10 = [...prev.last10, mini].slice(-10);

      const nextStats = {
        ...prev,
        totalCycles,
        incompleteCycles,
        timeoutCount,
        resyncCount,
        delaySum,
        delaySamples,
        avgDelayMs,
        lastIssue: success && !labTimeout ? null : issueLine ?? prev.lastIssue,
        last10,
      };

      const score = computeProviderScore(nextStats);
      const prevScore = typeof prev.score === 'number' ? prev.score : 100;
      const trend =
        prevScore !== score ? (score > prevScore ? 'up' : 'down') : prev.trend ?? null;
      nextStats.prevScore = prevScore;
      nextStats.score = score;
      nextStats.trend = trend;

      const hist = state.replayHistoryByMesa[id] ?? [];
      const betEv = Array.isArray(labRow?.currentCycleHistory)
        ? [...labRow.currentCycleHistory].reverse().find((e) => e && e.type === 'BETTING')
        : null;
      const sigEv = Array.isArray(labRow?.currentCycleHistory)
        ? [...labRow.currentCycleHistory].reverse().find((e) => e && e.type === 'SIGNAL')
        : null;
      const resEv = Array.isArray(labRow?.currentCycleHistory)
        ? [...labRow.currentCycleHistory].reverse().find((e) => e && e.type === 'RESULT')
        : null;

      const mi = labRow?.supplierMesaInfoFull;
      const miRec = mi != null && typeof mi === 'object' && !Array.isArray(mi) ? /** @type {Record<string, unknown>} */ (mi) : null;
      const pc = miRec ? miRec.cartas_player ?? miRec.player_cards : null;
      const pb = miRec ? miRec.cartas_banker ?? miRec.banker_cards : null;
      const pArr = Array.isArray(pc) ? pc : [];
      const bArr = Array.isArray(pb) ? pb : [];
      const steps = buildDealSequence(pArr, bArr).map((s) => ({ side: s.side, idx: s.idx }));

      const snapshot = {
        id: cycle.id,
        mesaId: id,
        round: meta.round != null ? String(meta.round) : null,
        correlationKey: meta.correlationKey != null ? String(meta.correlationKey) : null,
        labEmittedAt: cycle.labEmittedAt,
        recommendation: labRow?.recommendation ?? meta.recommendation ?? null,
        ganador: cycle.resultadoLab ?? labRow?.ganador ?? null,
        signalTs: typeof sigEv?.timestamp === 'number' ? sigEv.timestamp : cycle.signalAcceptedAt ?? null,
        bettingEndsAt: typeof betEv?.until === 'number' ? betEv.until : null,
        resultTs: typeof resEv?.timestamp === 'number' ? resEv.timestamp : cycle.resultReceivedAt ?? null,
        supplierLastRawSignal: safeClone(labRow?.supplierLastRawSignal),
        supplierLastRawResult: safeClone(labRow?.supplierLastRawResult),
        supplierMesaInfoFull: safeClone(labRow?.supplierMesaInfoFull),
        currentCycleHistory: safeClone(labRow?.currentCycleHistory),
        cycleMeta: safeClone(cycle.cycleMeta),
        uiStatus,
        /** Secuencia ordenada P1→B1→… para replay / forensics */
        steps,
      };

      return {
        perMesa: { ...state.perMesa, [id]: nextStats },
        replayHistoryByMesa: { ...state.replayHistoryByMesa, [id]: [...hist, snapshot].slice(-20) },
      };
    });
  },

  /**
   * @param {string | null | undefined} mesaId
   */
  getLatestReplay(mesaId) {
    const id = mesaId != null && String(mesaId).trim() !== '' ? String(mesaId).trim() : '';
    if (!id) return null;
    const h = get().replayHistoryByMesa[id];
    if (!Array.isArray(h) || h.length === 0) return null;
    return h[h.length - 1];
  },
}));
