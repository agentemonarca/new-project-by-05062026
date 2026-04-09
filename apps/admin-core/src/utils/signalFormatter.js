import { normalizeCorrelationKey } from '../realtime/correlationKeyNormalize.js';
import { buildSafeCorrelationKey, isEpochMsCorrelationId } from './buildSafeCorrelationKey.js';
import { isAdminRawMode } from './adminRawMode.js';
import { resolveRoundFromProvider } from './resolveRoundFromProvider.js';
import { isCanonicalModeEnabled, isDirectionVectorEnabled } from '@/utils/canonicalFlowFlags.js';
import {
  applyCanonicalModeToPayload,
  extractCanonicalFields,
  logCanonicalAudit,
} from '@/utils/extractCanonicalFields.js';
import { resolveSignalFromProvider } from './resolveSignalFromProvider.js';
import { classifyResultOutcome, classifySignal } from './signalClassifier.js';
import { buildVistaLabExtras, pickMartingalaDataRoot, pickMesaInfoRawFromPayload } from './vistaLabProviderExtras.js';

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
  const sigFromData =
    data?.signal != null && typeof data.signal === 'object' && !Array.isArray(data.signal)
      ? /** @type {Record<string, unknown>} */ (data.signal)
      : null;
  /** Algunos relays mandan `{ signal: { ronda_actual, ... } }` sin capa `data`. */
  const sigRoot =
    r.signal != null && typeof r.signal === 'object' && !Array.isArray(r.signal)
      ? /** @type {Record<string, unknown>} */ (r.signal)
      : null;
  const sig = sigFromData ?? sigRoot;
  return { data, sig };
}

/** `data.data.signal` (proveedor / dashboardUpdate). */
function readDoubleNestedSignal(r) {
  const { data, sig } = readNestedDataSignal(r);
  const dataInner =
    data?.data != null && typeof data.data === 'object' && !Array.isArray(data.data)
      ? /** @type {Record<string, unknown>} */ (data.data)
      : null;
  const sigInner =
    dataInner?.signal != null && typeof dataInner.signal === 'object' && !Array.isArray(dataInner.signal)
      ? /** @type {Record<string, unknown>} */ (dataInner.signal)
      : null;
  return { dataInner, sigInner };
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
  const { dataInner, sigInner } = readDoubleNestedSignal(r);

  let mesa =
    strOrEmpty(sigInner?.nombre_mesa) ||
    strOrEmpty(sigInner?.tableName) ||
    strOrEmpty(sig?.nombre_mesa) ||
    strOrEmpty(sig?.tableName) ||
    strOrEmpty(dataInner?.mesa) ||
    strOrEmpty(data?.mesa) ||
    strOrEmpty(r.mesa);

  if (!mesa || mesa.toLowerCase() === 'test') {
    mesa =
      strOrEmpty(sigInner?.tableName) ||
      strOrEmpty(sigInner?.nombre_mesa) ||
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
 * `correlationKey` tipo `Nombre mesa|123` (no `id:`): último segmento si es ronda de juego válida.
 * Muchos proveedores solo envían la ronda embebida aquí.
 * @param {unknown} ck
 * @returns {string | null}
 */
export function extractRoundFromPipeCorrelationKey(ck) {
  if (ck == null) return null;
  const s = String(ck).trim();
  if (s === '' || s.toLowerCase().startsWith('id:')) return null;
  const pipe = s.lastIndexOf('|');
  if (pipe < 0) return null;
  const tail = s.slice(pipe + 1).trim();
  if (tail === '') return null;
  const n = Number(tail);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) return null;
  return String(Math.trunc(n));
}

/**
 * Claves tipo `mesa:X|round:10` o diagnóstico con `round:10` antes de normalizar a `X|10`.
 * @param {unknown} ck
 * @returns {string | null}
 */
export function extractRoundFromLabeledCorrelationKey(ck) {
  if (ck == null) return null;
  const s = String(ck).trim();
  if (s === '') return null;
  const m = s.match(/\bround:\s*([^|]+)/i);
  if (!m) return null;
  const part = String(m[1]).trim();
  const n = Number(part);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) return null;
  return String(Math.trunc(n));
}

/**
 * Ronda legible en VistaLab / admin cuando `row.round` es null (p. ej. CK `id:` válido en STRICT).
 * Orden: `round` → `roundId` → segmento `mesa|n` en `correlationKey`.
 * @param {Record<string, unknown> | null | undefined} row
 */
export function displayRoundForLiveRow(row) {
  if (row == null || typeof row !== 'object') return '—';
  const o = /** @type {Record<string, unknown>} */ (row);
  const r = o.round;
  if (typeof r === 'number' && Number.isFinite(r) && r > 0) return String(Math.trunc(r));
  if (typeof r === 'string' && r.trim() !== '' && r.trim() !== '-') {
    const n = normalizeContractRound(r);
    if (n != null) return String(n);
  }
  const rid = o.roundId;
  if (rid != null && String(rid).trim() !== '') {
    const n = normalizeContractRound(rid);
    if (n != null) return String(n);
  }
  const fromCk = extractRoundFromPipeCorrelationKey(o.correlationKey);
  if (fromCk != null) return fromCk;
  return '—';
}

/**
 * Igual que `displayRoundForLiveRow`, pero si solo hay `correlationKey` tipo `id:…` muestra un hint corto (no "ronda desconocida").
 * @param {Record<string, unknown> | null | undefined} row
 */
export function displayRoundOrIdHintForLiveRow(row) {
  const d = displayRoundForLiveRow(row);
  if (d !== '—') return d;
  if (row == null || typeof row !== 'object') return '—';
  const ck = String(/** @type {Record<string, unknown>} */ (row).correlationKey ?? '').trim();
  if (!ck.toLowerCase().startsWith('id:')) return '—';
  const tail = ck.slice(3).trim();
  if (!tail) return '—';
  return tail.length > 10 ? `id · …${tail.slice(-6)}` : `id · ${tail}`;
}

/**
 * Ronda desde `mesa_info` (NEW_RESULT): **ronda_objetivo** (cierra la señal); luego evento; **ronda_actual** solo último recurso.
 * @param {Record<string, unknown>} mi
 */
function pickRoundFromMesaInfoForensic(mi) {
  const pick = (...vals) => {
    for (const v of vals) {
      if (v != null && String(v).trim() !== '') return v;
    }
    return null;
  };
  const m = /** @type {Record<string, unknown>} */ (mi);
  const ev = m.data_evento ?? m.data_event;
  const evRec = ev != null && typeof ev === 'object' && !Array.isArray(ev) ? /** @type {Record<string, unknown>} */ (ev) : null;
  const fromEv = evRec ? pick(evRec.Ronda, evRec.ronda, evRec.round) : null;
  return pick(m.ronda_objetivo, fromEv, m.Ronda, m.round, m.gameRound, m.ronda_actual);
}

/**
 * Winxplay / envelopes: `mesa_info` en raíz, `data.results` o `data.data.results`.
 * @param {Record<string, unknown>} r
 */
function resolveRoundFromMesaInfoBlocks(r) {
  const d = r.data != null && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : null;
  const dInner = d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data) ? d.data : null;
  /** @type {unknown[]} */
  const blocks = [r.mesa_info, d?.results?.mesa_info, dInner?.results?.mesa_info];
  for (const mi of blocks) {
    if (mi == null || typeof mi !== 'object' || Array.isArray(mi)) continue;
    const v = pickRoundFromMesaInfoForensic(/** @type {Record<string, unknown>} */ (mi));
    if (v != null) return v;
  }
  return null;
}

/**
 * Ronda de juego: prioridad anidada; timestamps (>1e9) se ignoran a favor de ronda real.
 * @param {Record<string, unknown>} r
 */
export function resolveRoundFromPayload(r) {
  if (!r || typeof r !== 'object') return '-';
  const { data, sig } = readNestedDataSignal(r);
  const { dataInner, sigInner } = readDoubleNestedSignal(r);

  const pickFirst = (...vals) => {
    for (const v of vals) {
      if (v != null && String(v).trim() !== '') return v;
    }
    return null;
  };

  const roundFromDataEvent = (holder) => {
    if (holder == null || typeof holder !== 'object' || Array.isArray(holder)) return null;
    const h = /** @type {Record<string, unknown>} */ (holder);
    const ev = h.data_evento ?? h.data_event;
    if (ev == null || typeof ev !== 'object' || Array.isArray(ev)) return null;
    const o = /** @type {Record<string, unknown>} */ (ev);
    return pickFirst(o.Ronda, o.ronda, o.round);
  };

  // NEW_RESULT: mesa_info (ronda_objetivo > data_evento.Ronda > ronda_actual). NEW_SIGNAL: data.data.signal + data.ronda.
  let round = pickFirst(
    resolveRoundFromProvider(r),
    resolveRoundFromMesaInfoBlocks(r),
    sigInner?.ronda_actual,
    sigInner?.gameRound,
    sigInner?.ronda_objetivo,
    data?.ronda,
    dataInner?.ronda,
    dataInner?.ronda_actual,
    dataInner?.ronda_objetivo,
    roundFromDataEvent(sigInner),
    roundFromDataEvent(sig),
    roundFromDataEvent(dataInner),
    roundFromDataEvent(data),
    roundFromDataEvent(r),
    sig?.ronda_actual,
    sig?.gameRound,
    sig?.ronda_objetivo,
    data?.ronda_actual,
    data?.ronda_objetivo,
    r.ronda,
    r.ronda_actual,
    r.ronda_objetivo,
    r.Ronda,
    r.round,
    r.roundId,
    extractRoundFromLabeledCorrelationKey(r.correlationKey),
    extractRoundFromPipeCorrelationKey(r.correlationKey),
  );

  if (round != null && isTimestampRound(round)) {
    round = pickFirst(
      sigInner?.ronda_actual,
      sig?.ronda_actual,
      sig?.gameRound,
      data?.ronda,
      data?.ronda_actual,
      r.ronda_actual,
      r.ronda,
      r.ronda_objetivo,
      r.gameRound,
      r.hand,
      resolveRoundFromMesaInfoBlocks(r),
      extractRoundFromLabeledCorrelationKey(r.correlationKey),
      extractRoundFromPipeCorrelationKey(r.correlationKey),
    );
  }

  if (round != null && isTimestampRound(round)) {
    round = pickFirst(
      r.hand,
      r.shoe,
      r.ronda_actual,
      r.ronda_objetivo,
      extractRoundFromLabeledCorrelationKey(r.correlationKey),
      extractRoundFromPipeCorrelationKey(r.correlationKey),
    );
  }

  if (round == null || isTimestampRound(round)) {
    const fromCk =
      extractRoundFromLabeledCorrelationKey(r.correlationKey) ?? extractRoundFromPipeCorrelationKey(r.correlationKey);
    if (fromCk != null) return fromCk;
    const fromMi = resolveRoundFromMesaInfoBlocks(r);
    if (fromMi != null && !isTimestampRound(fromMi)) return String(fromMi).trim();
    return '-';
  }
  return String(round).trim();
}

const CK_SOURCE_LOG = import.meta.env.VITE_CK_SOURCE_LOG === '1';

/**
 * Prioridad: `payload.correlationKey` con `|` (mesa|round del backend) → `buildSafeCorrelationKey`
 * (`mesa|round` real o `id:` solo si el id del proveedor no es tipo epoch).
 *
 * @param {Record<string, unknown> | null | undefined} payload
 * @param {unknown} idVal
 * @param {string} mesa
 * @param {string} round
 */
export function correlationKeyFromResolvedContext(payload, idVal, mesa, round) {
  const p = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  if (isCanonicalModeEnabled() && p) {
    const c = extractCanonicalFields(p);
    if (c.correlationKey != null) {
      p.correlationKey = c.correlationKey;
      return c.correlationKey;
    }
  }
  const rawCkDirty =
    p && p.correlationKey != null && String(p.correlationKey).trim() !== '' ? String(p.correlationKey).trim() : '';
  let rawCk = rawCkDirty;
  if (rawCkDirty !== '') {
    const n = normalizeCorrelationKey(rawCkDirty);
    if (n != null && String(n).trim() !== '') rawCk = String(n).trim();
  }
  if (rawCk.startsWith('id:')) {
    const rest = rawCk.slice(3);
    if (isEpochMsCorrelationId(rest)) {
      console.warn('[NO_CORRELATION_KEY]', { payload: p, correlationKey: rawCk });
      rawCk = '';
    }
  }

  const serverPipe = rawCk.includes('|') && !rawCk.startsWith('id:');
  const m = mesa != null ? String(mesa).trim() : '';
  const r = round != null ? String(round).trim() : '';
  const pid =
    idVal != null && String(idVal).trim() !== '' && !isEpochMsCorrelationId(String(idVal).trim())
      ? String(idVal).trim()
      : undefined;

  let used = null;
  if (serverPipe && rawCk) {
    used = rawCk;
  } else {
    used = buildSafeCorrelationKey({ mesa: m || null, round: r || null, providerId: pid });
  }

  if (p) {
    if (used != null) p.correlationKey = used;
    else delete p.correlationKey;
  }

  if (
    used == null &&
    (rawCkDirty !== '' || pid !== undefined || m !== '' || (r !== '' && r !== '-'))
  ) {
    console.warn('[MISSING_ROUND_NO_ID]', { mesa: m || null, round: r || null, providerId: pid ?? null });
  }

  if (CK_SOURCE_LOG) {
    console.log('[CK_SOURCE]', { used, source: serverPipe ? 'server' : 'computed' });
  }

  return used ?? '';
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
 * Último recurso: ronda numérica desde `Mesa|123` si el resto de campos fallaron.
 * @param {unknown} resolvedRound
 * @param {unknown} correlationKeyWire
 * @param {unknown} correlationKeyComputed
 */
function contractRoundWithCkFallback(resolvedRound, correlationKeyWire, correlationKeyComputed) {
  let n = normalizeContractRound(resolvedRound);
  if (n != null) return n;
  n = normalizeContractRound(extractRoundFromPipeCorrelationKey(correlationKeyWire));
  if (n != null) return n;
  return normalizeContractRound(extractRoundFromPipeCorrelationKey(correlationKeyComputed));
}

/**
 * Capa de UI derivada del mismo payload (incluye anidado `data.signal`); no descarta claves del proveedor.
 * @param {Record<string, unknown>} signal
 */
function buildSignalDisplayLayer(signal) {
  const baseIn =
    signal != null && typeof signal === 'object' && !Array.isArray(signal)
      ? /** @type {Record<string, unknown>} */ ({ ...signal })
      : /** @type {Record<string, unknown>} */ ({});
  const { payload: working } = applyCanonicalModeToPayload(baseIn);
  if (isDirectionVectorEnabled()) {
    const c = extractCanonicalFields(working);
    const raw = c.direction ?? working.recommendation ?? null;
    if (raw != null && String(raw).trim() !== '') {
      const u = String(raw).trim().toUpperCase();
      if (u === 'P' || u.startsWith('PLAY')) working.recommendation = 'PLAYER';
      else if (u === 'B' || u.startsWith('BANK')) working.recommendation = 'BANKER';
      else if (u === 'E' || u === 'T' || u.startsWith('TIE')) working.recommendation = 'TIE';
    }
  }

  logCanonicalAudit(working, 'formatSignal');
  const { sig } = readNestedDataSignal(working);
  const { sigInner } = readDoubleNestedSignal(working);
  const sigEff = sigInner ?? sig;
  const fromProvider = resolveSignalFromProvider(working);
  const sideFromForecast =
    fromProvider.direction != null ? normSide(fromProvider.direction) : /** @type {string} */ ('—');
  const sideFromLegacy = normSide(
    working.recommendation ??
      sigEff?.recommendation ??
      sigEff?.forecast ??
      sigEff?.signal ??
      sigEff?.side ??
      sigEff?.prediction,
  );
  const side =
    fromProvider.direction != null && sideFromForecast !== '—'
      ? sideFromForecast
      : sideFromLegacy;
  const prediction =
    side === 'PLAYER'
      ? { label: /** @type {const} */ ('PLAYER'), color: /** @type {const} */ ('blue') }
      : side === 'BANKER'
        ? { label: /** @type {const} */ ('BANKER'), color: /** @type {const} */ ('red') }
        : side === 'TIE'
          ? { label: /** @type {const} */ ('TIE'), color: /** @type {const} */ ('amber') }
          : { label: /** @type {const} */ ('—'), color: /** @type {const} */ ('red') };

  const recommendation =
    side === 'PLAYER' || side === 'BANKER' ? side : side === 'TIE' ? 'TIE' : side === '—' ? '—' : 'UNKNOWN';

  const idVal = working.id ?? working.signalId ?? sigEff?.id ?? sigEff?.signalId;
  const resolvedMesa = resolveMesaFromPayload(working);
  const resolvedRound = resolveRoundFromPayload(working);
  const correlationKey = correlationKeyFromResolvedContext(working, idVal, resolvedMesa, resolvedRound);

  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_SIGNAL_NORMALIZE === '1') {
    console.log('SIGNAL NORMALIZED:', { mesa: resolvedMesa, round: resolvedRound, correlationKey });
  }

  const ts =
    working.serverTs != null
      ? (() => {
          try {
            return new Date(Number(working.serverTs)).toLocaleTimeString();
          } catch {
            return new Date().toLocaleTimeString();
          }
        })()
      : new Date().toLocaleTimeString();

  const algorithmRaw =
    fromProvider.signalName ??
    working.nombre_algoritmo ??
    sigEff?.nombre_algoritmo ??
    sig?.nombre_algoritmo ??
    working.algorithm ??
    sig?.algorithm ??
    working.algoritmo ??
    working.patternName ??
    null;
  const algorithm =
    algorithmRaw != null && String(algorithmRaw).trim() !== '' ? String(algorithmRaw).trim() : '—';

  const roundNum = contractRoundWithCkFallback(resolvedRound, working.correlationKey, correlationKey);
  const base = {
    mesa: resolvedMesa,
    recommendation,
    predictionLabel: prediction.label,
    predictionColor: prediction.color,
    martingale: `M${working.martingale ?? sigEff?.martingale ?? sig?.martingale ?? 0}`,
    martingaleLevel: Number(working.martingale ?? sigEff?.martingale ?? sig?.martingale ?? 0) || 0,
    round: roundNum,
    id: idVal != null ? String(idVal) : null,
    correlationKey: correlationKey || null,
    timestamp: ts,
    serverTs: working.serverTs,
    algorithm,
    forecast6: forecastSixFromSignal(
      sigEff
        ? {
            ...working,
            vector_forecast:
              working.vector_forecast ?? sigInner?.vector_forecast ?? sigEff.vector_forecast ?? sig?.vector_forecast,
            forecast: working.forecast ?? sigInner?.forecast ?? sigEff.forecast ?? sig?.forecast,
          }
        : working,
    ),
  };
  const classification = classifySignal(base);
  const out = { ...base, classification };
  if (working.providerPayload != null) {
    out.providerPayload = working.providerPayload;
  }
  return out;
}

/**
 * @param {Record<string, unknown>} signal
 */
export function formatSignal(signal) {
  if (isAdminRawMode()) {
    if (signal != null && typeof signal === 'object' && !Array.isArray(signal)) {
      return { ...signal, ...buildSignalDisplayLayer(signal) };
    }
    return { _raw: signal };
  }
  return buildSignalDisplayLayer(signal);
}

/**
 * @param {Record<string, unknown>} result
 * @param {PredLabel | string | null | undefined} predictedLabel
 */
function buildResultDisplayLayer(result, predictedLabel) {
  const baseIn =
    result != null && typeof result === 'object' && !Array.isArray(result)
      ? /** @type {Record<string, unknown>} */ ({ ...result })
      : /** @type {Record<string, unknown>} */ ({});
  const { payload: working } = applyCanonicalModeToPayload(baseIn);

  logCanonicalAudit(working, 'formatResult');
  const sdRaw = working.scoreDetail != null && typeof working.scoreDetail === 'object' ? working.scoreDetail : null;
  const winnerNorm = normSide(
    (sdRaw && 'ganador' in sdRaw && sdRaw.ganador != null ? sdRaw.ganador : null) ??
      working.ganador ??
      working.resultado ??
      working.result,
  );
  const pred =
    predictedLabel === 'PLAYER' || predictedLabel === 'BANKER' ? predictedLabel : null;

  let versus = '—';
  if (pred && winnerNorm && winnerNorm !== '—') {
    if (winnerNorm === 'TIE') versus = 'TIE';
    else versus = pred === winnerNorm ? 'WIN' : 'LOSS';
  }

  const serverWin = working.winStatus === true;
  const serverLoss = working.winStatus === false;

  /** Preferir criterio de servidor si existe; empate explícito; si no, heurística vs predicción. */
  let verdict = '—';
  if (winnerNorm === 'TIE' && (versus === 'TIE' || pred)) verdict = 'TIE';
  else if (serverWin) verdict = 'WIN';
  else if (serverLoss) verdict = 'LOSS';
  else if (versus === 'WIN' || versus === 'LOSS') verdict = versus;
  else if (versus === 'TIE') verdict = 'TIE';

  const verdictTone =
    verdict === 'WIN' ? 'win' : verdict === 'LOSS' ? 'loss' : verdict === 'TIE' ? 'tie' : 'neutral';

  const rawHist = working.historial ?? working.history;
  const historial = Array.isArray(rawHist) ? rawHist : [];

  const idVal = working.signalId ?? working.id;
  const resolvedMesa = resolveMesaFromPayload(working);
  const resolvedRound = resolveRoundFromPayload(working);
  const correlationKey = correlationKeyFromResolvedContext(working, idVal, resolvedMesa, resolvedRound);

  const winStatusBool =
    working.winStatus === true || working.winStatus === 'true' || working.winStatus === 1 || working.winStatus === '1'
      ? true
      : working.winStatus === false || working.winStatus === 'false' || working.winStatus === 0 || working.winStatus === '0'
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

  const miForVista = pickMesaInfoRawFromPayload(working);
  const mdRoot = pickMartingalaDataRoot(working);
  const vistaLabExtras = buildVistaLabExtras(miForVista, mdRoot);

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
      : mesaInfoFromRaw(working.mesa_info);

  const roundNum = contractRoundWithCkFallback(resolvedRound, working.correlationKey, correlationKey);

  /** @type {Record<string, unknown>} */
  const resultRow = {
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
    serverTs: working.serverTs,
    outcome,
    tiempo: (() => {
      if (working.serverTs == null) return new Date().toLocaleTimeString();
      try {
        return new Date(Number(working.serverTs)).toLocaleTimeString();
      } catch {
        return '—';
      }
    })(),
    scoreDetail,
    mesa_info,
    vistaLabExtras,
  };
  if (working.providerPayload != null) {
    resultRow.providerPayload = working.providerPayload;
  }
  return resultRow;
}

/**
 * Fila legible para tabla de resultados + comparación vs última predicción conocida de la mesa.
 * @param {Record<string, unknown>} result
 * @param {PredLabel | string | null | undefined} predictedLabel — última predicción (PLAYER/BANKER)
 */
export function formatResult(result, predictedLabel) {
  if (isAdminRawMode()) {
    if (result != null && typeof result === 'object' && !Array.isArray(result)) {
      return { ...result, ...buildResultDisplayLayer(result, predictedLabel) };
    }
    return { _raw: result };
  }
  return buildResultDisplayLayer(result, predictedLabel);
}

export { resolveRoundFromProvider } from './resolveRoundFromProvider.js';
export { mapForecast, resolveSignalFromProvider } from './resolveSignalFromProvider.js';
export { applyCanonicalModeToPayload, extractCanonicalFields, logCanonicalAudit } from '@/utils/extractCanonicalFields.js';
