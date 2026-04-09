import { isSignalAuditEnabled } from './signalAuditEnv.js';
import { isCanonicalModeEnabled, isRoundTargetModeEnabled } from './canonicalFlowFlags.js';
import { buildSafeCorrelationKey } from './buildSafeCorrelationKey.js';

/**
 * @param {unknown} v
 */
function nonempty(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return !Number.isNaN(v);
  return true;
}

/**
 * Mapeo canónico + diagnóstico (capa de verdad; no sustituye normalizadores de negocio).
 *
 * @param {unknown} payload
 * @returns {{
 *   mesa: string | null,
 *   round: string | number | null,
 *   direction: string | null,
 *   algorithm: string | null,
 *   result: string | null,
 *   correlationKey: string | null,
 *   sourcePaths: Record<string, string | null>,
 *   diagnostics: { missing: string[], conflicts: string[], warnings: string[] },
 *   sourceUsed: 'data.data.signal' | 'data.signal' | 'flat' | 'unknown',
 * }}
 */
export function extractCanonicalFields(payload) {
  /** @type {{ missing: string[], conflicts: string[], warnings: string[] }} */
  const diagnostics = { missing: [], conflicts: [], warnings: [] };

  /** @type {Record<string, string | null>} */
  const sourcePaths = {
    mesa: null,
    round: null,
    direction: null,
    algorithm: null,
    result: null,
    correlationKey: null,
  };

  const root =
    payload != null && typeof payload === 'object' && !Array.isArray(payload)
      ? /** @type {Record<string, unknown>} */ (payload)
      : null;

  let sourceUsed = /** @type {'data.data.signal' | 'data.signal' | 'flat' | 'unknown'} */ ('unknown');

  if (!root) {
    diagnostics.missing.push('payload');
    return {
      mesa: null,
      round: null,
      direction: null,
      algorithm: null,
      result: null,
      correlationKey: null,
      sourcePaths,
      diagnostics,
      sourceUsed,
    };
  }

  const d =
    root.data != null && typeof root.data === 'object' && !Array.isArray(root.data)
      ? /** @type {Record<string, unknown>} */ (root.data)
      : null;
  const d2 =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;

  const sig2 =
    d2?.signal != null && typeof d2.signal === 'object' && !Array.isArray(d2.signal)
      ? /** @type {Record<string, unknown>} */ (d2.signal)
      : null;
  const sig1 =
    d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
      ? /** @type {Record<string, unknown>} */ (d.signal)
      : null;

  if (sig2) sourceUsed = 'data.data.signal';
  else if (sig1) sourceUsed = 'data.signal';
  else sourceUsed = 'flat';

  const resultsBlock =
    d2?.results != null && typeof d2.results === 'object' && !Array.isArray(d2.results)
      ? /** @type {Record<string, unknown>} */ (d2.results)
      : null;
  const res =
    resultsBlock?.mesa_info != null && typeof resultsBlock.mesa_info === 'object' && !Array.isArray(resultsBlock.mesa_info)
      ? /** @type {Record<string, unknown>} */ (resultsBlock.mesa_info)
      : null;

  const resEv =
    res?.data_evento != null && typeof res.data_evento === 'object' && !Array.isArray(res.data_evento)
      ? /** @type {Record<string, unknown>} */ (res.data_evento)
      : res?.data_event != null && typeof res.data_event === 'object' && !Array.isArray(res.data_event)
        ? /** @type {Record<string, unknown>} */ (res.data_event)
        : null;

  /** @type {string | number | null} */
  let mesa = null;
  if (nonempty(d?.mesa)) {
    mesa = /** @type {string} */ (String(d.mesa).trim());
    sourcePaths.mesa = 'payload.data.mesa';
  } else if (nonempty(sig2?.nombre_mesa)) {
    mesa = String(sig2.nombre_mesa).trim();
    sourcePaths.mesa = 'payload.data.data.signal.nombre_mesa';
  } else if (nonempty(sig1?.nombre_mesa)) {
    mesa = String(sig1.nombre_mesa).trim();
    sourcePaths.mesa = 'payload.data.signal.nombre_mesa';
  } else if (nonempty(resEv?.mesa)) {
    mesa = String(resEv.mesa).trim();
    sourcePaths.mesa = 'payload.data.data.results.mesa_info.data_evento.mesa';
  } else if (nonempty(res?.nombre_mesa)) {
    mesa = String(res.nombre_mesa).trim();
    sourcePaths.mesa = 'payload.data.data.results.mesa_info.nombre_mesa';
  }

  /** Relay BFF / core-api: cuerpo plano sin `data.signal` — misma fuente que `formatSignal.resolveMesaFromPayload`. */
  if (!nonempty(mesa)) {
    if (nonempty(root.mesa)) {
      mesa = String(root.mesa).trim();
      sourcePaths.mesa = 'payload.mesa';
    } else if (nonempty(root.tableName)) {
      mesa = String(root.tableName).trim();
      sourcePaths.mesa = 'payload.tableName';
    } else if (nonempty(root.table)) {
      mesa = String(root.table).trim();
      sourcePaths.mesa = 'payload.table';
    } else if (nonempty(root.desk)) {
      mesa = String(root.desk).trim();
      sourcePaths.mesa = 'payload.desk';
    }
  }

  /** @type {string | number | null} */
  let round = null;

  /** NEW_RESULT: la ronda que empareja con la señal es siempre `mesa_info.ronda_objetivo` (no `ronda_actual`). */
  if (nonempty(res?.ronda_objetivo)) {
    round = res.ronda_objetivo;
    sourcePaths.round = 'payload.data.data.results.mesa_info.ronda_objetivo';
    if (isRoundTargetModeEnabled()) diagnostics.warnings.push('using ronda_objetivo');
  } else if (isRoundTargetModeEnabled()) {
    if (nonempty(sig2?.ronda_actual)) {
      round = sig2.ronda_actual;
      sourcePaths.round = 'payload.data.data.signal.ronda_actual';
    } else if (nonempty(sig1?.ronda_actual)) {
      round = sig1.ronda_actual;
      sourcePaths.round = 'payload.data.signal.ronda_actual';
    } else if (nonempty(resEv?.Ronda)) {
      round = resEv.Ronda;
      sourcePaths.round = 'payload.data.data.results.mesa_info.data_evento.Ronda';
    } else if (nonempty(resEv?.ronda)) {
      round = resEv.ronda;
      sourcePaths.round = 'payload.data.data.results.mesa_info.data_evento.ronda';
    } else if (nonempty(resEv?.round)) {
      round = resEv.round;
      sourcePaths.round = 'payload.data.data.results.mesa_info.data_evento.round';
    } else if (nonempty(d?.ronda)) {
      round = d.ronda;
      sourcePaths.round = 'payload.data.ronda';
    } else if (nonempty(res?.ronda_actual)) {
      round = res.ronda_actual;
      sourcePaths.round = 'payload.data.data.results.mesa_info.ronda_actual';
    } else if (nonempty(root.round)) {
      round = root.round;
      sourcePaths.round = 'payload.round';
    } else if (nonempty(root.roundId)) {
      round = root.roundId;
      sourcePaths.round = 'payload.roundId';
    } else if (nonempty(root.ronda)) {
      round = root.ronda;
      sourcePaths.round = 'payload.ronda';
    } else if (nonempty(root.ronda_actual)) {
      round = root.ronda_actual;
      sourcePaths.round = 'payload.ronda_actual';
    } else if (nonempty(root.Ronda)) {
      round = root.Ronda;
      sourcePaths.round = 'payload.Ronda';
    } else if (nonempty(root.gameRound)) {
      round = root.gameRound;
      sourcePaths.round = 'payload.gameRound';
    }
  } else {
    if (nonempty(sig2?.ronda_actual)) {
      round = sig2.ronda_actual;
      sourcePaths.round = 'payload.data.data.signal.ronda_actual';
    } else if (nonempty(sig1?.ronda_actual)) {
      round = sig1.ronda_actual;
      sourcePaths.round = 'payload.data.signal.ronda_actual';
    } else if (nonempty(resEv?.Ronda)) {
      round = resEv.Ronda;
      sourcePaths.round = 'payload.data.data.results.mesa_info.data_evento.Ronda';
    } else if (nonempty(resEv?.ronda)) {
      round = resEv.ronda;
      sourcePaths.round = 'payload.data.data.results.mesa_info.data_evento.ronda';
    } else if (nonempty(resEv?.round)) {
      round = resEv.round;
      sourcePaths.round = 'payload.data.data.results.mesa_info.data_evento.round';
    } else if (nonempty(d?.ronda)) {
      round = d.ronda;
      sourcePaths.round = 'payload.data.ronda';
    } else if (nonempty(res?.ronda_actual)) {
      round = res.ronda_actual;
      sourcePaths.round = 'payload.data.data.results.mesa_info.ronda_actual';
    } else if (nonempty(root.round)) {
      round = root.round;
      sourcePaths.round = 'payload.round';
    } else if (nonempty(root.roundId)) {
      round = root.roundId;
      sourcePaths.round = 'payload.roundId';
    } else if (nonempty(root.ronda)) {
      round = root.ronda;
      sourcePaths.round = 'payload.ronda';
    } else if (nonempty(root.ronda_actual)) {
      round = root.ronda_actual;
      sourcePaths.round = 'payload.ronda_actual';
    } else if (nonempty(root.Ronda)) {
      round = root.Ronda;
      sourcePaths.round = 'payload.Ronda';
    } else if (nonempty(root.gameRound)) {
      round = root.gameRound;
      sourcePaths.round = 'payload.gameRound';
    }
  }

  /** @type {string | null} */
  let direction = null;
  const vf2 = sig2?.vector_forecast;
  const vf1 = sig1?.vector_forecast;
  const vf0 = root.vector_forecast;
  if (Array.isArray(vf2) && vf2.length > 0 && vf2[0] != null && String(vf2[0]).trim() !== '') {
    direction = String(vf2[0]).trim();
    sourcePaths.direction = 'payload.data.data.signal.vector_forecast[0]';
  } else if (Array.isArray(vf1) && vf1.length > 0 && vf1[0] != null && String(vf1[0]).trim() !== '') {
    direction = String(vf1[0]).trim();
    sourcePaths.direction = 'payload.data.signal.vector_forecast[0]';
  } else if (Array.isArray(vf0) && vf0.length > 0 && vf0[0] != null && String(vf0[0]).trim() !== '') {
    direction = String(vf0[0]).trim();
    sourcePaths.direction = 'payload.vector_forecast[0]';
  } else if (nonempty(root.recommendation)) {
    direction = String(root.recommendation).trim();
    sourcePaths.direction = 'payload.recommendation';
  }

  /** @type {string | null} */
  let algorithm = null;
  if (nonempty(sig2?.nombre_algoritmo)) {
    algorithm = String(sig2.nombre_algoritmo).trim();
    sourcePaths.algorithm = 'payload.data.data.signal.nombre_algoritmo';
  } else if (nonempty(sig1?.nombre_algoritmo)) {
    algorithm = String(sig1.nombre_algoritmo).trim();
    sourcePaths.algorithm = 'payload.data.signal.nombre_algoritmo';
  } else if (nonempty(root.nombre_algoritmo)) {
    algorithm = String(root.nombre_algoritmo).trim();
    sourcePaths.algorithm = 'payload.nombre_algoritmo';
  }

  /** @type {string | null} */
  let result = null;
  if (nonempty(res?.ganador)) {
    result = String(res.ganador).trim();
    sourcePaths.result = 'payload.data.data.results.mesa_info.ganador';
  } else if (nonempty(root.ganador)) {
    result = String(root.ganador).trim();
    sourcePaths.result = 'payload.ganador';
  }

  if (!mesa) diagnostics.missing.push('mesa');
  if (round == null || (typeof round === 'string' && round.trim() === '')) diagnostics.missing.push('round');

  if (nonempty(sig2?.nombre_mesa) && nonempty(d?.mesa) && String(sig2.nombre_mesa).trim() !== String(d.mesa).trim()) {
    diagnostics.conflicts.push('mesa mismatch between sig2 (data.data.signal) and payload.data.mesa');
  }

  if (typeof round === 'string') {
    diagnostics.warnings.push('round is string');
  }
  if (!direction) {
    diagnostics.warnings.push('direction missing');
  }

  /** @type {string | null} */
  let correlationKey = null;
  const providerIdPick = (() => {
    const cands = [root.id, root.signalId, sig1?.id, sig1?.signalId, sig2?.id, sig2?.signalId];
    for (const v of cands) {
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return null;
  })();
  correlationKey = buildSafeCorrelationKey({
    mesa,
    round,
    providerId: providerIdPick ?? undefined,
  });
  if (correlationKey != null) {
    sourcePaths.correlationKey = correlationKey.includes('|') ? 'computed:mesa|round' : 'computed:id:provider';
  } else {
    sourcePaths.correlationKey = null;
  }

  return {
    mesa: mesa != null ? String(mesa).trim() : null,
    round: round == null || (typeof round === 'string' && round.trim() === '') ? null : round,
    direction,
    algorithm,
    result,
    correlationKey,
    sourcePaths,
    diagnostics,
    sourceUsed,
  };
}

/**
 * Logs de auditoría (solo si `VITE_SIGNAL_AUDIT=1`).
 * @param {unknown} payload
 * @param {string} [context]
 */
export function logCanonicalAudit(payload, context = '') {
  if (!isSignalAuditEnabled()) return;
  const ex = extractCanonicalFields(payload);
  const tag = context ? `[${context}] ` : '';
  console.log(`${tag}[CANONICAL_MAP]`, {
    mesa: ex.mesa,
    round: ex.round,
    direction: ex.direction,
    algorithm: ex.algorithm,
    result: ex.result,
    correlationKey: ex.correlationKey,
  });
  console.log(`${tag}[SOURCE_PATHS]`, ex.sourcePaths);
  console.log(`${tag}[DIAGNOSTICS]`, ex.diagnostics);
  console.log(`${tag}[PROVIDER_SOURCE]`, ex.sourceUsed);
}

/**
 * Fase 1 — aplica campos canónicos al payload (solo si `VITE_CANONICAL_MODE=1`).
 * No altera el objeto recibido cuando el modo está desactivado (misma referencia).
 *
 * @param {unknown} payload
 * @returns {{ payload: Record<string, unknown>, canonical: ReturnType<typeof extractCanonicalFields> }}
 */
export function applyCanonicalModeToPayload(payload) {
  const canonical = extractCanonicalFields(payload);
  const p =
    payload != null && typeof payload === 'object' && !Array.isArray(payload)
      ? /** @type {Record<string, unknown>} */ (payload)
      : null;
  if (!p) {
    return { payload: {}, canonical };
  }
  if (!isCanonicalModeEnabled()) {
    return { payload: p, canonical };
  }
  if (p._canonicalMergedPhase1 === true) {
    return { payload: p, canonical };
  }
  logCanonicalAudit(payload, 'phase1');
  /** @type {Record<string, unknown>} */
  const row = { ...p };
  if (canonical.mesa != null) row.mesa = canonical.mesa;
  if (canonical.round != null && !(typeof canonical.round === 'string' && String(canonical.round).trim() === '')) {
    row.round = canonical.round;
  }
  if (canonical.correlationKey != null) row.correlationKey = canonical.correlationKey;
  if (canonical.direction != null && String(canonical.direction).trim() !== '') {
    const prev = Array.isArray(row.vector_forecast) ? row.vector_forecast : [];
    row.vector_forecast = [canonical.direction, ...prev.slice(1, 6)];
  }
  if (canonical.result != null && String(canonical.result).trim() !== '') {
    row.ganador = canonical.result;
  }
  row._canonicalMergedPhase1 = true;
  return { payload: row, canonical };
}
