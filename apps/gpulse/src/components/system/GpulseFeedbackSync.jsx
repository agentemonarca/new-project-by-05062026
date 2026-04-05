import React, { useEffect, useRef } from 'react';
import { useGpulseSystem } from '../../context/GpulseContext.jsx';
import { computeRecentTxStats } from '../../system/txStats.js';
import { computeConfidenceDecomposition } from '../../system/systemConfidence.js';
import { predictSystemStress } from '../../system/systemStressPrediction.js';
import { getSharedTrendBuffer } from '../../system/systemTrendBuffer.js';
import {
  ingestSettledTransactionsForFeedback,
  pushFeedbackTelemetrySample,
} from '../../system/systemFeedbackLoop.js';

const TELEMETRY_MS = 4500;

/**
 * Bridges wallet + health telemetry into the self-optimizing feedback loop (no UI).
 * Records settled txs, pushes smoothed prediction snapshots for attribution.
 */
export default function GpulseFeedbackSync({ transactions = [], queueWaiting = 0 }) {
  const { systemHealth } = useGpulseSystem();
  const txRef = useRef(transactions);
  const qwRef = useRef(queueWaiting);
  const healthRef = useRef(systemHealth);
  const seenIdsRef = useRef(new Set());

  txRef.current = transactions;
  qwRef.current = queueWaiting;
  healthRef.current = systemHealth;

  useEffect(() => {
    ingestSettledTransactionsForFeedback(transactions, seenIdsRef.current);
  }, [transactions]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const id = window.setInterval(() => {
      const stats = computeRecentTxStats(txRef.current);
      const qw = Number(qwRef.current) || 0;
      const health = healthRef.current;
      const c = computeConfidenceDecomposition({
        queueWaiting: qw,
        avgConfirmationTime: stats.avgConfirmationTime,
        failureRate: stats.failureRate,
        systemHealth: health,
      });
      const trend = getSharedTrendBuffer().getTrend();
      const stressHint = predictSystemStress({
        recentFailures: stats.recentFailures,
        avgConfirmationDelayMs: stats.avgConfirmationTime,
        queueWaiting: qw,
        failureRate: stats.failureRate,
        congestionProbability: c.congestionProbability,
        trend,
      });
      pushFeedbackTelemetrySample({
        congestionProbability: c.congestionProbability,
        queueWaiting: qw,
        stressHint,
        trend,
        normQ: c.normQ,
        normD: c.normD,
        fr: c.fr,
      });
    }, TELEMETRY_MS);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
