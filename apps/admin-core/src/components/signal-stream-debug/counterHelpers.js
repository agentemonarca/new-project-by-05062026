/** @param {unknown} x */
export function asCounterRecord(x) {
  return x != null && typeof x === 'object' && !Array.isArray(x)
    ? /** @type {Record<string, number>} */ (
        Object.fromEntries(
          Object.entries(/** @type {Record<string, unknown>} */ (x)).filter(
            ([, v]) => typeof v === 'number',
          ),
        )
      )
    : {};
}

/** @param {Record<string, number>} rec */
export function sortedCounterEntries(rec) {
  return Object.entries(rec).sort((a, b) => b[1] - a[1]);
}
