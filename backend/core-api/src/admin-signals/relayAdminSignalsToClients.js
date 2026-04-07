import { buildAdminSignalsClientPayload } from './buildAdminSignalsClientPayload.js';
import { assertAdminSignalPayloadSize, prepareAdminSignalsClientEmit } from './signalPayloadValidate.js';
import { adminSignalsFlowTrace, summarizePayloadForFlow } from './signalFlowDebug.js';
import { getSignalStreamInterpreter } from './signalStreamInterpreter.js';
import { getSignalSessionTracker } from './signalSessionTracker.js';

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
 * @param {{ source?: string }} [meta]
 */
export function relayAdminSignalsToClients(ctx, type, payload, meta = {}) {
  const { io, processor, logger } = ctx;
  const ts = Date.now();
  const source = meta.source || 'relay';

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

  const forClient = buildAdminSignalsClientPayload(type, payload);
  if (!forClient) {
    logger?.warn?.('admin_signals_client_build_skip', { type, source });
    return { ok: false, reason: 'client_payload_build_failed' };
  }
  const clientEmit = prepareAdminSignalsClientEmit(type, forClient);
  if (!clientEmit.ok) {
    logger?.warn?.('admin_signals_client_emit_skip', { type, reason: clientEmit.reason, source });
    adminSignalsFlowTrace(logger, 'relay_client_emit_skipped', { type, reason: clientEmit.reason, source });
    return { ok: false, reason: clientEmit.reason };
  }

  const nsp = io.of('/admin-signals');
  const clientCount =
    nsp.sockets && typeof nsp.sockets.size === 'number' ? nsp.sockets.size : /** @type {any} */ (nsp).length || 0;

  console.log('[EMIT CHECK]', { clients: clientCount });

  if (clientCount === 0) {
    console.warn('❌ NO HAY FRONTEND CONECTADO');
  }

  const out = clientEmit.payload;
  nsp.emit(type, out);
  nsp.emit('admin_signal_frame', { type, payload: out, ts: Date.now() });
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
