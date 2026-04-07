/**
 * Config mutable en memoria — sincronizada con Mongo (`signal_config`) cuando hay DB.
 * @type {{
 *   upstreamEnabled: boolean,
 *   delayMs: number,
 *   filters: { mesa: string },
 *   visibilityEnabled: boolean,
 *   martingaleDelta: number,
 * }}
 */
export const adminSignalsRuntime = {
  upstreamEnabled: true,
  delayMs: 0,
  filters: { mesa: '' },
  visibilityEnabled: true,
  martingaleDelta: 0,
};

/**
 * @param {Record<string, unknown>} patch
 */
export function patchAdminSignalsRuntime(patch) {
  if (patch.enabled !== undefined) adminSignalsRuntime.upstreamEnabled = Boolean(patch.enabled);

  const vis =
    patch.visibilityEnabled !== undefined
      ? patch.visibilityEnabled
      : patch.showSignalsToUsers !== undefined
        ? patch.showSignalsToUsers
        : undefined;
  if (vis !== undefined) adminSignalsRuntime.visibilityEnabled = Boolean(vis);

  const d =
    patch.delayMs !== undefined
      ? patch.delayMs
      : patch.artificialDelayMs !== undefined
        ? patch.artificialDelayMs
        : undefined;
  if (d !== undefined) adminSignalsRuntime.delayMs = Math.max(0, Number(d) || 0);

  const mg =
    patch.martingaleDelta !== undefined
      ? patch.martingaleDelta
      : patch.martingaleDisplayDelta !== undefined
        ? patch.martingaleDisplayDelta
        : undefined;
  if (mg !== undefined) adminSignalsRuntime.martingaleDelta = Number(mg) || 0;

  if (patch.filters && typeof patch.filters === 'object') {
    if (patch.filters.mesa !== undefined) {
      adminSignalsRuntime.filters.mesa = String(patch.filters.mesa ?? '').trim();
    }
  }
  return getPublicConfigFromRuntime();
}

export function getAdminSignalsRuntime() {
  return getPublicConfigFromRuntime();
}

/** Payload estable para API + frontend (nombres solicitados). */
export function getPublicConfigFromRuntime() {
  return {
    upstreamEnabled: adminSignalsRuntime.upstreamEnabled,
    showSignalsToUsers: adminSignalsRuntime.visibilityEnabled,
    visibilityEnabled: adminSignalsRuntime.visibilityEnabled,
    artificialDelayMs: adminSignalsRuntime.delayMs,
    delayMs: adminSignalsRuntime.delayMs,
    martingaleDelta: adminSignalsRuntime.martingaleDelta,
    filters: { ...adminSignalsRuntime.filters },
  };
}
