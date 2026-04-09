/**
 * @param {unknown} mg
 * @returns {string}
 */
export function getMartingaleLabel(mg) {
  const n = Number(mg);
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return 'DIRECT ENTRY';
  if (n === 1) return 'RECOVERY 1';
  if (n === 2) return 'RECOVERY 2';
  if (n >= 3) return 'HIGH RISK';
  return '—';
}

/**
 * Tailwind text color for martingale level (signal recovery step).
 * @param {unknown} mg
 * @returns {string}
 */
export function getMartingaleAccentClass(mg) {
  const n = Number(mg);
  if (!Number.isFinite(n)) return 'text-slate-400';
  if (n === 0) return 'text-blue-400';
  if (n === 1) return 'text-yellow-400';
  if (n === 2) return 'text-orange-400';
  if (n >= 3) return 'text-red-400';
  return 'text-slate-400';
}

/**
 * VistaLabs `señal` + plano proveedor (`martingale`).
 * @param {Record<string, unknown>} p
 * @returns {{ martingale: number, martingaleType: string }}
 */
export function deriveMartingaleFields(p) {
  const senal = p.señal ?? p['señal'];
  const senalObj =
    senal != null && typeof senal === 'object' && !Array.isArray(senal) ? /** @type {Record<string, unknown>} */ (senal) : null;
  const rawMg = senalObj?.martingale ?? p.martingale ?? 0;
  const n = Number(rawMg);
  const martingale = Number.isFinite(n) ? n : 0;
  const tipoRaw = senalObj?.tipo;
  const martingaleType =
    typeof tipoRaw === 'string' && tipoRaw.trim() !== '' ? tipoRaw.trim() : getMartingaleLabel(martingale);
  return { martingale, martingaleType };
}
