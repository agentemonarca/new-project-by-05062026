/** @param {unknown} x */
function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Immutable deep merge for nested config patches (undefined leaves preserve base).
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} patch
 */
export function deepMerge(base, patch) {
  if (!isPlainObject(patch)) return base;
  /** @type {Record<string, unknown>} */
  const out = { ...base };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = base[k];
    if (isPlainObject(pv) && isPlainObject(bv)) {
      out[k] = deepMerge(/** @type {Record<string, unknown>} */ (bv), /** @type {Record<string, unknown>} */ (pv));
    } else if (pv !== undefined) {
      out[k] = pv;
    }
  }
  return out;
}
