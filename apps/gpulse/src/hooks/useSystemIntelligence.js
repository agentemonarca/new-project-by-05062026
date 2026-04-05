import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getFeedbackState,
  getAdaptiveQueueThresholds,
  getAdaptiveCongestionWeights,
  getExecutionStrategy,
  getAutonomousExecutionStrategy,
  getWeightChangeHistory,
  getThresholdChangeHistory,
  getTrendHistory,
  getPredictionErrorSummary,
  getPredictionErrorHistory,
  getDecisionTraceHistory,
  subscribeIntelligenceUpdates,
} from '../system/systemFeedbackLoop.js';

/**
 * Aggregated read model for the System Intelligence panel (polling + control-plane events).
 */
export function useSystemIntelligenceSnapshot() {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const id = window.setInterval(refresh, 1600);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => subscribeIntelligenceUpdates(refresh), [refresh]);

  return useMemo(
    () => ({
      feedback: getFeedbackState(),
      effectiveWeights: getAdaptiveCongestionWeights(),
      thresholds: getAdaptiveQueueThresholds(),
      executionStrategy: getExecutionStrategy(),
      autonomousStrategy: getAutonomousExecutionStrategy(),
      weightHistory: getWeightChangeHistory(),
      thresholdHistory: getThresholdChangeHistory(),
      trendHistory: getTrendHistory(),
      predictionSummary: getPredictionErrorSummary(),
      predictionRows: getPredictionErrorHistory()
        .slice(-14)
        .reverse(),
      decisionTrace: getDecisionTraceHistory()
        .slice(-8)
        .reverse(),
    }),
    [tick],
  );
}
