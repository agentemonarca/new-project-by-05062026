import { resyncQualityPresentation } from './resyncQuality.js';

/**
 * Builds a structured snapshot for Cycle X-Ray (GPulse Lab forensics UI).
 * @param {{
 *   validationCycles: unknown[],
 *   mesaId: string | null,
 *   labMesaRow: Record<string, unknown> | null,
 *   labLifecycle: { cycleStartedAt?: number | null, signalTs?: number | null, bettingEndsAt?: number | null, lifecycleState?: string | null },
 *   forensicSnapshot: { outside?: unknown[], inside?: unknown[] } | null,
 *   explicitCorrelationKey?: string | null,
 *   explicitCycleId?: string | null,
 * }} args
 */
export function buildCycleXRaySnapshot(args) {
  const {
    validationCycles,
    mesaId,
    labMesaRow,
    labLifecycle,
    forensicSnapshot,
    explicitCorrelationKey,
    explicitCycleId,
  } = args;

  const cycles = Array.isArray(validationCycles) ? validationCycles : [];

  /** @type {Record<string, unknown> | null} */
  let vc = null;
  if (explicitCycleId) {
    vc = /** @type {Record<string, unknown> | null} */ (cycles.find((c) => c && typeof c === 'object' && c.id === explicitCycleId) ?? null);
  }
  if (!vc && explicitCorrelationKey && String(explicitCorrelationKey).trim() !== '') {
    const ck = String(explicitCorrelationKey).trim();
    vc = /** @type {Record<string, unknown> | null} */ (cycles.find((c) => c && typeof c === 'object' && String(c.correlationKey) === ck) ?? null);
  }
  if (!vc && mesaId != null && String(mesaId).trim() !== '') {
    const m = String(mesaId).trim();
    vc = /** @type {Record<string, unknown> | null} */ (cycles.find((c) => c && typeof c === 'object' && String(c.mesa) === m) ?? null);
  }

  const row = labMesaRow && typeof labMesaRow === 'object' ? labMesaRow : null;
  const history = Array.isArray(row?.currentCycleHistory) ? row.currentCycleHistory : [];

  const sigEv = [...history].reverse().find((e) => e && e.type === 'SIGNAL');
  const betEv = [...history].reverse().find((e) => e && e.type === 'BETTING');
  const resEv = [...history].reverse().find((e) => e && e.type === 'RESULT');

  const signalTs = typeof sigEv?.timestamp === 'number' ? sigEv.timestamp : labLifecycle?.signalTs ?? labLifecycle?.cycleStartedAt ?? null;
  const bettingUntil = typeof betEv?.until === 'number' ? betEv.until : labLifecycle?.bettingEndsAt ?? (signalTs != null ? signalTs + 10_000 : null);
  const resultTsLab =
    typeof resEv?.timestamp === 'number'
      ? resEv.timestamp
      : typeof vc?.resultReceivedAt === 'number'
        ? vc.resultReceivedAt
        : row?.intelResultTs != null && typeof row.intelResultTs === 'number'
          ? row.intelResultTs
          : null;

  const totalDelayMs =
    signalTs != null && resultTsLab != null && resultTsLab >= signalTs ? resultTsLab - signalTs : null;

  const rec = row?.recommendation ?? null;
  const roundLab = row?.round ?? vc?.round ?? null;
  const mesaLab =
    mesaId != null && String(mesaId).trim() !== ''
      ? String(mesaId).trim()
      : vc?.mesa != null
        ? String(vc.mesa)
        : null;

  const correlationFromVc = vc?.correlationKey != null ? String(vc.correlationKey) : null;
  const signalKeyGuess =
    mesaLab != null && roundLab != null ? `${mesaLab}|${String(roundLab)}` : correlationFromVc;

  const cm = vc?.cycleMeta != null && typeof vc.cycleMeta === 'object' ? /** @type {Record<string, unknown>} */ (vc.cycleMeta) : null;
  const resyncApplied = cm?.source === 'autoResync' || cm?.source === 'recentFlag';
  const resyncQualityRaw = cm?.resyncQuality != null ? String(cm.resyncQuality).toUpperCase() : null;
  const resyncQualityPres =
    resyncApplied && resyncQualityRaw != null ? resyncQualityPresentation(resyncQualityRaw) : null;

  const resultKeyFromMeta =
    cm?.resultKeyFromPayload != null
      ? String(cm.resultKeyFromPayload)
      : cm?.syntheticSignalKey != null
        ? String(cm.syntheticSignalKey)
        : null;
  const syntheticKey = cm?.syntheticSignalKey != null ? String(cm.syntheticSignalKey) : null;
  const resolvedKey = cm?.resolvedKeyAfterMiddleware != null ? String(cm.resolvedKeyAfterMiddleware) : correlationFromVc;

  const signalKey = syntheticKey ?? signalKeyGuess ?? correlationFromVc ?? '—';
  const resultKey =
    resultKeyFromMeta ??
    (row?.round != null && mesaLab != null ? `${mesaLab}|${String(row.round)}` : correlationFromVc ?? '—');

  let correlationStatus = 'MATCH';
  let correlationLabel = '✔ MATCH';
  if (resyncApplied) {
    correlationStatus = 'RESYNC';
    correlationLabel = '⚠ RESYNC APLICADO';
  } else if (resolvedKey && signalKey !== '—' && resultKey !== '—' && signalKey === resultKey && resultKey === resolvedKey) {
    correlationStatus = 'MATCH';
    correlationLabel = '✔ MATCH';
  } else if (resolvedKey && signalKey !== '—' && resultKey !== '—' && signalKey !== resultKey && resolvedKey === signalKey) {
    correlationStatus = 'ROUND_ADJ';
    correlationLabel = '⚠ AJUSTE / REALINEACIÓN';
  } else if (resolvedKey && (signalKey !== resultKey || resultKey !== resolvedKey)) {
    correlationStatus = 'MISMATCH';
    correlationLabel = '❌ NO MATCH';
  }

  const roundMismatch =
    vc != null &&
    row?.round != null &&
    vc.round != null &&
    String(row.round) !== String(vc.round) &&
    !vc.middlewareCorrectedRound;

  const missingKey = correlationFromVc == null && signalKeyGuess == null;
  const ckMismatch =
    !resyncApplied && correlationStatus === 'MISMATCH' && signalKey !== '—' && resultKey !== '—' && signalKey !== resultKey;

  const hadSignal = Boolean(sigEv || row?.supplierSignalFull || row?.intelSignalTs);
  const hadResult = Boolean(resEv || row?.ganador != null || row?.supplierLastRawResult || vc?.resultadoLab != null);

  const correlated =
    correlationStatus === 'MATCH' ||
    correlationStatus === 'ROUND_ADJ' ||
    (resyncApplied && Boolean(resolvedKey)) ||
    vc?.uiStatus === 'COMPLETE' ||
    vc?.uiStatus === 'COMPLETE_RESYNC';

  const cycleValid =
    vc?.uiStatus === 'COMPLETE' ||
    vc?.uiStatus === 'COMPLETE_RESYNC' ||
    (resyncApplied && hadResult);

  return {
    validationCycle: vc,
    mesaId: mesaLab,
    signalSide: {
      mesa: mesaLab,
      round: roundLab,
      correlationKey: signalKey,
      recommendation: rec,
      timestamp: signalTs,
      intelSignalTs: row?.intelSignalTs ?? null,
    },
    resultSide: {
      mesa: mesaLab,
      round: row?.round ?? vc?.round ?? null,
      correlationKey: resultKey,
      ganador: row?.ganador ?? vc?.resultadoLab ?? null,
      timestamp: resultTsLab,
      intelResultTs: row?.intelResultTs ?? null,
    },
    correlation: {
      signalKey,
      resultKey,
      resolvedKey: resolvedKey ?? correlationFromVc ?? '—',
      status: correlationStatus,
      label: correlationLabel,
      flags: { roundMismatch, missingKey, differentCorrelationKey: ckMismatch },
    },
    resync: {
      applied: Boolean(resyncApplied),
      meta: cm,
      quality: resyncQualityRaw,
      qualityLine: resyncQualityPres ? `${resyncQualityPres.emoji} ${resyncQualityRaw}: ${resyncQualityPres.line}` : null,
      qualityInvestigate: resyncQualityPres?.investigate ?? null,
      narrative: resyncApplied
        ? 'RESULT llegó sin SIGNAL válido en cola → el middleware reconstruyó una señal sintética desde el resultado y cerró el ciclo con la clave resuelta.'
        : null,
    },
    timeline: {
      signalAt: signalTs,
      bettingClosedAt: bettingUntil,
      waitingLabel: 'WAITING_RESULT',
      resultAt: resultTsLab,
      labEmittedAt: typeof vc?.labEmittedAt === 'number' ? vc.labEmittedAt : null,
      totalDelayMs,
      history,
    },
    magic: {
      signalArrived: hadSignal,
      resultArrived: hadResult,
      correlated: Boolean(correlated),
      resyncApplied: Boolean(resyncApplied),
      cycleValid: Boolean(cycleValid),
    },
    forensic: forensicSnapshot,
    uiStatus: vc?.uiStatus ?? null,
  };
}
