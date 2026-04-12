import { resolveTestEmitIntervalMs } from './relayAdminSignalsToClients.js';

/**
 * Estado no secreto del relay (para GET /api/admin/signals/config y depuración).
 * No incluye claves ni URLs completas con credenciales.
 */
export function getAdminSignalsRelayDiagnostics() {
  const key = String(process.env.EXTERNAL_SIGNALS_API_KEY || '').trim();
  const wsRaw = String(process.env.EXTERNAL_SIGNALS_WS || process.env.EXTERNAL_SIGNALS_URL || '').trim();
  const demoForced = String(process.env.GPULSE_DEMO_MODE ?? '0').trim() === '1';
  const demoFallbackMs = Math.max(0, Number(process.env.GPULSE_DEMO_FALLBACK_MS ?? '0'));
  const testMs = resolveTestEmitIntervalMs(Boolean(key));

  /** @type {string[]} */
  const hints = [];
  if (!key) {
    hints.push(
      'EXTERNAL_SIGNALS_API_KEY ausente: el bridge no se conecta al proveedor Winxplay; no hay señales reales en /admin-signals.',
    );
  }
  if (demoForced) {
    hints.push(
      'GPULSE_DEMO_MODE=1 fuerza el motor demo en servidor; para solo datos reales del proveedor, usa GPULSE_DEMO_MODE=0.',
    );
  }
  if (demoFallbackMs > 0 && !demoForced) {
    hints.push(
      `GPULSE_DEMO_FALLBACK_MS=${demoFallbackMs}: si el upstream calla, puede arrancar el demo tras silencio.`,
    );
  }
  if (testMs > 0) {
    hints.push(
      `Test emit activo (${testMs} ms): además del proveedor verás señales sintéticas (ADMIN_SIGNALS_TEST_EMIT_*).`,
    );
  }

  let upstreamHostHint = '';
  if (wsRaw) {
    try {
      const u = new URL(wsRaw.indexOf('://') === -1 ? `wss://${wsRaw}` : wsRaw);
      upstreamHostHint = u.host;
    } catch {
      upstreamHostHint = '(invalid URL)';
    }
  } else {
    upstreamHostHint = '(default en código)';
  }

  return {
    upstreamApiKeyConfigured: key.length > 0,
    upstreamWsHostHint: upstreamHostHint,
    gpulseDemoModeForced: demoForced,
    demoFallbackMsActive: !demoForced && demoFallbackMs > 0,
    demoFallbackMs,
    testEmitIntervalMs: testMs,
    hints,
  };
}
