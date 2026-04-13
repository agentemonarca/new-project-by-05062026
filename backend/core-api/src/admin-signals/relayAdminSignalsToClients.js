import { extractSupplierResult, buildCorrelationKey } from '../core/provider-contract.js';
import { normalizeProviderEvent } from '../core/provider-normalizer.js';
import { buildAdminSignalsClientPayload } from './buildAdminSignalsClientPayload.js';
import { assertAdminSignalPayloadSize, prepareAdminSignalsClientEmit } from './signalPayloadValidate.js';
import { adminSignalsFlowTrace, summarizePayloadForFlow } from './signalFlowDebug.js';
import { getSignalStreamInterpreter } from './signalStreamInterpreter.js';
import { getSignalSessionTracker } from './signalSessionTracker.js';
import {
  analyzeNewResultPayload,
  prevalidateRelayNewResult,
  recordSignalForResultAnalysis,
  validateRelayResultPredictionOrThrow,
} from './resultRealAnalysis.js';
import { logResultLostAt } from './resultFullTrace.js';
import { isAdminSignalsFullFlowEnabled, recordFullFlowRow } from './providerFullFlowCapture.js';

/** JSON máximo del bloque `providerPayload` (clon del cuerpo antes del sobre Phase 3). */
const MAX_PROVIDER_PAYLOAD_JSON_BYTES = 12_000;

/**
 * Clon JSON-safe del payload tal cual entró al relay (p. ej. `dashboardUpdate` anidado).
 * Si excede el tope, devuelve metadatos + vista parcial UTF-8 segura.
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
export function snapshotProviderPayloadForClient(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  let clone;
  try {
    clone = JSON.parse(JSON.stringify(raw));
  } catch {
    return null;
  }
  let serialized = '';
  try {
    serialized = JSON.stringify(clone);
  } catch {
    return null;
  }
  const bytes = Buffer.byteLength(serialized, 'utf8');
  if (bytes <= MAX_PROVIDER_PAYLOAD_JSON_BYTES) return /** @type {Record<string, unknown>} */ (clone);
  const buf = Buffer.from(serialized, 'utf8');
  let cut = Math.max(0, MAX_PROVIDER_PAYLOAD_JSON_BYTES - 96);
  let slice = buf.subarray(0, cut);
  while (slice.length > 0 && (slice[slice.length - 1] & 0xc0) === 0x80) {
    slice = slice.subarray(0, slice.length - 1);
  }
  const preview = slice.toString('utf8');
  return {
    _providerPayloadFormat: 'json_truncated',
    _providerPayloadBytes: bytes,
    _providerPayloadIncludedBytes: slice.length,
    _providerPayloadPreview: `${preview}\n…`,
  };
}

/** Máximo de NEW_RESULT retenidos cuando no hay clientes en `/admin-signals`. */
const MAX_PENDING_RESULTS = 50;

/** @type {any[]} NEW_RESULT listos para emitir (FIFO), solo si se saltó el emit por `clients === 0`. */
let pendingResults = [];

/** @param {unknown} out */
function bufferPendingResult(out) {
  let copy;
  try {
    copy = structuredClone(out);
  } catch {
    try {
      copy = JSON.parse(JSON.stringify(out));
    } catch {
      copy = out;
    }
  }
  pendingResults.push(copy);
  if (pendingResults.length > MAX_PENDING_RESULTS) {
    pendingResults = pendingResults.slice(-MAX_PENDING_RESULTS);
  }
}

/**
 * Emite al socket todos los resultados pendientes y vacía el buffer.
 * @param {import('socket.io').Socket} socket
 * @returns {number} cantidad emitida
 */
export function flushBufferedAdminResultsToSocket(socket) {
  const count = pendingResults.length;
  if (count === 0) return 0;
  for (const payload of pendingResults) {
    socket.emit('NEW_RESULT', payload);
  }
  pendingResults = [];
  console.log('📤 REPLAY BUFFERED RESULTS', count);
  return count;
}

/** Último NEW_RESULT (solo meta) para alinear señales de prueba. */
let _lastClientResultMeta =
  /** @type {null | { mesa?: string, round?: string | number, correlationKey?: string, signalId?: string }} */ (null);
/** Último NEW_RESULT payload completo emitido al cliente (para replay). */
let _lastClientResultPayload = /** @type {null | any} */ (null);
/** Último NEW_SIGNAL emitido al cliente (para replay al conectar tarde). */
let _lastClientSignal = /** @type {null | any} */ (null);

export function getLastClientSignalForReplay() {
  return _lastClientSignal;
}

export function getLastClientResultForReplay() {
  return _lastClientResultPayload;
}

export function getLastClientResultForTest() {
  return _lastClientResultMeta;
}

/**
 * Interval (ms) for legacy local test emitter in `attachAdminSignalsIo`. **0 = disabled.**
 * Requires `ADMIN_SIGNALS_TEST_EMIT_ALWAYS=1` and positive `ADMIN_SIGNALS_TEST_EMIT_MS`.
 * Default: off (real provider only).
 *
 * @param {boolean} _hasUpstreamKey — reserved (legacy callers)
 * @returns {number}
 */
export function resolveTestEmitIntervalMs(_hasUpstreamKey) {
  const always = String(process.env.ADMIN_SIGNALS_TEST_EMIT_ALWAYS ?? '0').trim() === '1';
  if (!always) return 0;
  const rawMs = process.env.ADMIN_SIGNALS_TEST_EMIT_MS;
  const ms = rawMs === undefined || rawMs === '' ? 0 : Math.max(0, Number(rawMs));
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Ingest + emite a `/admin-signals` (mismo camino que relay upstream).
 *
 * @param {{
 *   io: import('socket.io').Server,
 *   processor: { ingestNewSignal: Function, ingestNewResult: Function },
 *   logger: object,
 * }} ctx
 * @param {'NEW_SIGNAL' | 'NEW_RESULT'} type
 * @param {unknown} payload
 * @param {{ source?: string, providerSnapshot?: Record<string, unknown> | null, rawOriginal?: unknown | null }} [meta]
 */
export function relayAdminSignalsToClients(ctx, type, payload, meta = {}) {
  const { io, processor, logger } = ctx;
  const ts = Date.now();
  const source = meta.source || 'relay';
  const traceOn = String(process.env.ADMIN_SIGNALS_TRACE ?? '').trim() === '1';

  /** Only real relay paths; blocks gpulse_demo, test_emit, and any unknown meta.source. */
  const ALLOWED_RELAY_SOURCES = new Set(['engine_pass', 'relay']);
  if (!ALLOWED_RELAY_SOURCES.has(source)) {
    console.warn('🚫 BLOCKED RELAY (source not allowed)', { type, source, allowed: ['engine_pass', 'relay'] });
    return { ok: false, reason: 'blocked_disallowed_source', blocked: true };
  }

  adminSignalsFlowTrace(logger, 'relay_on_admin_event', {
    type,
    ts,
    source,
    summary: summarizePayloadForFlow(payload),
  });

  const sizeCheck = assertAdminSignalPayloadSize(payload, logger);
  if (!sizeCheck.ok) {
    if (type === 'NEW_RESULT') {
      console.error('❌ RELAY SKIPPED RESULT', '(payload_size)', payload);
      logResultLostAt('RELAY');
    }
    adminSignalsFlowTrace(logger, 'relay_payload_rejected', { type, reason: sizeCheck.reason, source });
    return { ok: false, reason: sizeCheck.reason };
  }

  if (type === 'NEW_RESULT') {
    const pv = prevalidateRelayNewResult(payload);
    if (!pv.ok) {
      console.error('❌ PREVALIDATE FAILED', pv.reason);
      console.error('❌ RELAY SKIPPED RESULT', pv.reason, payload);
      adminSignalsFlowTrace(logger, 'relay_new_result_prevalidate_skip', { reason: pv.reason, source });
      logger?.warn?.('relay_new_result_prevalidate_skip', { reason: pv.reason, source });
      return { ok: true, skipped: true, reason: pv.reason };
    }
    try {
      validateRelayResultPredictionOrThrow(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'CRITICAL_MISMATCH') {
        console.error('❌ RELAY SKIPPED RESULT', 'CRITICAL_MISMATCH', payload);
        logger?.error?.('CRITICAL_MISMATCH', { source, type });
        adminSignalsFlowTrace(logger, 'relay_critical_mismatch', { source, type });
        console.error('[RELAY] CRITICAL_MISMATCH — skip ingest/emit');
        return { ok: false, reason: 'CRITICAL_MISMATCH' };
      }
      throw e;
    }
  }

  /** @type {boolean} */
  let ingested = false;
  try {
    if (type === 'NEW_SIGNAL') ingested = processor.ingestNewSignal(payload);
    else if (type === 'NEW_RESULT') ingested = processor.ingestNewResult(payload);
    else ingested = false;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger?.warn?.('admin_signals_processor_error', { message: msg, source });
    adminSignalsFlowTrace(logger, 'processor_ingest_error', { type, message: msg, source });
    return { ok: false, reason: msg };
  }
  if (!ingested) {
    if (type === 'NEW_RESULT') {
      let correlationKey = '(unknown)';
      try {
        const res = extractSupplierResult(payload);
        if (res && typeof res === 'object' && !Array.isArray(res)) {
          correlationKey = buildCorrelationKey(/** @type {Record<string, unknown>} */ (res));
        }
      } catch {
        /* keep unknown */
      }
      console.error('❌ RELAY SKIPPED RESULT', 'processor_deduped_or_false', { source });
      console.error('❌ PROCESSOR REJECTED RESULT', correlationKey);
      logResultLostAt('PROCESSOR');
    }
    adminSignalsFlowTrace(logger, 'relay_skip_emit_deduped', { type, source });
    return { ok: true, deduped: true };
  }
  adminSignalsFlowTrace(logger, 'processor_ingest_ok', { type, source });

  try {
    if (type === 'NEW_SIGNAL') recordSignalForResultAnalysis(payload);
    if (type === 'NEW_RESULT') analyzeNewResultPayload(payload, { logger });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger?.warn?.('result_real_analysis_error', { message: msg, type, source });
  }

  const baseClient = buildAdminSignalsClientPayload(type, payload, meta.providerSnapshot);
  if (!baseClient) {
    if (type === 'NEW_RESULT') {
      console.error('❌ RELAY SKIPPED RESULT', 'client_payload_build_failed', payload);
      logResultLostAt('RELAY');
    }
    logger?.warn?.('admin_signals_client_build_skip', { type, source });
    return { ok: false, reason: 'client_payload_build_failed' };
  }
  const unified = normalizeProviderEvent(payload);
  const snap = meta.providerSnapshot;
  /** @type {Record<string, unknown>} */
  let forClient;
  if (type === 'NEW_SIGNAL') {
    const can =
      baseClient && typeof baseClient === 'object' && 'canonical' in baseClient
        ? /** @type {Record<string, unknown>} */ (baseClient).canonical
        : null;
    /** Incluir siempre campos planos de `buildAdminSignalsClientPayload` (mesa, recommendation, …).
     * Antes solo se enviaba `supplier` + `canonical` opcional → `missing_signal_fields` y cero emisión al socket. */
    forClient =
      baseClient != null && typeof baseClient === 'object' && !Array.isArray(baseClient)
        ? { .../** @type {Record<string, unknown>} */ (baseClient) }
        : {};
    if (snap != null && typeof snap === 'object') {
      forClient.supplier = snap;
    }
    if (can != null && typeof can === 'object') {
      forClient.canonical = can;
    }
  } else {
    forClient = { ...baseClient };
    if (snap != null && typeof snap === 'object') {
      forClient.providerPayload = snap;
    }
  }
  if (unified != null && forClient != null && typeof forClient === 'object' && !Array.isArray(forClient)) {
    /** @type {Record<string, unknown>} */ (forClient).providerNormalized = unified;
  }
  if (meta.rawOriginal !== undefined && forClient != null && typeof forClient === 'object' && !Array.isArray(forClient)) {
    /** @type {Record<string, unknown>} */ (forClient).rawOriginal = meta.rawOriginal;
  }
  if (forClient != null && typeof forClient === 'object' && !Array.isArray(forClient)) {
    /** @type {Record<string, unknown>} */ (forClient).relaySource = source;
    /** @type {Record<string, unknown>} */ (forClient).source = source;
  }
  let clientEmit = prepareAdminSignalsClientEmit(type, forClient);
  if (
    !clientEmit.ok &&
    clientEmit.reason === 'client_emit_too_large' &&
    forClient != null &&
    typeof forClient === 'object' &&
    !Array.isArray(forClient) &&
    'rawOriginal' in forClient
  ) {
    adminSignalsFlowTrace(logger, 'relay_client_emit_retry_without_raw_original', {
      type,
      source,
      bytes: clientEmit.bytes,
    });
    delete /** @type {Record<string, unknown>} */ (forClient).rawOriginal;
    clientEmit = prepareAdminSignalsClientEmit(type, forClient);
  }
  if (
    !clientEmit.ok &&
    snap != null &&
    clientEmit.reason === 'client_emit_too_large'
  ) {
    adminSignalsFlowTrace(logger, 'relay_client_emit_retry_without_provider_payload', {
      type,
      source,
      bytes: clientEmit.bytes,
    });
    if (type === 'NEW_SIGNAL') {
      const canRetry =
        baseClient && typeof baseClient === 'object' && 'canonical' in baseClient
          ? /** @type {Record<string, unknown>} */ (baseClient).canonical
          : null;
      forClient =
        baseClient != null && typeof baseClient === 'object' && !Array.isArray(baseClient)
          ? { .../** @type {Record<string, unknown>} */ (baseClient) }
          : {};
      if (canRetry != null && typeof canRetry === 'object') {
        forClient.canonical = canRetry;
      }
    } else {
      forClient = { ...baseClient };
    }
    if (unified != null && forClient != null && typeof forClient === 'object' && !Array.isArray(forClient)) {
      /** @type {Record<string, unknown>} */ (forClient).providerNormalized = unified;
    }
    if (forClient != null && typeof forClient === 'object' && !Array.isArray(forClient)) {
      /** @type {Record<string, unknown>} */ (forClient).relaySource = source;
      /** @type {Record<string, unknown>} */ (forClient).source = source;
    }
    clientEmit = prepareAdminSignalsClientEmit(type, forClient);
  }
  if (!clientEmit.ok) {
    if (type === 'NEW_RESULT') {
      console.error('❌ RELAY SKIPPED RESULT', clientEmit.reason, payload);
      logResultLostAt('RELAY');
    }
    logger?.warn?.('admin_signals_client_emit_skip', { type, reason: clientEmit.reason, source });
    adminSignalsFlowTrace(logger, 'relay_client_emit_skipped', { type, reason: clientEmit.reason, source });
    return { ok: false, reason: clientEmit.reason };
  }

  const nsp = io.of('/admin-signals');
  const clientCount =
    nsp.sockets && typeof nsp.sockets.size === 'number' ? nsp.sockets.size : /** @type {any} */ (nsp).length || 0;

  if (traceOn) {
    console.log('TRACE: EMIT TO SOCKET', type);
    console.log('TRACE: CLIENTS CONNECTED', clientCount);
  }

  console.log('[EMIT CHECK]', { clients: clientCount });

  if (clientCount === 0) {
    console.warn('❌ NO HAY FRONTEND CONECTADO');
  }

  const out = clientEmit.payload;
  if (type === 'NEW_SIGNAL') {
    _lastClientSignal = out;
  }
  if (type === 'NEW_RESULT') {
    _lastClientResultPayload = out;
    _lastClientResultMeta = {
      mesa: out.mesa != null ? String(out.mesa) : undefined,
      round: out.round,
      correlationKey: out.correlationKey != null ? String(out.correlationKey) : undefined,
      signalId: out.signalId != null ? String(out.signalId) : out.id != null ? String(out.id) : undefined,
    };
  }

  try {
    getSignalStreamInterpreter().ingestRelay(type, out, {
      source,
      fromUpstream: source === 'upstream',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger?.warn?.('signal_stream_interpreter_relay', { message: msg, source, type });
  }
  try {
    getSignalSessionTracker().ingestNormalized(type, out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger?.warn?.('signal_session_tracker_relay', { message: msg, type });
  }

  if (clientCount === 0) {
    if (type === 'NEW_RESULT') {
      const ck = out?.correlationKey != null ? String(out.correlationKey) : '(no-ck)';
      bufferPendingResult(out);
      console.warn('⚠️ RESULT BUFFERED (no clients)', ck);
      console.log('NO CLIENTS — intérprete actualizado; resultado en cola para replay al conectar');
      return { ok: true, clientCount: 0, storedOnly: true, buffered: true };
    }
    console.log('NO CLIENTS — intérprete actualizado; sin emit NEW_* al socket');
    return { ok: true, clientCount: 0, storedOnly: true };
  }

  if (type === 'NEW_RESULT') {
    const correlationKey = out?.correlationKey != null ? String(out.correlationKey) : '(no-ck)';
    console.log('📤 TRY EMIT RESULT', correlationKey, out);
  }

  if (isAdminSignalsFullFlowEnabled()) {
    console.log('📤 RELAY OUT', {
      type,
      payload: out,
      source: out.source,
      correlationKey: out.correlationKey,
    });
    recordFullFlowRow({
      pipeline: 'relay_out',
      type,
      payload: out,
      source: out.source,
      correlationKey: out.correlationKey,
    });
  } else {
    console.log('📤 RELAY OUT', {
      source: out.source,
      correlationKey: out.correlationKey,
    });
  }

  nsp.emit(type, out);
  // Legacy mirrors (mismo `out` que NEW_*): solo si ADMIN_SIGNALS_EMIT_LEGACY_MIRRORS=1.
  // Producción: 0 → solo eventos nominales; sin duplicar ingesta en clientes.
  const legacyMirrors = String(process.env.ADMIN_SIGNALS_EMIT_LEGACY_MIRRORS ?? '0').trim() === '1';
  if (legacyMirrors) {
    nsp.emit('admin_signal_frame', { type, payload: out, ts: Date.now() });
    if (type === 'NEW_RESULT') {
      nsp.emit('dashboardUpdate', { type, payload: out, ts: Date.now() });
    }
  }
  return { ok: true, clientCount };
}
