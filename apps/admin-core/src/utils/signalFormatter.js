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

/** Mesas placeholder: nunca deben quedar como mesa final si hay alternativa (spec fase crítica). */
const PLACEHOLDER_MESA = new Set([
  '',
  '—',
  '-',
  'N/A',
  'NA',
  'TEST',
  'MOCK',
  'EXAMPLE',
  'SAMPLE',
  'DEMO',
  'DEFAULT',
]);

/**
 * @param {string} v
 */
function isPlaceholderMesa(v) {
  return PLACEHOLDER_MESA.has(String(v).trim().toUpperCase());
}

/** Mesa ya normalizada por `resolveMesaFromPayload`: inválida para contrato store/matcher. */
export function isContractInvalidMesa(mesa) {
  const m = String(mesa ?? '').trim();
  if (m === 'UNKNOWN' || m.toUpperCase() === 'TEST') return true;
  return isPlaceholderMesa(m);
}

/**
 * Ronda como número de juego (>0, no epoch) para contrato con `validateSignal` / `validateResult`.
 * @param {unknown} resolvedRound — salida típica de `resolveRoundFromPayload` (string o number).
 * @returns {number | null}
 */
export function normalizeContractRound(resolvedRound) {
  if (typeof resolvedRound === 'number' && Number.isFinite(resolvedRound)) {
    if (resolvedRound <= 0 || resolvedRound > 1_000_000_000) return null;
    return Math.trunc(resolvedRound);
  }
  const s = String(resolvedRound ?? '').trim();
  if (s === '' || s === '-') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) return null;
  return Math.trunc(n);
}

/**
 * @param {Record<string, unknown>} r
 * @returns {{ data: Record<string, unknown> | null, sig: Record<string, unknown> | null }}
 */
function readNestedDataSignal(r) {
  const data =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  const sig =
    data?.signal != null && typeof data.signal === 'object' && !Array.isArray(data.signal)
      ? /** @type {Record<string, unknown>} */ (data.signal)
      : null;
  return { data, sig };
}

/** @param {unknown} v */
function strOrEmpty(v) {
  if (v == null) return '';
  const t = String(v).trim();
  return t;
}

/**
 * @param {unknown} x — número o string numérico grande → probable timestamp de sistema (no ronda de mesa).
 */
function isTimestampRound(x) {
  if (x == null) return false;
  if (typeof x === 'number' && x > 1_000_000_000) return true;
  const s = String(x).trim();
  const n = Number(s);
  return Number.isFinite(n) && n > 1_000_000_000;
}

/**
 * Mesa: prioridad `data.signal` luego raíz; sin "TEST" ni vacío como valor final (→ UNKNOWN).
 * @param {Record<string, unknown>} r
 */
export function resolveMesaFromPayload(r) {
  if (!r || typeof r !== 'object') return 'UNKNOWN';
  const { data, sig } = readNestedDataSignal(r);

  let mesa =
    strOrEmpty(sig?.nombre_mesa) ||
    strOrEmpty(sig?.tableName) ||
    strOrEmpty(data?.mesa) ||
    strOrEmpty(r.mesa);

  if (!mesa || mesa.toLowerCase() === 'test') {
    mesa =
      strOrEmpty(sig?.tableName) ||
      strOrEmpty(sig?.nombre_mesa) ||
      strOrEmpty(r.tableName) ||
      strOrEmpty(r.nombre_mesa) ||
      strOrEmpty(r.table) ||
      strOrEmpty(r.mesaName) ||
      strOrEmpty(r.tableId) ||
      strOrEmpty(r.desk) ||
      'UNKNOWN';
  }

  if (isPlaceholderMesa(mesa)) return 'UNKNOWN';
  return mesa;
}

/**
 * Ronda de juego: prioridad anidada; timestamps (>1e9) se ignoran a favor de ronda real.
 * @param {Record<string, unknown>} r
 */
export function resolveRoundFromPayload(r) {
  if (!r || typeof r !== 'object') return '-';
  const { data, sig } = readNestedDataSignal(r);

  const pickFirst = (...vals) => {
    for (const v of vals) {
      if (v != null && String(v).trim() !== '') return v;
    }
    return null;
  };

  let round = pickFirst(
    sig?.ronda_actual,
    sig?.gameRound,
    data?.ronda,
    r.round,
    r.roundId,
  );

  if (round != null && isTimestampRound(round)) {
    round = pickFirst(sig?.ronda_actual, sig?.gameRound, data?.ronda, r.ronda_actual, r.gameRound, r.hand);
  }

  if (round != null && isTimestampRound(round)) {
    round = pickFirst(r.hand, r.shoe, r.ronda_actual, r.ronda_objetivo);
  }

  if (round == null || isTimestampRound(round)) return '-';
  return String(round).trim();
}

/**
 * @param {unknown} idVal
 * @param {string} mesa
 * @param {string} round
 */
export function correlationKeyFromResolvedContext(idVal, mesa, round) {
  if (idVal != null && String(idVal).trim() !== '') return `id:${String(idVal).trim()}`;
  const m = String(mesa).trim() || 'UNKNOWN';
  const rd = String(round).trim() || '-';
  return `mesa:${m}|round:${rd}`;
}

/**
 * Normaliza un token de forecast a P / B / T / — (misma idea que GenesisOracle).
 * @param {unknown} x
 */
export function forecastTokenToLetter(x) {
  const s = String(x ?? '').trim().toUpperCase();
  if (s.startsWith('BANK') || s === 'B') return 'B';
  if (s.startsWith('PLAY') || s === 'P') return 'P';
  if (s.includes('TIE') || s === 'T' || s.includes('EMPATE')) return 'T';
  const c = s.slice(0, 1);
  return c === 'B' || c === 'P' || c === 'T' ? c : '—';
}

/**
 * Hasta 6 tiros para UI (relleno con —).
 * @param {Record<string, unknown>} signal
 */
export function forecastSixFromSignal(signal) {
  const vf = signal.vector_forecast ?? signal.forecast ?? signal.forecastVector ?? null;
  const arr = Array.isArray(vf) ? vf : [];
  const out = [];
  for (let i = 0; i < 6; i += 1) {
    out.push(arr[i] != null && String(arr[i]).trim() !== '' ? forecastTokenToLetter(arr[i]) : '—');
  }
  return out;
}

/**
 * @param {Record<string, unknown>} signal
 */
export function formatSignal(signal) {
  const { sig } = readNestedDataSignal(signal);
  const side = normSide(
    signal.recommendation ?? sig?.recommendation ?? sig?.forecast ?? sig?.signal ?? sig?.side ?? sig?.prediction,
  );
  const prediction =
    side === 'PLAYER'
      ? { label: /** @type {const} */ ('PLAYER'), color: /** @type {const} */ ('blue') }
      : side === 'BANKER'
        ? { label: /** @type {const} */ ('BANKER'), color: /** @type {const} */ ('red') }
        : { label: /** @type {const} */ ('—'), color: /** @type {const} */ ('red') };

  const recommendation =
    side === 'PLAYER' || side === 'BANKER' ? side : side === 'TIE' ? 'TIE' : side === '—' ? '—' : 'UNKNOWN';

  const idVal = signal.id ?? signal.signalId ?? sig?.id ?? sig?.signalId;
  const resolvedMesa = resolveMesaFromPayload(signal);
  const resolvedRound = resolveRoundFromPayload(signal);
  const correlationKey = correlationKeyFromResolvedContext(idVal, resolvedMesa, resolvedRound);

  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_SIGNAL_NORMALIZE === '1') {
    console.log('SIGNAL NORMALIZED:', { mesa: resolvedMesa, round: resolvedRound, correlationKey });
  }

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

  const algorithmRaw =
    signal.nombre_algoritmo ??
    sig?.nombre_algoritmo ??
    signal.algorithm ??
    sig?.algorithm ??
    signal.algoritmo ??
    signal.patternName ??
    null;
  const algorithm =
    algorithmRaw != null && String(algorithmRaw).trim() !== '' ? String(algorithmRaw).trim() : '—';

  const roundNum = normalizeContractRound(resolvedRound);
  const base = {
    mesa: resolvedMesa,
    recommendation,
    predictionLabel: prediction.label,
    predictionColor: prediction.color,
    martingale: `M${signal.martingale ?? sig?.martingale ?? 0}`,
    martingaleLevel: Number(signal.martingale ?? sig?.martingale ?? 0) || 0,
    round: roundNum,
    id: idVal != null ? String(idVal) : null,
    correlationKey: correlationKey || null,
    timestamp: ts,
    serverTs: signal.serverTs,
    algorithm,
    forecast6: forecastSixFromSignal(
      sig ? { ...signal, vector_forecast: signal.vector_forecast ?? sig.vector_forecast, forecast: signal.forecast ?? sig.forecast } : signal,
    ),
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
  const sdRaw = result.scoreDetail != null && typeof result.scoreDetail === 'object' ? result.scoreDetail : null;
  const winnerNorm = normSide(
    (sdRaw && 'ganador' in sdRaw && sdRaw.ganador != null ? sdRaw.ganador : null) ??
      result.ganador ??
      result.resultado ??
      result.result,
  );
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
  const resolvedMesa = resolveMesaFromPayload(result);
  const resolvedRound = resolveRoundFromPayload(result);
  const correlationKey = correlationKeyFromResolvedContext(idVal, resolvedMesa, resolvedRound);

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

  /** @type {{ puntaje_player: string | null, puntaje_banker: string | null, cartas_player: string[] | null, cartas_banker: string[] | null, ganador: string | null } | null} */
  const scoreDetail = sdRaw
    ? {
        puntaje_player: sdRaw.puntaje_player != null ? String(sdRaw.puntaje_player) : null,
        puntaje_banker: sdRaw.puntaje_banker != null ? String(sdRaw.puntaje_banker) : null,
        cartas_player: Array.isArray(sdRaw.cartas_player) ? sdRaw.cartas_player.map((x) => String(x)) : null,
        cartas_banker: Array.isArray(sdRaw.cartas_banker) ? sdRaw.cartas_banker.map((x) => String(x)) : null,
        ganador: sdRaw.ganador != null ? normSide(sdRaw.ganador) : null,
      }
    : null;

  const effectiveGanadorNorm =
    scoreDetail?.ganador != null && scoreDetail.ganador !== '—'
      ? scoreDetail.ganador
      : winnerNorm !== '—'
        ? winnerNorm
        : null;

  /** @param {unknown} raw */
  const mesaInfoFromRaw = (raw) => {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const o = /** @type {Record<string, unknown>} */ (raw);
    if (!Array.isArray(o.cartas_player) || !Array.isArray(o.cartas_banker)) return null;
    if (typeof o.ganador !== 'string' || o.ganador.trim() === '') return null;
    return {
      cartas_player: o.cartas_player.map((x) => String(x)),
      cartas_banker: o.cartas_banker.map((x) => String(x)),
      ganador: o.ganador.trim(),
      puntaje_player: o.puntaje_player != null ? String(o.puntaje_player) : null,
      puntaje_banker: o.puntaje_banker != null ? String(o.puntaje_banker) : null,
    };
  };

  const mesa_info =
    effectiveGanadorNorm != null
      ? {
          cartas_player: Array.isArray(scoreDetail?.cartas_player) ? [...scoreDetail.cartas_player] : [],
          cartas_banker: Array.isArray(scoreDetail?.cartas_banker) ? [...scoreDetail.cartas_banker] : [],
          ganador: String(effectiveGanadorNorm),
          puntaje_player: scoreDetail?.puntaje_player ?? null,
          puntaje_banker: scoreDetail?.puntaje_banker ?? null,
        }
      : mesaInfoFromRaw(result.mesa_info);

  const roundNum = normalizeContractRound(resolvedRound);

  return {
    mesa: resolvedMesa,
    round: roundNum,
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
    scoreDetail,
    mesa_info,
  };
}
