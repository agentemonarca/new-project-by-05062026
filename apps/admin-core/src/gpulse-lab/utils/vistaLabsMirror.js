import { buildLabCorrelationKey, normalizeCorrelationKey } from './labCorrelationKey.js';
import { deriveRecommendation } from './deriveRecommendation.js';

/** Alineado con LAB_LIFECYCLE_STATES (evita import circular con useLabStore). */
const MIRROR = {
  WAITING_SIGNAL: 'WAITING_SIGNAL',
  SIGNAL_DETECTED: 'SIGNAL_DETECTED',
  RESULT_RECEIVED: 'RESULT_RECEIVED',
};

/**
 * VistaLabs es la única fuente de verdad: GPulse Lab solo refleja datos (sin fases simuladas).
 * @param {Record<string, unknown>} payload
 * @param {'signal' | 'result'} kind
 * @returns {Record<string, unknown>}
 */
export function normalizeVistaLabsPayload(payload, kind) {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  const p = /** @type {Record<string, unknown>} */ ({ ...payload });
  const mesa = p.mesa;
  const round = p.round ?? p.ronda_actual ?? null;
  const correlationKey =
    p.correlationKey != null && String(p.correlationKey).trim() !== ''
      ? String(p.correlationKey).trim()
      : mesa != null && round != null && String(round).trim() !== ''
        ? normalizeCorrelationKey(null, mesa, round) ?? buildLabCorrelationKey(mesa, round)
        : p.correlationKey ?? null;

  const mi =
    p.mesa_info != null && typeof p.mesa_info === 'object' && !Array.isArray(p.mesa_info)
      ? /** @type {Record<string, unknown>} */ (p.mesa_info)
      : null;

  const derivedRec = deriveRecommendation(p);
  const base = {
    ...p,
    mesa,
    round,
    correlationKey,
    recommendation: derivedRec,
    ganador:
      kind === 'result'
        ? (p.ganador ?? p.resultado ?? null)
        : (p.ganador ?? null),
    playerCards: p.playerCards ?? mi?.player ?? mi?.player_cards ?? mi?.cartas_player ?? [],
    bankerCards: p.bankerCards ?? mi?.banker ?? mi?.banker_cards ?? mi?.cartas_banker ?? [],
    playerScore: p.playerScore ?? mi?.player_score ?? mi?.puntaje_player ?? null,
    bankerScore: p.bankerScore ?? mi?.banker_score ?? mi?.puntaje_banker ?? null,
    ts: typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : typeof p.ts === 'number' ? p.ts : Date.now(),
  };

  if (kind === 'signal') {
    return {
      ...base,
      recommendation: derivedRec,
      timestamp: base.ts,
    };
  }

  return base;
}

/**
 * Deriva lifecycle global desde fila de mesa (sin timers).
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {typeof MIRROR[keyof typeof MIRROR]}
 */
export function deriveMirrorLifecycleFromMesaRow(row) {
  if (row == null || typeof row !== 'object') {
    return MIRROR.WAITING_SIGNAL;
  }
  const g = row.ganador;
  const hasGanador = g != null && String(g).trim() !== '';
  if (hasGanador) {
    return MIRROR.RESULT_RECEIVED;
  }
  const r = row.recommendation;
  const hasRec =
    r != null && (typeof r === 'object' ? Object.keys(r).length > 0 : String(r).trim() !== '');
  if (hasRec) {
    return MIRROR.SIGNAL_DETECTED;
  }
  return MIRROR.WAITING_SIGNAL;
}
