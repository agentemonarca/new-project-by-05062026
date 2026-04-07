const MAX_ADMIN_SIGNAL_JSON_BYTES = 48_000;
const MAX_CLIENT_EMIT_BYTES = 10_000;

/**
 * Copia liviana para Socket.IO clientes: serverTs + validación de campos y tamaño &lt; 10KB.
 *
 * @param {string} type
 * @param {unknown} payload
 * @returns {{ ok: true, payload: Record<string, unknown> } | { ok: false, reason: string, bytes?: number }}
 */
export function prepareAdminSignalsClientEmit(type, payload) {
  const base =
    payload != null && typeof payload === 'object' && !Array.isArray(payload)
      ? { .../** @type {Record<string, unknown>} */ (payload) }
      : {};
  const out = { ...base, serverTs: Date.now() };

  if (type === 'NEW_SIGNAL') {
    const hasMesa = out.mesa != null && String(out.mesa).trim() !== '';
    const hasRec = out.recommendation != null && String(out.recommendation).trim() !== '';
    if (!hasMesa && !hasRec) return { ok: false, reason: 'missing_signal_fields' };
  } else if (type === 'NEW_RESULT') {
    if (out.mesa == null || String(out.mesa).trim() === '') return { ok: false, reason: 'missing_result_mesa' };
  }

  let n = 0;
  try {
    n = Buffer.byteLength(JSON.stringify(out), 'utf8');
  } catch {
    return { ok: false, reason: 'non_json' };
  }
  if (n > MAX_CLIENT_EMIT_BYTES) return { ok: false, reason: 'client_emit_too_large', bytes: n };
  return { ok: true, payload: out };
}

/**
 * @param {unknown} payload
 * @param {{ warn?: Function }} [logger]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function assertAdminSignalPayloadSize(payload, logger) {
  let n = 0;
  try {
    n = Buffer.byteLength(JSON.stringify(payload ?? null), 'utf8');
  } catch {
    logger?.warn?.('admin_signals_payload_non_json');
    return { ok: false, reason: 'non_json' };
  }
  if (n > MAX_ADMIN_SIGNAL_JSON_BYTES) {
    logger?.warn?.('admin_signals_payload_too_large', { bytes: n });
    return { ok: false, reason: 'too_large' };
  }
  return { ok: true };
}
