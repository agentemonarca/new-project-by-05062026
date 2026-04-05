/**
 * Automatic diagnostics for engine execution.
 *
 * Pure function: no side effects, no IO.
 */

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function nowMs() {
  return Date.now();
}

function severityRank(sev) {
  return sev === 'critical' ? 3 : sev === 'warning' ? 2 : 1;
}

export function runDiagnostics({ actionLog, currentPhase, isActive, now = nowMs() }) {
  const logs = Array.isArray(actionLog) ? actionLog : [];
  const phase = String(currentPhase || '');
  const active = Boolean(isActive);

  const issues = [];

  // 1) Execution while inactive (attempted actions)
  const inactiveAttempts = logs.filter((e) => e && e.skippedInactive).slice(-5);
  if (inactiveAttempts.length > 0) {
    issues.push({
      id: 'exec_while_inactive',
      severity: 'warning',
      title: 'Engine actions while inactive',
      message: `Detected ${inactiveAttempts.length} action(s) attempted while inactive.`,
      meta: { count: inactiveAttempts.length },
    });
  }

  // 2) Unknown action types
  const unknown = logs.filter((e) => e && e.known === false);
  if (unknown.length > 0) {
    const last = unknown[unknown.length - 1];
    issues.push({
      id: 'unknown_action',
      severity: 'critical',
      title: 'Unknown engine action',
      message: `Unknown action type: ${String(last?.type || 'UNKNOWN')}`,
      meta: { lastType: last?.type, count: unknown.length },
    });
  }

  // 3) Action overflow (too many actions in short window OR buffer saturation)
  const windowMs = 5000;
  const recent = logs.filter((e) => e && Number(e.timestamp) >= now - windowMs);
  if (recent.length > 60) {
    issues.push({
      id: 'action_overflow_rate',
      severity: 'warning',
      title: 'High action rate',
      message: `High action throughput: ${recent.length} actions / ${Math.round(windowMs / 1000)}s`,
      meta: { count: recent.length, windowMs },
    });
  }
  if (logs.length >= 200) {
    const span = logs.length >= 2 ? (Number(logs[logs.length - 1].timestamp) - Number(logs[0].timestamp)) : 0;
    if (span > 0 && span < 8000) {
      issues.push({
        id: 'action_overflow_buffer',
        severity: 'warning',
        title: 'Action log overflow risk',
        message: 'Action log buffer saturated quickly (possible loop).',
        meta: { buffer: logs.length, spanMs: span },
      });
    }
  }

  // 4) Phase stuck (active + no recent phase activity beyond a generous threshold)
  // Heuristic thresholds (ms) — conservative to avoid false positives.
  const stuckThresholdByPhase = {
    ANALISIS: 10000,
    DETECCION: 7000,
    'SEÑAL': 10000,
    RESULTADO: 12000,
    REINICIO: 7000,
  };
  if (active && phase && stuckThresholdByPhase[phase]) {
    const lastInPhase = [...logs].reverse().find((e) => e && String(e.phase) === phase);
    const lastTs = Number(lastInPhase?.timestamp) || 0;
    const age = lastTs > 0 ? now - lastTs : 0;
    const threshold = stuckThresholdByPhase[phase];
    if (lastTs > 0 && age > threshold) {
      issues.push({
        id: 'phase_stuck',
        severity: 'warning',
        title: 'Phase stuck',
        message: `Phase ${phase} has no recent actions for ${Math.round(age / 1000)}s.`,
        meta: { phase, ageMs: age, thresholdMs: threshold },
      });
    }
  }

  // Sort: critical first, then warning, then info.
  issues.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  const summary = issues.length
    ? `${issues[0].severity.toUpperCase()}: ${issues[0].title}`
    : 'OK';

  return {
    ok: issues.length === 0,
    summary,
    issues,
    score: clamp(100 - issues.reduce((s, i) => s + (i.severity === 'critical' ? 50 : 20), 0), 0, 100),
  };
}

