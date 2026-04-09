import { create } from 'zustand';

/**
 * Operational counters for GPulse Lab (observability only).
 */
export const useMetricsStore = create((set) => ({
  totalSignalsReceived: 0,
  totalResultsReceived: 0,
  cyclesCompleted: 0,
  errorsDetected: 0,
  resyncCount: 0,
  missingResultCount: 0,
  /** Rolling average of delayMsLab for COMPLETE cycles (ms). */
  avgDelayMsLab: null,
  _delaySum: 0,
  _delayCount: 0,

  bumpSignal() {
    set((s) => ({ totalSignalsReceived: s.totalSignalsReceived + 1 }));
  },

  bumpResult() {
    set((s) => ({ totalResultsReceived: s.totalResultsReceived + 1 }));
  },

  bumpError() {
    set((s) => ({ errorsDetected: s.errorsDetected + 1 }));
  },

  bumpResync() {
    set((s) => ({ resyncCount: s.resyncCount + 1 }));
  },

  bumpMissingResult() {
    set((s) => ({ missingResultCount: s.missingResultCount + 1 }));
  },

  /**
   * @param {'COMPLETE' | 'INCOMPLETE' | 'ERROR'} uiStatus
   * @param {number | undefined} delayMsLab
   */
  recordLabCycle(uiStatus, delayMsLab) {
    if (uiStatus !== 'COMPLETE') return;
    set((s) => {
      const base = {
        ...s,
        cyclesCompleted: s.cyclesCompleted + 1,
      };
      if (typeof delayMsLab !== 'number' || delayMsLab < 0 || delayMsLab > 3600000) {
        return base;
      }
      const c = s._delayCount + 1;
      const sum = s._delaySum + delayMsLab;
      return {
        ...base,
        _delayCount: c,
        _delaySum: sum,
        avgDelayMsLab: Math.round(sum / c),
      };
    });
  },

  reset() {
    set({
      totalSignalsReceived: 0,
      totalResultsReceived: 0,
      cyclesCompleted: 0,
      errorsDetected: 0,
      resyncCount: 0,
      missingResultCount: 0,
      avgDelayMsLab: null,
      _delaySum: 0,
      _delayCount: 0,
    });
  },
}));
