/**
 * Relay `NEW_SIGNAL` al cliente: `{ supplier, canonical, providerNormalized, ... }`
 * → una fila plana para ingest (misma idea que `mergeRelayNewSignalForInterpreter` en core-api).
 * @param {unknown} msg
 */
export function mergeRelayNewSignalForConsumers(msg) {
  if (msg == null || typeof msg !== 'object' || Array.isArray(msg)) return msg;
  const b = /** @type {Record<string, unknown>} */ (msg);
  const sup = b.supplier;
  const can = b.canonical;

  /** @type {Record<string, unknown> | null} */
  let merged = null;
  if (can != null && typeof can === 'object' && !Array.isArray(can)) {
    const canObj = /** @type {Record<string, unknown>} */ (can);
    if (sup != null && typeof sup === 'object' && !Array.isArray(sup)) {
      merged = { .../** @type {Record<string, unknown>} */ (sup), ...canObj };
    } else {
      merged = { ...canObj };
    }
  } else if (sup != null && typeof sup === 'object' && !Array.isArray(sup)) {
    merged = { .../** @type {Record<string, unknown>} */ (sup) };
  }
  if (!merged) return msg;

  for (const k of ['providerNormalized', 'rawOriginal', 'providerPayload']) {
    if (k in b && b[k] !== undefined) merged[k] = b[k];
  }
  return merged;
}
