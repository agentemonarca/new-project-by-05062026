import { getDefaultMerchantSchedule, MERCHANT_CATEGORIES } from './mockMerchants.js';

/**
 * @typedef {{
 *   name: string,
 *   description: string,
 *   category: import('./mockMerchants.js').LocalMerchantCategory,
 *   address: string,
 *   lat: number | string,
 *   lng: number | string,
 *   acceptsAIG: boolean,
 * }} OnboardingStoreForm
 */

/**
 * @param {OnboardingStoreForm} form
 * @param {string | null | undefined} ownerWallet
 * @returns {import('./mockMerchants.js').LocalMerchant}
 */
export function buildMerchantFromOnboarding(form, ownerWallet) {
  const lat = Number(form.lat);
  const lng = Number(form.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Invalid coordinates');
  }
  const cat = MERCHANT_CATEGORIES.includes(form.category) ? form.category : 'retail';
  const id = `loc-usr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const seed = encodeURIComponent(id.slice(-12));

  const owner = ownerWallet && String(ownerWallet).trim() ? String(ownerWallet).trim() : undefined;

  return {
    id,
    kind: 'store',
    name: String(form.name || '').trim() || 'Untitled store',
    logo: `https://picsum.photos/seed/${seed}-mlogo/128/128`,
    coverImage: `https://picsum.photos/seed/${seed}-mcov/960/400`,
    description: String(form.description || '').trim(),
    category: cat,
    googleMapsLink: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    lat,
    lng,
    address: String(form.address || '').trim(),
    schedule: getDefaultMerchantSchedule(),
    acceptsAIG: Boolean(form.acceptsAIG),
    pricing: { label: 'Your listings', aig: 0, usd: 0 },
    rating: 4.5,
    reviewCount: 0,
    reviews: [],
    verified: false,
    popularity: 0.48,
    activityLevel: 'quiet',
    products: [],
    ownerWallet: owner,
    referrerWallet: owner,
  };
}

/**
 * @param {{
 *   name: string,
 *   priceUSD: number | string,
 *   priceAIG: number | string,
 *   image: string,
 *   description: string,
 * }} form
 * @returns {Omit<import('./mockMerchants.js').LocalProduct, 'id'>}
 */
export function buildProductFromOnboardingForm(form) {
  const usd = Number(form.priceUSD);
  const aig = Number(form.priceAIG);
  return {
    name: String(form.name || '').trim() || 'Item',
    priceUSD: Number.isFinite(usd) ? Math.max(0, usd) : 0,
    priceAIG: Number.isFinite(aig) ? Math.max(0, aig) : 0,
    image: String(form.image || '').trim() || undefined,
    description: String(form.description || '').trim() || undefined,
  };
}
