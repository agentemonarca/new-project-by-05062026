/**
 * Fase 3 — Normalizador universal antes de `relayAdminSignalsToClients`:
 * resuelve `mesa` + `roundId` con una sola prioridad de campos, rechaza si faltan,
 * y fija identidad canónica en el payload (preservando el resto del cuerpo para processor/cliente).
 *
 * `correlationKey` en wire: `${mesa}|${roundId}` (spec Phase 3).
 */

import { normalizeCorrelationKey } from './correlationKeyNormalize.js';
import { readNestedDataSignal, resolveRoundFromProvider } from './signalNormalize.js';
import { relayAdminSignalsToClients, snapshotProviderPayloadForClient } from './relayAdminSignalsToClients.js';

/** Logs forenses Docker / ronda: `ADMIN_SIGNALS_PRENORMALIZE_LOG=1` */
function isPrenormalizeTraceOn() {
  return String(process.env.ADMIN_SIGNALS_PRENORMALIZE_LOG ?? '').trim() === '1';
}

/** @param {unknown} v */
function asRecord(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : null;
}

/** @param {...unknown} vals */
function pickFirst(...vals) {
  for (const x of vals) {
    if (x != null && String(x).trim() !== '') return x;
  }
  return null;
}

/**
 * @deprecated Prefer claves canónicas Phase 3 (`${mesa}|${roundId}`) vía payload.correlationKey.
 * Se mantiene export para llamadas legacy / tests que importen este módulo.
 */
export function buildAdminCorrelationKey(mesa, roundId) {
  const m = String(mesa ?? '').trim();
  const r = String(roundId ?? '').trim();
  return `${m}|${r}`;
}

/** Fallback tipo Date.now() acotado a &lt;= 1e9 para STRICT del cliente. */
export function fallbackRoundIdFromTimestamp() {
  return (Date.now() % 999_999_000) + 1;
}

function deepCloneJson(v) {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return {};
  }
}

/** Señal anidada: `data.signal` o `data.data.signal`. */
function resolveNestedSignal(r) {
  const { data, sig } = readNestedDataSignal(r);
  if (sig && Object.keys(sig).length > 0) return { data: data ?? {}, sig };
  const inner = data?.data != null && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : null;
  const sig2 =
    inner?.signal != null && typeof inner.signal === 'object' && !Array.isArray(inner.signal)
      ? /** @type {Record<string, unknown>} */ (inner.signal)
      : null;
  if (sig2) return { data: asRecord(data) ?? {}, sig: sig2 };
  return { data: data ?? {}, sig: asRecord(sig) ?? {} };
}

function stripIdsForMesaRoundCorrelation(obj) {
  const o = asRecord(obj);
  if (!o) return;
  delete o.id;
  delete o.signalId;
}

/** @param {Record<string, unknown>} r */
function stripNestedSignalIds(r) {
  const { data, sig } = readNestedDataSignal(r);
  if (sig) {
    delete sig.id;
    delete sig.signalId;
  }
  const d = asRecord(r.data);
  if (d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)) {
    const inner = /** @type {Record<string, unknown>} */ (d.data);
    const s = asRecord(inner.signal);
    if (s) {
      delete s.id;
      delete s.signalId;
    }
  }
}

function findMesaInfoInPayload(payload) {
  const r = asRecord(payload) ?? {};
  const d = asRecord(r.data) ?? {};
  const inner = asRecord(d.data) ?? {};
  const results =
    asRecord(inner.results) ?? asRecord(r.results) ?? asRecord(d.results) ?? /** @type {Record<string, unknown>} */ (null);
  if (!results) return null;
  return asRecord(results.mesa_info);
}

/**
 * Phase 3 — prioridad fija para roundId (null si no hay valor válido).
 * @param {unknown} payload
 * @returns {number | null}
 */
export function extractUniversalRoundId(payload) {
  const s = resolveRoundFromProvider(payload);
  if (s == null || s === '') return null;
  const n = Math.trunc(Number(s));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) return null;
  return n;
}

/**
 * Phase 3 — prioridad fija para mesa (null si vacío).
 * Incluye `results.mesa_info.nombre_mesa` por envelopes Winxplay reales (sin tocar upstream).
 * @param {unknown} payload
 */
export function extractUniversalMesa(payload) {
  const p = asRecord(payload);
  if (!p) return null;
  const miNested = p.data?.data?.results?.mesa_info?.nombre_mesa;
  const miFlat = p.data?.results?.mesa_info?.nombre_mesa;
  const v =
    p.mesa ??
    p.data?.mesa ??
    p.data?.signal?.nombre_mesa ??
    p.data?.data?.signal?.nombre_mesa ??
    p.data?.data?.results?.nombre_mesa ??
    miNested ??
    miFlat ??
    null;
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function logRawPayloadAtNormalizeEntry(type, payload) {
  const label = type === 'NEW_SIGNAL' ? '[RAW_SIGNAL]' : '[RAW_RESULT]';
  try {
    console.log(label, JSON.stringify(payload, null, 2));
  } catch {
    console.log(label, String(payload));
  }
}

/**
 * Salida estructurada tras `prepareAdminSignalsRelayPayload` (siempre).
 * Con `ADMIN_SIGNALS_PRENORMALIZE_LOG=1` añade `mesa_info.ronda_objetivo` y `data.signal.ronda_actual`.
 */
function logNormalizedWireSummary(payload) {
  const p = asRecord(payload) ?? {};
  const mesa = String(p.mesa ?? '').trim() || null;
  const roundId = p.roundId ?? p.round ?? p.ronda_actual ?? p.ronda ?? null;
  if (!isPrenormalizeTraceOn()) {
    console.log('[NORMALIZED]', { mesa, roundId });
    return;
  }
  const d = asRecord(p.data);
  const sig = d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal) ? d.signal : null;
  const nested_signal_ronda_actual =
    sig && 'ronda_actual' in sig ? /** @type {Record<string, unknown>} */ (sig).ronda_actual : undefined;
  const mi = findMesaInfoInPayload(p);
  const mesa_info_ronda_objetivo =
    mi && 'ronda_objetivo' in mi ? /** @type {Record<string, unknown>} */ (mi).ronda_objetivo : undefined;
  console.log('[NORMALIZED]', { mesa, roundId, mesa_info_ronda_objetivo, nested_signal_ronda_actual });
}

/**
 * @param {'NEW_SIGNAL' | 'NEW_RESULT'} type
 * @param {unknown} raw
 * @returns {{ ok: true, payload: Record<string, unknown> } | { ok: false, reason: string, detail?: string }}
 */
function buildUniversalRelayEnvelope(type, raw) {
  const base = deepCloneJson(raw);
  const r = asRecord(base) ?? {};

  const initialDataRef = asRecord(r.data);
  const sigFromR =
    initialDataRef?.signal != null && typeof initialDataRef.signal === 'object' && !Array.isArray(initialDataRef.signal)
      ? /** @type {Record<string, unknown>} */ (initialDataRef.signal)
      : null;
  const innerData =
    initialDataRef?.data != null && typeof initialDataRef.data === 'object' && !Array.isArray(initialDataRef.data)
      ? /** @type {Record<string, unknown>} */ (initialDataRef.data)
      : null;
  const sig2 =
    innerData?.signal != null && typeof innerData.signal === 'object' && !Array.isArray(innerData.signal)
      ? /** @type {Record<string, unknown>} */ (innerData.signal)
      : null;
  const preservedNewSignalId = pickFirst(r.id, r.signalId, sigFromR?.id, sigFromR?.signalId, sig2?.id, sig2?.signalId);
  const preservedResultSignalId = type === 'NEW_RESULT' ? pickFirst(r.signalId, r.id) : null;

  const mesa = extractUniversalMesa(r);
  const roundId = extractUniversalRoundId(r);

  if (mesa == null) {
    console.error('[REJECTED_INVALID]', 'UNIVERSAL_NO_MESA');
    return { ok: false, reason: 'UNIVERSAL_NO_MESA' };
  }
  if (roundId == null) {
    console.error('[REJECTED_INVALID]', 'UNIVERSAL_NO_ROUND');
    return { ok: false, reason: 'UNIVERSAL_NO_ROUND' };
  }

  const correlationKey = `${mesa}|${roundId}`;
  const timestamp = Date.now();

  const { data, sig } = resolveNestedSignal(r);
  if (sig && Object.keys(sig).length > 0) {
    sig.nombre_mesa = mesa;
    sig.ronda_actual = roundId;
    stripIdsForMesaRoundCorrelation(sig);
  }

  const dataOut = { ...data, ronda: roundId };
  if (data.signal === sig) {
    dataOut.signal = sig;
  }

  const out = {
    ...r,
    mesa,
    roundId,
    round: roundId,
    ronda: roundId,
    ronda_actual: roundId,
    correlationKey,
    timestamp,
    data: dataOut,
    ...(type === 'NEW_SIGNAL'
      ? {
          recommendation: pickFirst(
            r.recommendation,
            data.recommendation,
            sig.recommendation,
            sig.forecast,
            sig.signal,
            sig.side,
          ),
        }
      : {}),
  };

  stripIdsForMesaRoundCorrelation(out);
  stripNestedSignalIds(out);

  if (type === 'NEW_SIGNAL' && preservedNewSignalId != null && String(preservedNewSignalId).trim() !== '') {
    out.id = String(preservedNewSignalId).trim();
  }
  if (type === 'NEW_RESULT' && preservedResultSignalId != null && String(preservedResultSignalId).trim() !== '') {
    const v = String(preservedResultSignalId).trim();
    out.signalId = v;
    out.id = v;
  }

  return { ok: true, payload: out };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, payload: Record<string, unknown> } | { ok: false, reason: string, detail?: string }}
 */
export function prepareAdminSignalsRelayPayload(type, raw) {
  if (type === 'NEW_SIGNAL' || type === 'NEW_RESULT') {
    return buildUniversalRelayEnvelope(type, raw);
  }
  return { ok: true, payload: asRecord(raw) ?? {} };
}

/**
 * @param {{
 *   io: import('socket.io').Server,
 *   processor: object,
 *   logger: object,
 * }} ctx
 * @param {'NEW_SIGNAL' | 'NEW_RESULT'} type
 * @param {unknown} payload
 * @param {{ source?: string }} [meta]
 */
export function relayNormalizedAdminSignals(ctx, type, payload, meta = {}) {
  if (isPrenormalizeTraceOn()) {
    console.log('[PRE_NORMALIZE]', { type, source: meta?.source });
    logRawPayloadAtNormalizeEntry(type, payload);
  }
  const prep = prepareAdminSignalsRelayPayload(type, payload);
  if (!prep.ok) {
    console.error('[REJECTED_INVALID]', prep.reason, prep.detail ?? '');
    return { ok: false, rejected: true, reason: prep.reason };
  }
  if (prep.payload.correlationKey != null && String(prep.payload.correlationKey).trim() !== '') {
    const prev = String(prep.payload.correlationKey).trim();
    const n = normalizeCorrelationKey(prev);
    if (n != null && String(n).trim() !== '') {
      const nxt = String(n).trim();
      prep.payload.correlationKey = nxt;
      if (prev !== nxt) {
        console.log('[NORMALIZED_CK]', nxt);
      }
    }
  }
  const ck = prep.payload.correlationKey != null ? String(prep.payload.correlationKey) : '';
  const mesa = prep.payload.mesa != null ? String(prep.payload.mesa) : '';
  const rid = prep.payload.roundId;
  console.log('[NORMALIZED_FINAL]', mesa, rid, ck);
  logNormalizedWireSummary(prep.payload);
  return relayAdminSignalsToClients(ctx, type, prep.payload, {
    ...meta,
    providerSnapshot: snapshotProviderPayloadForClient(payload),
  });
}
