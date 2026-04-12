/**
 * SIGNAL vs RESULT — `extractSupplierSignal` / `extractSupplierResult` / `getPrediction` (provider-contract).
 */

import {
  buildCorrelationKey,
  extractSupplierResult,
  extractSupplierSignal,
  getPrediction,
  getPredictionSideLetter,
  getVectorForecast,
} from '../core/provider-contract.js';
import { asRecord } from './signalSessionCanonical.js';
import { traceVerbose } from './resultFullTrace.js';

/** @param {unknown} g */
function letterFromGanador(g) {
  if (g == null) return null;
  const s = String(g).trim().toUpperCase();
  if (s === 'BANKER' || s === 'B' || s.startsWith('BANK')) return 'B';
  if (s === 'PLAYER' || s === 'P' || s.startsWith('PLAY')) return 'P';
  if (s === 'TIE' || s === 'T' || s === 'E' || s.startsWith('TIE') || s.startsWith('EMP')) return 'T';
  return null;
}

/** @param {Record<string, unknown> | null} rec */
function pickCreatedAtMs(rec) {
  if (!rec || typeof rec !== 'object') return null;
  const ca = rec.createdAt ?? rec.ts ?? rec.timestamp;
  if (ca == null) return null;
  const t = ca instanceof Date ? ca.getTime() : new Date(/** @type {string | number | Date} */ (ca)).getTime();
  return Number.isFinite(t) ? t : null;
}

function ensureGlobals(g) {
  if (!g.algorithmStats) g.algorithmStats = Object.create(null);
  if (!g.mesaStats) g.mesaStats = Object.create(null);
  if (!g.martingaleStats) g.martingaleStats = { total: 0, wins: 0, losses: 0 };
  if (!g.__resultAnalysisLastSignalByKey) g.__resultAnalysisLastSignalByKey = new Map();
}

/**
 * Antes de ingest/emit: bloque `results.mesa_info` vía contrato.
 * @param {unknown} rawPayload
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function prevalidateRelayNewResult(rawPayload) {
  console.log('📍 PREVALIDATE RESULT', rawPayload);
  const mi = extractSupplierResult(rawPayload);
  if (!mi || typeof mi !== 'object' || Array.isArray(mi)) {
    console.error('❌ PREVALIDATE FAILED', 'missing_extractSupplierResult');
    return { ok: false, reason: 'missing_extractSupplierResult' };
  }
  const sig = extractSupplierSignal(rawPayload);
  const ro = mi.ronda_objetivo;
  if (sig && typeof sig === 'object' && !Array.isArray(sig) && sig.ronda_actual != null && ro != null) {
    if (String(sig.ronda_actual).trim() !== String(ro).trim()) {
      console.warn('DESYNC DETECTED', {
        signal_ronda_actual: sig.ronda_actual,
        ronda_objetivo: ro,
      });
      console.error('❌ PREVALIDATE FAILED', 'desync_signal_vs_mesa_info_round');
      return { ok: false, reason: 'desync_signal_vs_mesa_info_round' };
    }
  }
  return { ok: true };
}

/**
 * Último NEW_SIGNAL: mapa por `buildCorrelationKey(signal)` → `predictionRaw` literal.
 * @param {unknown} rawPayload
 */
export function recordSignalForResultAnalysis(rawPayload) {
  const g = globalThis;
  ensureGlobals(g);
  const sig = extractSupplierSignal(rawPayload);
  if (!sig || typeof sig !== 'object' || Array.isArray(sig)) return;
  let ck;
  try {
    ck = buildCorrelationKey(sig);
  } catch {
    return;
  }
  let predictionRaw;
  try {
    predictionRaw = getPrediction(sig);
  } catch {
    return;
  }
  const vf = getVectorForecast(sig);
  g.__resultAnalysisLastSignalByKey.set(ck, {
    predictionRaw,
    vectorFirst: vf[0],
    nombre_algoritmo:
      sig.nombre_algoritmo != null && String(sig.nombre_algoritmo).trim() !== ''
        ? String(sig.nombre_algoritmo).trim()
        : null,
    nombre_mesa: sig.nombre_mesa != null ? String(sig.nombre_mesa).trim() : null,
    ronda_actual: sig.ronda_actual,
    createdAtMs: pickCreatedAtMs(sig) ?? pickCreatedAtMs(asRecord(rawPayload)),
  });
}

/**
 * Lanza `CRITICAL_MISMATCH` si la predicción (vector[0]) y el ganador no alinean en P/B/T.
 * @param {unknown} rawPayload
 */
export function validateRelayResultPredictionOrThrow(rawPayload) {
  const result = extractSupplierResult(rawPayload);
  if (!result || result.ganador == null || String(result.ganador).trim() === '') return;

  const winner = result.ganador;
  const sig = extractSupplierSignal(rawPayload);

  /** @type {unknown} */
  let predictionRaw;
  try {
    predictionRaw = sig != null ? getPrediction(sig) : undefined;
  } catch {
    predictionRaw = undefined;
  }

  const g = globalThis;
  ensureGlobals(g);
  const map = /** @type {Map<string, Record<string, unknown>>} */ (g.__resultAnalysisLastSignalByKey);

  if (predictionRaw == null) {
    let ck;
    try {
      ck = buildCorrelationKey(result);
    } catch {
      return;
    }
    const snap = map.get(ck);
    predictionRaw = snap?.predictionRaw;
  }

  if (predictionRaw == null || winner == null || String(winner).trim() === '') return;

  traceVerbose('contract_prediction_vs_result', { predictionRaw, winner });

  if (String(predictionRaw).trim() === String(winner).trim()) return;

  /** @type {string} */
  let traceCkMismatch = '(unknown)';
  try {
    traceCkMismatch = buildCorrelationKey(result);
  } catch {
    /* keep unknown */
  }

  const predLetter = getPredictionSideLetter(sig ?? { vector_forecast: [predictionRaw] });
  const actual = letterFromGanador(winner);
  if (predLetter != null && actual != null && predLetter !== actual) {
    console.error('🚨 CRITICAL MISMATCH', traceCkMismatch);
    console.error('[CRITICAL_MISMATCH]', {
      predictionRaw,
      winner,
      predLetter,
      actual,
    });
    throw new Error('CRITICAL_MISMATCH');
  }
  if (predLetter == null || actual == null) {
    console.error('🚨 CRITICAL MISMATCH', traceCkMismatch);
    console.error('[CRITICAL_MISMATCH]', {
      predictionRaw,
      winner,
      predLetter,
      actual,
    });
    throw new Error('CRITICAL_MISMATCH');
  }
}

/**
 * @param {unknown} rawPayload — NEW_RESULT relay
 * @param {{ logger?: { debug?: Function; warn?: Function } }} [opts]
 */
export function analyzeNewResultPayload(rawPayload, opts = {}) {
  const g = globalThis;
  ensureGlobals(g);
  const { logger } = opts;

  const r =
    rawPayload != null && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
      ? /** @type {Record<string, unknown>} */ (rawPayload)
      : null;
  if (!r) return;

  const mesa_info = extractSupplierResult(rawPayload);
  if (!mesa_info || typeof mesa_info !== 'object' || Array.isArray(mesa_info)) return;

  let sig = extractSupplierSignal(rawPayload);
  const miMesa = String(mesa_info.nombre_mesa ?? '').trim();
  let ckSnap;
  try {
    ckSnap = buildCorrelationKey(mesa_info);
  } catch {
    ckSnap = null;
  }
  const map = /** @type {Map<string, Record<string, unknown>>} */ (g.__resultAnalysisLastSignalByKey);
  const snap = ckSnap != null ? map.get(ckSnap) : null;

  /** @type {unknown} */
  let predictedRaw = null;
  /** @type {string | null} */
  let algo = null;
  /** @type {string | null} */
  let mesa = null;
  /** @type {unknown} */
  let signalRondaActual = null;

  if (sig && typeof sig === 'object' && !Array.isArray(sig)) {
    try {
      predictedRaw = getPrediction(sig);
    } catch {
      predictedRaw = null;
    }
    algo =
      sig.nombre_algoritmo != null && String(sig.nombre_algoritmo).trim() !== ''
        ? String(sig.nombre_algoritmo).trim()
        : null;
    mesa = sig.nombre_mesa != null ? String(sig.nombre_mesa).trim() : null;
    signalRondaActual = sig.ronda_actual;
  } else if (snap) {
    predictedRaw = snap.vectorFirst;
    algo = snap.nombre_algoritmo != null ? String(snap.nombre_algoritmo) : null;
    mesa = snap.nombre_mesa != null ? String(snap.nombre_mesa) : miMesa || null;
    signalRondaActual = snap.ronda_actual;
    sig = /** @type {Record<string, unknown>} */ ({ ronda_actual: snap.ronda_actual });
  }

  if (!mesa || mesa === '') {
    mesa = miMesa || null;
  }
  if (!mesa) return;

  if (
    mesa_info.ronda_objetivo != null &&
    signalRondaActual != null &&
    String(mesa_info.ronda_objetivo).trim() !== '' &&
    String(signalRondaActual).trim() !== '' &&
    String(mesa_info.ronda_objetivo) !== String(signalRondaActual)
  ) {
    console.warn('DESYNC DETECTED', {
      ronda_objetivo: mesa_info.ronda_objetivo,
      signal_ronda_actual: signalRondaActual,
    });
    return;
  }

  const predicted =
    predictedRaw != null ? getPredictionSideLetter({ vector_forecast: [predictedRaw] }) : null;
  const ganadorRaw = mesa_info.ganador;
  const actual = letterFromGanador(ganadorRaw);
  if (predicted == null || actual == null) return;

  const isWin = predicted === actual;

  const mg = mesa_info.martingala;
  const martBlock = mg != null && typeof mg === 'object' && !Array.isArray(mg) ? /** @type {Record<string, unknown>} */ (mg) : null;
  const martingaleLevel = martBlock?.contador_martingala != null ? Number(martBlock.contador_martingala) : 0;
  const mLevelSafe = Number.isFinite(martingaleLevel) ? martingaleLevel : 0;

  const algoKey = algo ?? '_unknown';
  if (!g.algorithmStats[algoKey]) {
    g.algorithmStats[algoKey] = { wins: 0, losses: 0, total: 0, accuracy: 0 };
  }
  const ast = g.algorithmStats[algoKey];
  ast.total += 1;
  if (isWin) ast.wins += 1;
  else ast.losses += 1;
  ast.accuracy = ast.wins / ast.total;

  if (!g.mesaStats[mesa]) {
    g.mesaStats[mesa] = { wins: 0, losses: 0, total: 0 };
  }
  const mst = g.mesaStats[mesa];
  mst.total += 1;
  if (isWin) mst.wins += 1;
  else mst.losses += 1;

  const mgs = g.martingaleStats;
  if (mLevelSafe > 0) {
    mgs.total += 1;
    if (isWin) mgs.wins += 1;
    else mgs.losses += 1;
  }

  const startMs =
    (snap && snap.createdAtMs != null ? Number(snap.createdAtMs) : null) ??
    (sig ? pickCreatedAtMs(/** @type {Record<string, unknown>} */ (sig)) : null) ??
    pickCreatedAtMs(r);
  const endMs = pickCreatedAtMs(r);
  let duration = 0;
  if (startMs != null && endMs != null && Number.isFinite(startMs) && Number.isFinite(endMs)) {
    duration = endMs - startMs;
    g.lastRoundDuration = duration;
  }

  const logOn = String(process.env.ADMIN_SIGNALS_RESULT_ANALYSIS ?? '').trim() === '1';
  if (logOn) {
    console.log('RESULT ANALYSIS:', {
      mesa,
      algoritmo: algoKey,
      predicted,
      actual,
      isWin,
      martingaleLevel: mLevelSafe,
      duration,
      algoStats: g.algorithmStats[algoKey],
      mesaStats: g.mesaStats[mesa],
    });
  }
  try {
    logger?.debug?.('result_real_analysis', {
      mesa,
      algoritmo: algoKey,
      predicted,
      actual,
      isWin,
      martingaleLevel: mLevelSafe,
      duration,
    });
  } catch {
    /* ignore */
  }
}

/** Solo tests: limpia acumuladores y mapa. */
export function resetResultRealAnalysisForTests() {
  const g = globalThis;
  delete g.algorithmStats;
  delete g.mesaStats;
  delete g.martingaleStats;
  delete g.lastRoundDuration;
  g.__resultAnalysisLastSignalByKey = new Map();
}
