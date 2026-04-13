/** Same-origin in Vite dev — see `vite.config.js` `cursor-debug-session-log-spool`. */
export function getDebugIngestUrl() {
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    return '/__cursor-debug-ingest/ingest/51f231aa-e242-4655-9681-07fd48f227ae';
  }
  return 'http://127.0.0.1:7804/ingest/51f231aa-e242-4655-9681-07fd48f227ae';
}

/** DEV o `VITE_DEBUG_IA_REAL=1` — NDJSON vacío / sin payload en card theater. */
export function isIaRealExtractDebugEnabled() {
  return (
    Boolean(typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    String(import.meta.env?.VITE_DEBUG_IA_REAL ?? '').trim() === '1'
  );
}
