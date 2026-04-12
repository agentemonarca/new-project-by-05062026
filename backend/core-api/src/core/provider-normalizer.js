/**
 * Resumen estable para `providerNormalized` en relay (observabilidad / UI).
 * @param {unknown} payload — payload ya normalizado para ingest (mesa, round, correlationKey, …)
 * @returns {Record<string, unknown> | null}
 */
export function normalizeProviderEvent(payload) {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const p = /** @type {Record<string, unknown>} */ (payload);
  return {
    mesa: p.mesa ?? null,
    round: p.round ?? null,
    correlationKey: p.correlationKey ?? null,
    providerSignalId: p.providerSignalId ?? null,
  };
}
