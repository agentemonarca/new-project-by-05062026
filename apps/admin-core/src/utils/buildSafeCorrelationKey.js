/**
 * Correlación segura: solo `mesa|round` o `id:<id real del proveedor>`.
 * No usar timestamps tipo Date.now como identidad de correlación.
 */

/**
 * Detecta IDs numéricos en rango típico de `Date.now()` (ms) — no válidos como correlación estable.
 * @param {unknown} v
 */
export function isEpochMsCorrelationId(v) {
  const s = String(v ?? '').trim();
  if (!/^\d{12,15}$/.test(s)) return false;
  const n = Number(s);
  if (!Number.isFinite(n)) return false;
  return n >= 1_700_000_000_000 && n <= 2_100_000_000_000;
}

/**
 * @param {{ mesa?: unknown, round?: unknown, providerId?: unknown }} o
 * @returns {string | null}
 */
export function buildSafeCorrelationKey({ mesa, round, providerId }) {
  const m = mesa != null ? String(mesa).trim() : '';
  const r = round != null ? String(round).trim() : '';
  if (m && r) {
    return `${m}|${r}`;
  }
  const pid = providerId != null ? String(providerId).trim() : '';
  if (pid !== '' && !isEpochMsCorrelationId(pid)) {
    return `id:${pid}`;
  }
  return null;
}
