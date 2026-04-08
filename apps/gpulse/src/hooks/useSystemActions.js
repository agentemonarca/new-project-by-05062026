import { useMemo, useRef } from 'react';
import { useGpulseSystem } from '../context/GpulseContext.jsx';
import { computeSystemMode } from '../system/decisionEngine.js';
import { computeRecentTxStats } from '../system/txStats.js';
import { predictSystemStress } from '../system/systemStressPrediction.js';
import { computeSystemConfidence } from '../system/systemConfidence.js';
import { getSharedTrendBuffer } from '../system/systemTrendBuffer.js';
import { getAdaptiveQueueThresholds } from '../system/systemFeedbackLoop.js';
import {
  getModelConfidence,
  buildDecisionReasons,
  computeStrategyConfidence,
} from '../system/systemMetaConfidence.js';

function sameAvgConfirmation(a, b) {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  return a === b;
}

/**
 * Adaptive config from the decision engine + light stress prediction.
 * Non-blocking; safe to call from any component under GpulseProvider.
 *
 * @param {object} [opts]
 * @param {Array<object>} [opts.transactions] — wallet timeline rows (same shape as useSystemMode)
 * @param {number} [opts.queueWaiting] — BullMQ waiting count (preferred)
 * @param {number} [opts.queueBacklog] — alias for queueWaiting
 */
export function useSystemActions({ transactions = [], queueBacklog = 0, queueWaiting } = {}) {
  const { systemHealth } = useGpulseSystem();
  const lastTrendSampleRef = useRef(null);

  return useMemo(() => {
    const safeTx = Array.isArray(transactions) ? transactions : [];
    const recentTxStats = computeRecentTxStats(safeTx);
    const qw = Number(queueWaiting ?? queueBacklog) || 0;

    const confidence = computeSystemConfidence({
      queueWaiting: qw,
      avgConfirmationTime: recentTxStats.avgConfirmationTime,
      failureRate: recentTxStats.failureRate,
      systemHealth,
    });

    const sample = {
      queueWaiting: qw,
      failureRate: recentTxStats.failureRate,
      avgConfirmationTime: recentTxStats.avgConfirmationTime,
    };
    const prev = lastTrendSampleRef.current;
    const unchanged =
      prev &&
      prev.queueWaiting === sample.queueWaiting &&
      prev.failureRate === sample.failureRate &&
      sameAvgConfirmation(prev.avgConfirmationTime, sample.avgConfirmationTime);

    const trendBuf = getSharedTrendBuffer();
    if (!unchanged) {
      lastTrendSampleRef.current = sample;
      trendBuf.push(sample);
    }
    const trend = trendBuf.getTrend();

    const { mode, actions, confidence: confOut } = computeSystemMode({
      systemHealth,
      recentTxStats,
      queueWaiting: qw,
      confidence,
    });

    const stressHint = predictSystemStress({
      recentFailures: recentTxStats.recentFailures,
      avgConfirmationDelayMs: recentTxStats.avgConfirmationTime,
      queueWaiting: qw,
      failureRate: recentTxStats.failureRate,
      congestionProbability: confidence.congestionProbability,
      trend,
    });

    const modelConfidence = getModelConfidence();
    const decisionReasons = buildDecisionReasons({
      queueWaiting: qw,
      avgConfirmationTime: recentTxStats.avgConfirmationTime,
      failureRate: recentTxStats.failureRate,
      trend,
      systemHealth,
      thresholds: getAdaptiveQueueThresholds(),
      stressHint,
      systemMode: mode,
    });
    const strategyConfidencePct = computeStrategyConfidence(modelConfidence, confOut);

    return {
      mode,
      actions,
      stressHint,
      recentTxStats,
      confidence: confOut,
      trend,
      modelConfidence,
      modelConfidencePct: Math.round(modelConfidence * 1000) / 10,
      decisionReasons,
      strategyConfidencePct,
    };
  }, [systemHealth, transactions, queueBacklog, queueWaiting]);
}
