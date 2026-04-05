import { haversineKm, isMerchantOpenNow } from './geo.js';

/**
 * @typedef {{
 *   maxDistanceKm: number | null,
 *   category: string | null,
 *   aigOnly: boolean,
 *   openNow: boolean,
 * }} LocalMarketplaceFilters
 */

/**
 * @param {import('./mockMerchants.js').LocalMerchant[]} merchants
 * @param {LocalMarketplaceFilters} filters
 * @param {{ lat: number, lng: number } | null} userLatLng
 * @returns {Array<import('./mockMerchants.js').LocalMerchant & { distanceKm: number | null }>}
 */
export function applyLocalMerchantFilters(merchants, filters, userLatLng) {
  let out = merchants.map((m) => ({
    ...m,
    distanceKm: userLatLng ? haversineKm(userLatLng.lat, userLatLng.lng, m.lat, m.lng) : null,
  }));

  if (filters.category) {
    out = out.filter((m) => m.category === filters.category);
  }
  if (filters.aigOnly) {
    out = out.filter((m) => m.acceptsAIG);
  }
  if (filters.openNow) {
    out = out.filter((m) => isMerchantOpenNow(m.schedule));
  }
  if (filters.maxDistanceKm != null && userLatLng) {
    out = out.filter((m) => m.distanceKm != null && m.distanceKm <= filters.maxDistanceKm);
  }

  out.sort((a, b) => {
    const da = a.distanceKm ?? 1e9;
    const db = b.distanceKm ?? 1e9;
    if (Math.abs(da - db) > 1e-6) return da - db;
    return b.popularity - a.popularity;
  });

  return out;
}
