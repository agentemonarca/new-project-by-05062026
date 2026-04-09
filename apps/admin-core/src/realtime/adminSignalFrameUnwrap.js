/**
 * `admin_signal_frame` puede llegar como:
 * - Relay: `{ type: 'NEW_SIGNAL', payload: { mesa, correlationKey, … } }`
 * - Marco interpretado (stream / debug): `{ eventName: 'NEW_SIGNAL', layers: { raw: { … } } }`
 *
 * @param {unknown} msg
 * @returns {{ eventType: string, row: Record<string, unknown> }}
 */
export function unwrapLiveFrameMessage(msg) {
  if (msg == null || typeof msg !== 'object' || Array.isArray(msg)) {
    return { eventType: '', row: {} };
  }
  const m = /** @type {Record<string, unknown>} */ (msg);
  const envelopeType = String(m.type ?? m.eventName ?? '').trim();
  const payload = m.payload;
  const layers = m.layers;
  const rawLayer =
    layers != null && typeof layers === 'object' && !Array.isArray(layers)
      ? /** @type {Record<string, unknown>} */ (layers).raw
      : null;

  if (
    payload != null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    (rawLayer == null || typeof rawLayer !== 'object' || Array.isArray(rawLayer))
  ) {
    return { eventType: envelopeType, row: { .../** @type {Record<string, unknown>} */ (payload) } };
  }

  if (rawLayer != null && typeof rawLayer === 'object' && !Array.isArray(rawLayer)) {
    const et = envelopeType || String(m.eventName ?? '').trim();
    return { eventType: et, row: { .../** @type {Record<string, unknown>} */ (rawLayer) } };
  }

  if (payload != null && typeof payload === 'object' && !Array.isArray(payload)) {
    return { eventType: envelopeType, row: { .../** @type {Record<string, unknown>} */ (payload) } };
  }

  return { eventType: envelopeType, row: {} };
}
