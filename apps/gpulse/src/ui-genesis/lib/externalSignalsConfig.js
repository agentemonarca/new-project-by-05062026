/**
 * Configuración GPulse — señales externas (Baccarat / Winxplay).
 *
 * SEGURIDAD (Important):
 * - Cualquier `VITE_*` se embebe en el bundle del navegador: NO es un secreto real de servidor.
 * - Producción: usar proxy backend que inyecte la apiKey en el socket del lado servidor, o
 *   emitir un token de corta vida firmado por tu API (pendiente — ver README en hook).
 * - Este módulo deja `resolveExternalSignalsApiKey()` preparado para extender con fetch al core.
 */

const DEFAULT_NAMESPACE_URL = 'wss://appserver.winxplay.io:3000/external-signals';

/** Activar integración directa al proveedor (apiKey en cliente / sessionStorage). */
export function isExternalSignalsEnabled() {
  return String(import.meta.env.VITE_EXTERNAL_SIGNALS_ENABLED || '').trim() === '1';
}

/**
 * Usar relay BFF core-api (`/admin-signals` + apiKey solo servidor).
 * Requiere core-api con `EXTERNAL_SIGNALS_API_KEY` y proxy Vite `/socket.io`.
 * En desarrollo queda activo por defecto (evita "Socket cliente: disabled"); desactivar: VITE_EXTERNAL_SIGNALS_BFF=0
 */
export function isExternalSignalsBffEnabled() {
  const v = String(import.meta.env.VITE_EXTERNAL_SIGNALS_BFF ?? '').trim();
  if (v === '0' || v.toLowerCase() === 'false' || v.toLowerCase() === 'off') return false;
  if (import.meta.env.DEV) return true;
  return v === '1';
}

/** Cualquier modo transport activo (directo o BFF). */
export function isExternalSignalsTransportActive() {
  return isExternalSignalsEnabled() || isExternalSignalsBffEnabled();
}

/** URL completa Socket.IO (incluye namespace path si aplica). */
export function getExternalSignalsSocketUrl() {
  const u = String(import.meta.env.VITE_EXTERNAL_SIGNALS_URL || DEFAULT_NAMESPACE_URL).trim();
  return u || DEFAULT_NAMESPACE_URL;
}

/**
 * Resuelve apiKey para `socket.auth`.
 * Orden: 1) sesión efímera (sessionStorage, solo para dev), 2) VITE_ (solo dev / demos), 3) vacío.
 * @returns {string}
 */
export function resolveExternalSignalsApiKey() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const k = sessionStorage.getItem('gpulse_external_signals_key');
      if (k && String(k).trim()) return String(k).trim();
    }
  } catch {
    /* ignore */
  }
  const envKey = String(import.meta.env.VITE_EXTERNAL_SIGNALS_API_KEY || '').trim();
  if (envKey) return envKey;
  return '';
}

/**
 * Si en el futuro el core-api expone GET /api/bff/external-signals/token (cookie session),
 * sustituir implementación aquí. Por ahora devuelve null.
 * @returns {Promise<string | null>}
 */
export async function fetchExternalSignalsApiKeyFromBackend(_apiBaseUrl) {
  return null;
}
