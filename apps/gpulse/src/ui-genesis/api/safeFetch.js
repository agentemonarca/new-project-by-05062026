/**
 * Wraps async API calls so failures return `fallback` instead of throwing.
 * Use in Zustand for dashboard loads — never hard-crash the UI on network/API errors.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {T | null} [fallback]
 * @param {(err: unknown) => void} [onError] — e.g. collect messages for banner
 * @returns {Promise<T | NonNullable<typeof fallback>>}
 */
export async function safeFetch(fn, fallback = null, onError) {
  try {
    const res = await fn();
    if (import.meta.env.DEV) {
      console.log('API response:', res);
    }
    return res;
  } catch (e) {
    console.error('API error:', e);
    onError?.(e);
    return fallback;
  }
}
