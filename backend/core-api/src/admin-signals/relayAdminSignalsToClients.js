import { buildAdminSignalsClientPayload } from './buildAdminSignalsClientPayload.js';
import { assertAdminSignalPayloadSize, prepareAdminSignalsClientEmit } from './signalPayloadValidate.js';
import { adminSignalsFlowTrace, summarizePayloadForFlow } from './signalFlowDebug.js';
import { getSignalStreamInterpreter } from './signalStreamInterpreter.js';
import { getSignalSessionTracker } from './signalSessionTracker.js';

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
 * Ingest + emite a `/admin-signals` (mismo camino que relay upstream).
 *
 * @param {{
 *   io: import('socket.io').Server,
 *   processor: { ingestNewSignal: Function, ingestNewResult: Function },
 *   logger: object,
 * }} ctx
 * @param {'NEW_SIGNAL' | 'NEW_RESULT'} type
 * @param {unknown} payload
 * @param {{ source?: string, providerSnapshot?: Record<string, unknown> | null }} [meta]
 */
export function relayAdminSignalsToClients(ctx, type, payload, meta = {}) {
  const { io, processor, logger } = ctx;
  const ts = Date.now();
  const source = meta.source || 'relay';
  const traceOn = String(process.env.ADMIN_SIGNALS_TRACE ?? '').trim() === '1';

  adminSignalsFlowTrace(logger, 'relay_on_admin_event', {
    type,
    ts,
    source,
    summary: summarizePayloadForFlow(payload),
  });

  const sizeCheck = assertAdminSignalPayloadSize(payload, logger);
  if (!sizeCheck.ok) {
    adminSignalsFlowTrace(logger, 'relay_payload_rejected', { type, reason: sizeCheck.reason, source });
    return { ok: false, reason: sizeCheck.reason };
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
    adminSignalsFlowTrace(logger, 'relay_skip_emit_deduped', { type, source });
    return { ok: true, deduped: true };
  }
  adminSignalsFlowTrace(logger, 'processor_ingest_ok', { type, source });

  const baseClient = buildAdminSignalsClientPayload(type, payload);
  if (!baseClient) {
    logger?.warn?.('admin_signals_client_build_skip', { type, source });
    return { ok: false, reason: 'client_payload_build_failed' };
  }
  const snap = meta.providerSnapshot;
  /** @type {Record<string, unknown>} */
  let forClient = { ...baseClient };
  if (snap != null && typeof snap === 'object') {
    forClient.providerPayload = snap;
  }
  let clientEmit = prepareAdminSignalsClientEmit(type, forClient);
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
    forClient = { ...baseClient };
    clientEmit = prepareAdminSignalsClientEmit(type, forClient);
  }
  if (!clientEmit.ok) {
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
    try {
      console.log('EMITTING RESULT:', out);
    } catch {
      /* ignore */
    }
    _lastClientResultPayload = out;
    _lastClientResultMeta = {
      mesa: out.mesa != null ? String(out.mesa) : undefined,
      round: out.round,
      correlationKey: out.correlationKey != null ? String(out.correlationKey) : undefined,
      signalId: out.signalId != null ? String(out.signalId) : out.id != null ? String(out.id) : undefined,
    };
  }

  if (clientCount === 0) {
    console.log('NO CLIENTS — storing only');
    return { ok: true, clientCount: 0, storedOnly: true };
  }

  nsp.emit(type, out);
  nsp.emit('admin_signal_frame', { type, payload: out, ts: Date.now() });
  // Debug mirror: algunos clientes escuchan `dashboardUpdate` (shape tipo { type, payload }).
  // No sustituye los eventos NEW_SIGNAL/NEW_RESULT; solo visibilidad.
  if (type === 'NEW_RESULT') {
    nsp.emit('dashboardUpdate', { type, payload: out, ts: Date.now() });
  }
  if (source === 'test_emit') {
    console.log('🔥 TEST SIGNAL EMIT → enviado al panel');
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
  if (source === 'test_emit') {
    try {
      getSignalSessionTracker().ingestNormalized(type, out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger?.warn?.('signal_session_tracker_relay', { message: msg, type });
    }
  }
  return { ok: true, clientCount };
}

const DEFAULT_TEST_EMIT_MS = 3000;

/**
 * Test emit al panel: por defecto siempre activo (`ADMIN_SIGNALS_TEST_EMIT_ALWAYS` distinto de 0/false).
 * Desactivar: `ADMIN_SIGNALS_TEST_EMIT_ALWAYS=0` o `ADMIN_SIGNALS_TEST_EMIT_MS=0`.
 *
 * @param {boolean} _upstreamKeyPresent — reservado (no se requiere proveedor para test)
 * @returns {number} ms entre emisiones; 0 = desactivado
 */
export function resolveTestEmitIntervalMs(_upstreamKeyPresent) {
  const msRaw = String(process.env.ADMIN_SIGNALS_TEST_EMIT_MS ?? '').trim();
  const alwaysRaw = String(process.env.ADMIN_SIGNALS_TEST_EMIT_ALWAYS ?? '1').trim();
  const alwaysOn = alwaysRaw !== '0' && alwaysRaw.toLowerCase() !== 'false';

  if (!alwaysOn) return 0;
  if (msRaw === '0' || msRaw.toLowerCase() === 'false') return 0;

  const parsed = parseInt(msRaw, 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_TEST_EMIT_MS;
}
