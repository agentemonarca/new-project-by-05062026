/**
 * Auditoría de mapeo canónico (solo logs en cliente; no afecta negocio).
 * Activar: `VITE_SIGNAL_AUDIT=1`
 */
export function isSignalAuditEnabled() {
  try {
    return String(import.meta.env?.VITE_SIGNAL_AUDIT ?? '').trim() === '1';
  } catch {
    return false;
  }
}
