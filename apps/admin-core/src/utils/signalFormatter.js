import { classifyResultOutcome, classifySignal } from './signalClassifier.js';

/** @typedef {'PLAYER' | 'BANKER'} PredLabel */

/**
 * @param {unknown} v
 * @returns {string}
 */
export function normSide(v) {
  const s = String(v ?? '')
    .trim()
    .toUpperCase();
  if (s === 'B' || s.startsWith('BANK')) return 'BANKER';
  if (s === 'P' || s.startsWith('PLAY')) return 'PLAYER';
  if (s === 'T' || s.startsWith('TIE')) return 'TIE';
  return s || '—';
}

/**
 * @param {Record<string, unknown>} signal
 */
export function formatSignal(signal) {
  const side = normSide(signal.recommendation);
  const prediction =
    side === 'PLAYER'
      ? { label: /** @type {const} */ ('PLAYER'), color: /** @type {const} */ ('blue') }
      : side === 'BANKER'
        ? { label: /** @type {const} */ ('BANKER'), color: /** @type {const} */ ('red') }
        : { label: /** @type {const} */ ('—'), color: /** @type {const} */ ('red') };

  const recommendation =
    side === 'PLAYER' || side === 'BANKER' ? side : side === 'TIE' ? 'TIE' : side === '—' ? '—' : 'UNKNOWN';

  const idVal = signal.id ?? signal.signalId;
  const correlationKey =
    typeof signal.correlationKey === 'string'
      ? signal.correlationKey
      : idVal != null
        ? `id:${String(idVal).trim()}`
        : '';

  const ts =
    signal.serverTs != null
      ? (() => {
          try {
            return new Date(Number(signal.serverTs)).toLocaleTimeString();
          } catch {
            return new Date().toLocaleTimeString();
          }
        })()
      : new Date().toLocaleTimeString();

  const base = {
    mesa: signal.mesa || 'N/A',
    recommendation,
    predictionLabel: prediction.label,
    predictionColor: prediction.color,
    martingale: `M${signal.martingale ?? 0}`,
    martingaleLevel: Number(signal.martingale) || 0,
    round: signal.round ?? '-',
    id: idVal != null ? String(idVal) : null,
    correlationKey: correlationKey || null,
    timestamp: ts,
    serverTs: signal.serverTs,
  };
  const classification = classifySignal(base);
  return { ...base, classification };
}

/**
 * Fila legible para tabla de resultados + comparación vs última predicción conocida de la mesa.
 * @param {Record<string, unknown>} result
 * @param {PredLabel | string | null | undefined} predictedLabel — última predicción (PLAYER/BANKER)
 */
export function formatResult(result, predictedLabel) {
  const winnerNorm = normSide(result.ganador ?? result.resultado ?? result.result);
  const pred =
    predictedLabel === 'PLAYER' || predictedLabel === 'BANKER' ? predictedLabel : null;

  let versus = '—';
  if (pred && winnerNorm && winnerNorm !== '—') {
    if (winnerNorm === 'TIE') versus = 'TIE';
    else versus = pred === winnerNorm ? 'WIN' : 'LOSS';
  }

  const serverWin = result.winStatus === true;
  const serverLoss = result.winStatus === false;

  /** Preferir criterio de servidor si existe; empate explícito; si no, heurística vs predicción. */
  let verdict = '—';
  if (winnerNorm === 'TIE' && (versus === 'TIE' || pred)) verdict = 'TIE';
  else if (serverWin) verdict = 'WIN';
  else if (serverLoss) verdict = 'LOSS';
  else if (versus === 'WIN' || versus === 'LOSS') verdict = versus;
  else if (versus === 'TIE') verdict = 'TIE';

  const verdictTone =
    verdict === 'WIN' ? 'win' : verdict === 'LOSS' ? 'loss' : verdict === 'TIE' ? 'tie' : 'neutral';

  const rawHist = result.historial ?? result.history;
  const historial = Array.isArray(rawHist) ? rawHist : [];

  const idVal = result.signalId ?? result.id;
  const correlationKey =
    typeof result.correlationKey === 'string'
      ? result.correlationKey
      : idVal != null
        ? `id:${String(idVal).trim()}`
        : '';

  const winStatusBool =
    result.winStatus === true || result.winStatus === 'true' || result.winStatus === 1 || result.winStatus === '1'
      ? true
      : result.winStatus === false || result.winStatus === 'false' || result.winStatus === 0 || result.winStatus === '0'
        ? false
        : verdict === 'WIN'
          ? true
          : verdict === 'LOSS'
            ? false
            : null;

  const outcome = classifyResultOutcome(verdict);

  return {
    mesa: result.mesa || 'N/A',
    ganador: winnerNorm,
    winnerLabel: winnerNorm,
    signalId: idVal != null ? String(idVal) : null,
    predictionLabel: pred ?? '—',
    versus,
    verdict,
    verdictTone,
    winStatus: winStatusBool,
    historial,
    correlationKey: correlationKey || null,
    serverTs: result.serverTs,
    outcome,
    tiempo: (() => {
      if (result.serverTs == null) return new Date().toLocaleTimeString();
      try {
        return new Date(Number(result.serverTs)).toLocaleTimeString();
      } catch {
        return '—';
      }
    })(),
  };
}
