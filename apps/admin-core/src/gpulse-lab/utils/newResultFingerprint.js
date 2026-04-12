import { buildLabCorrelationKey, normalizeCorrelationKey } from './labCorrelationKey.js';
import { extractContadorMartingalaFromResultPayload } from './supplierIntelExtract.js';

/**
 * Identidad temporal para trazabilidad (no entra en el dedupe lógico; ver {@link buildNewResultBaseFingerprint}).
 *
 * **Cadena principal:** `serverTs` → `createdAt` → `id`
 *
 * Si los tres faltan, se usan fallbacks solo para no perder trazas en payloads antiguos:
 * `signalId` / `betId` / `externalId` → `timestamp` / `ts`.
 *
 * @param {Record<string, unknown> | null | undefined} payload
 * @returns {string} cadena vacía si no hay ningún campo útil
 */
export function resolveResultTemporalId(payload) {
  if (payload == null || typeof payload !== 'object') return '';
  const p = /** @type {Record<string, unknown>} */ (payload);
  const primary = p.serverTs ?? p.createdAt ?? p.id;
  if (primary != null && String(primary).trim() !== '') {
    return String(primary).trim();
  }
  const idLike = p.signalId ?? p.betId ?? p.externalId;
  if (idLike != null && String(idLike).trim() !== '') {
    return String(idLike).trim();
  }
  const ts = p.timestamp ?? p.ts;
  if (ts != null && String(ts).trim() !== '') {
    return String(ts).trim();
  }
  return '';
}

/**
 * Último segmento de la huella base: evita colisiones cuando `vector_win` falta o está vacío.
 * `vector_win[last]` → `ganador` → literal `NA`.
 *
 * @param {Record<string, unknown>} p
 * @returns {string}
 */
function baseFingerprintOutcomeSegment(p) {
  const vw = p.vector_win;
  const rawLast =
    Array.isArray(vw) && vw.length > 0 ? String(vw[vw.length - 1]).trim() : '';
  const vectorWinLast = rawLast !== '' ? rawLast : undefined;
  const g = p.ganador;
  const ganadorPart = g != null && String(g).trim() !== '' ? String(g).trim() : undefined;
  return vectorWinLast ?? ganadorPart ?? 'NA';
}

/**
 * Huella estable para **deduplicar** NEW_RESULT: mesa/ronda + contador + resultado (último `vector_win`, o `ganador`, o `NA`).
 * Sin componente temporal — ver {@link resolveResultTemporalId}.
 *
 * @param {Record<string, unknown> | null | undefined} payload
 * @param {{ fallbackContador?: string | number | null }} [opts]
 * @returns {string}
 */
export function buildNewResultBaseFingerprint(payload, opts = {}) {
  if (payload == null || typeof payload !== 'object') return '';
  const p = /** @type {Record<string, unknown>} */ (payload);
  const ckRaw =
    p.correlationKey != null && String(p.correlationKey).trim() !== ''
      ? String(p.correlationKey).trim()
      : normalizeCorrelationKey(null, p.mesa, p.round) ?? buildLabCorrelationKey(p.mesa, p.round);
  const ck = String(ckRaw);

  const extracted = extractContadorMartingalaFromResultPayload(p);
  const cont =
    extracted !== undefined && extracted !== null
      ? extracted
      : p.contador_martingala;
  let contPart =
    cont != null && cont !== '' && String(cont).trim() !== '' ? String(cont).trim() : '';
  if (contPart === '' && opts.fallbackContador != null && String(opts.fallbackContador).trim() !== '') {
    contPart = String(opts.fallbackContador).trim();
  }

  const lastValue = baseFingerprintOutcomeSegment(p);

  return `${ck}-${contPart}-${lastValue}`;
}

/**
 * Huella completa para auditoría / logs: {@link buildNewResultBaseFingerprint} + segmento temporal.
 * El dedupe de motor y lab usa solo la base; el temporal se guarda aparte.
 *
 * @param {Record<string, unknown> | null | undefined} payload
 * @param {{ fallbackContador?: string | number | null }} [opts]
 * @returns {string}
 */
export function buildNewResultFingerprint(payload, opts = {}) {
  const base = buildNewResultBaseFingerprint(payload, opts);
  const temporal = resolveResultTemporalId(
    payload != null && typeof payload === 'object' ? /** @type {Record<string, unknown>} */ (payload) : {},
  );
  if (!base) return temporal || '';
  return temporal ? `${base}-${temporal}` : base;
}
