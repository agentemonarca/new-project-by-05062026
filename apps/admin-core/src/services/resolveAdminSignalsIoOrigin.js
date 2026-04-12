/**
 * Origen del `Manager` Socket.IO (`/admin-signals`). Ver CANONICAL_ALIGNMENT_AUDIT.md.
 * Prioridad: `VITE_GPULSE_LAB_IO_ORIGIN` → `VITE_ADMIN_SIGNALS_IO_ORIGIN` → `window.location.origin` → `http://localhost:5050`.
 */
export function getAdminSignalsIoOrigin() {
  const a = String(import.meta.env.VITE_GPULSE_LAB_IO_ORIGIN ?? '').trim();
  if (a) return a.replace(/\/$/, '');
  const b = String(import.meta.env.VITE_ADMIN_SIGNALS_IO_ORIGIN ?? '').trim();
  if (b) return b.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:5050';
}
