/**
 * Authoritative execution snapshot (simulated). Replace with persistence / core-api later.
 */
export type DecisionResult = 'win' | 'loss' | 'neutral';

export type DecisionHistoryEntry = {
  action: string;
  confidence: number;
  result: DecisionResult;
  timestamp: number;
};

export type PerformanceTrend = 'improving' | 'declining' | 'stable';

export const executionState = {
  engine: 'idle' as 'idle' | 'running' | 'paused',
  strategy: 'balanced' as 'speed' | 'balanced' | 'protection',
  safeMode: false,
  /** User-enabled autonomous loop (server is source of truth). */
  autoMode: false,
  /** Model confidence 0–1 (updated by EMA learning from simulated outcomes). */
  modelConfidence: 0.82,
  /** Recent decisions with simulated outcomes (bounded). */
  decisionHistory: [] as DecisionHistoryEntry[],
  performanceTrend: 'stable' as PerformanceTrend,
  learningState: 'idle' as string,
};
