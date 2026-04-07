/**
 * Una muestra JSON por tipo de evento (primera recepción en el proceso) para documentar
 * el contrato real del proveedor sin inundar logs.
 *
 * Activar: `ADMIN_SIGNALS_LOG_RAW_PROVIDER_SAMPLE=1` (por defecto no imprime).
 */

const seen = /** @type {Record<string, boolean>} */ ({});

export function logRawProviderSampleOnce(kind, payload) {
  const on = ['1', 'true', 'yes'].includes(String(process.env.ADMIN_SIGNALS_LOG_RAW_PROVIDER_SAMPLE ?? '').toLowerCase());
  if (!on) return;
  if (seen[kind]) return;
  seen[kind] = true;
  try {
    console.log('📦 RAW PROVIDER SAMPLE:', JSON.stringify({ _event: kind, payload }, null, 2));
  } catch {
    console.log('📦 RAW PROVIDER SAMPLE:', JSON.stringify({ _event: kind, payload: String(payload) }, null, 2));
  }
}
