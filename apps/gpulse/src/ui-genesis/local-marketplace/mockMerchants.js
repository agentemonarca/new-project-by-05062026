/** Center of demo map (Dubai). */
export const DEFAULT_MAP_CENTER = Object.freeze({ lat: 25.2048, lng: 55.2708 });

/** @typedef {'tech' | 'food' | 'wellness' | 'retail' | 'services'} LocalMerchantCategory */
/** @typedef {'store' | 'offer'} LocalMerchantKind */
/** @typedef {'quiet' | 'busy' | 'hot'} ActivityLevel */

/**
 * @typedef {{ id: string, author: string, stars: number, text: string, at: string }} LocalReview
 */

/**
 * @typedef {{ id: string, name: string, priceUSD: number, priceAIG: number, image?: string, description?: string, volumeRule?: 'full' | 'staking' }} LocalProduct
 */

/**
 * @typedef {{
 *   tz?: string,
 *   slots: Array<{ d: number, open: string, close: string }>,
 * }} MerchantSchedule
 */

/**
 * @typedef {{
 *   id: string,
 *   kind: LocalMerchantKind,
 *   name: string,
 *   logo: string,
 *   coverImage: string,
 *   description: string,
 *   category: LocalMerchantCategory,
 *   googleMapsLink: string,
 *   lat: number,
 *   lng: number,
 *   address: string,
 *   schedule: MerchantSchedule,
 *   acceptsAIG: boolean,
 *   pricing: { label?: string, aig?: number, usd?: number },
 *   rating: number,
 *   reviewCount: number,
 *   reviews: LocalReview[],
 *   verified: boolean,
 *   popularity: number,
 *   activityLevel: ActivityLevel,
 *   products: LocalProduct[],
 *   referrerWallet?: string,
 *   ownerWallet?: string,
 * }} LocalMerchant
 */

/** @type {readonly LocalMerchantCategory[]} */
export const MERCHANT_CATEGORIES = Object.freeze(['tech', 'food', 'wellness', 'retail', 'services']);

const w = /** @type {const} */ ([
  { d: 1, open: '09:00', close: '23:00' },
  { d: 2, open: '09:00', close: '23:00' },
  { d: 3, open: '09:00', close: '23:00' },
  { d: 4, open: '09:00', close: '23:00' },
  { d: 5, open: '09:00', close: '23:59' },
  { d: 6, open: '10:00', close: '23:00' },
  { d: 0, open: '10:00', close: '22:00' },
]);

/** Default weekly hours (Dubai) — reuse for onboarding-created stores. */
export function getDefaultMerchantSchedule() {
  return /** @type {const} */ ({
    tz: 'Asia/Dubai',
    slots: [
      { d: 1, open: '09:00', close: '23:00' },
      { d: 2, open: '09:00', close: '23:00' },
      { d: 3, open: '09:00', close: '23:00' },
      { d: 4, open: '09:00', close: '23:00' },
      { d: 5, open: '09:00', close: '23:59' },
      { d: 6, open: '10:00', close: '23:00' },
      { d: 0, open: '10:00', close: '22:00' },
    ],
  });
}

/** Canonical seed data for the near-me map (bundled demo merchants). */
/** @type {LocalMerchant[]} */
export const SEED_LOCAL_MERCHANTS = [
  {
    id: 'loc-em-1',
    kind: 'store',
    name: 'Neon Circuit',
    logo: 'https://picsum.photos/seed/loc-neon-logo/128/128',
    coverImage: 'https://picsum.photos/seed/loc-neon-cover/960/400',
    description:
      'Creator tech, GPUs, and studio gear. Instant AIG settlement at checkout — no card rails for loyalty tiers.',
    category: 'tech',
    googleMapsLink: 'https://www.google.com/maps/search/?api=1&query=25.1972,55.2744',
    lat: 25.1972,
    lng: 55.2744,
    address: 'Trade Centre 2 — Dubai',
    schedule: { tz: 'Asia/Dubai', slots: [...w] },
    acceptsAIG: true,
    pricing: { label: 'Avg. checkout', aig: 920, usd: 135 },
    rating: 4.8,
    reviewCount: 312,
    verified: true,
    popularity: 0.94,
    activityLevel: 'hot',
    referrerWallet: '0x2222222222222222222222222222222222222222',
    reviews: [
      { id: 'r1', author: '0x71…b2', stars: 5, text: 'Split AIG + card worked flawlessly.', at: '2026-03-20' },
      { id: 'r2', author: 'sara.m', stars: 5, text: 'Staff verified wallet on-site.', at: '2026-03-15' },
    ],
    products: [
      {
        id: 'loc-em-1-p1',
        name: '4K Pro Webcam',
        priceUSD: 129,
        priceAIG: 1080,
        image: 'https://picsum.photos/seed/loc-p1/400/280',
      },
      {
        id: 'loc-em-1-p2',
        name: 'Mechanical Kit 75%',
        priceUSD: 189,
        priceAIG: 1580,
        image: 'https://picsum.photos/seed/loc-p2/400/280',
      },
    ],
  },
  {
    id: 'loc-em-2',
    kind: 'store',
    name: 'Harbor Beans',
    logo: 'https://picsum.photos/seed/loc-cafe-logo/128/128',
    coverImage: 'https://picsum.photos/seed/loc-cafe-cover/960/400',
    description: 'Specialty coffee, hosted meets for builders. USDT + AIG tabs.',
    category: 'food',
    googleMapsLink: 'https://www.google.com/maps/search/?api=1&query=25.0756,55.1394',
    lat: 25.0756,
    lng: 55.1394,
    address: 'Marina Walk — Dubai',
    schedule: { tz: 'Asia/Dubai', slots: [...w] },
    acceptsAIG: true,
    pricing: { label: 'Drink + snack', aig: 45, usd: 12 },
    rating: 4.6,
    reviewCount: 580,
    verified: true,
    popularity: 0.88,
    activityLevel: 'busy',
    reviews: [{ id: 'r3', author: 'dev_anon', stars: 4, text: 'Great for AMAs.', at: '2026-03-28' }],
    products: [
      {
        id: 'loc-em-2-p1',
        name: 'Founder Latte Flight',
        priceUSD: 14,
        priceAIG: 118,
        image: 'https://picsum.photos/seed/loc-cafe1/400/280',
      },
    ],
  },
  {
    id: 'loc-em-3',
    kind: 'offer',
    name: 'Pulse Gym — Founding 30',
    logo: 'https://picsum.photos/seed/loc-gym-logo/128/128',
    coverImage: 'https://picsum.photos/seed/loc-gym-cover/960/400',
    description:
      'Limited founding memberships — single SKU offer, QR proof-of-wallet at front desk.',
    category: 'wellness',
    googleMapsLink: 'https://www.google.com/maps/search/?api=1&query=25.2285,55.2834',
    lat: 25.2285,
    lng: 55.2834,
    address: 'Business Bay — Dubai',
    schedule: { tz: 'Asia/Dubai', slots: [...w] },
    acceptsAIG: false,
    pricing: { label: '30-day pass', aig: 0, usd: 99 },
    rating: 4.9,
    reviewCount: 127,
    verified: true,
    popularity: 0.76,
    activityLevel: 'hot',
    reviews: [],
    products: [
      {
        id: 'loc-em-3-p1',
        name: 'Founding 30-day',
        priceUSD: 99,
        priceAIG: 0,
        image: 'https://picsum.photos/seed/loc-gym-offer/400/280',
        volumeRule: 'staking',
      },
    ],
  },
  {
    id: 'loc-em-4',
    kind: 'store',
    name: 'Atlas Streetwear',
    logo: 'https://picsum.photos/seed/loc-fashion-logo/128/128',
    coverImage: 'https://picsum.photos/seed/loc-fashion-cover/960/400',
    description: 'Limited drops — fiat only today; AIG pilot next quarter.',
    category: 'retail',
    googleMapsLink: 'https://www.google.com/maps/search/?api=1&query=25.1975,55.2796',
    lat: 25.1975,
    lng: 55.2796,
    address: 'DIFC — Dubai',
    schedule: { tz: 'Asia/Dubai', slots: [...w] },
    acceptsAIG: false,
    pricing: { label: 'Typical tee', aig: 0, usd: 65 },
    rating: 4.4,
    reviewCount: 89,
    verified: false,
    popularity: 0.55,
    activityLevel: 'quiet',
    reviews: [],
    products: [
      {
        id: 'loc-em-4-p1',
        name: 'City Shell Jacket',
        priceUSD: 210,
        priceAIG: 1750,
        image: 'https://picsum.photos/seed/loc-jacket/400/280',
      },
    ],
  },
  {
    id: 'loc-em-5',
    kind: 'store',
    name: 'Vertex Repairs',
    logo: 'https://picsum.photos/seed/loc-repair-logo/128/128',
    coverImage: 'https://picsum.photos/seed/loc-repair-cover/960/400',
    description: 'Device repair — quote in AIG or USD before work starts.',
    category: 'services',
    googleMapsLink: 'https://www.google.com/maps/search/?api=1&query=25.2619,55.2951',
    lat: 25.2619,
    lng: 55.2951,
    address: 'Al Qusais — Dubai',
    schedule: {
      tz: 'Asia/Dubai',
      slots: [
        { d: 1, open: '08:00', close: '18:00' },
        { d: 2, open: '08:00', close: '18:00' },
        { d: 3, open: '08:00', close: '18:00' },
        { d: 4, open: '08:00', close: '18:00' },
        { d: 5, open: '08:00', close: '14:00' },
      ],
    },
    acceptsAIG: true,
    pricing: { label: 'Screen service from', aig: 420, usd: 55 },
    rating: 4.7,
    reviewCount: 203,
    verified: true,
    popularity: 0.71,
    activityLevel: 'busy',
    reviews: [],
    products: [
      {
        id: 'loc-em-5-p1',
        name: 'Battery + calibration',
        priceUSD: 55,
        priceAIG: 460,
        image: 'https://picsum.photos/seed/loc-repair1/400/280',
      },
    ],
  },
  {
    id: 'loc-em-6',
    kind: 'offer',
    name: 'MetaTreat Spa — Day Pass',
    logo: 'https://picsum.photos/seed/loc-spa-logo/128/128',
    coverImage: 'https://picsum.photos/seed/loc-spa-cover/960/400',
    description: 'Single-session spa day — AIG quoted at desk from live rate.',
    category: 'wellness',
    googleMapsLink: 'https://www.google.com/maps/search/?api=1&query=25.1412,55.1853',
    lat: 25.1412,
    lng: 55.1853,
    address: 'Jumeirah — Dubai',
    schedule: { tz: 'Asia/Dubai', slots: [...w] },
    acceptsAIG: true,
    pricing: { label: 'Day pass', aig: 610, usd: 79 },
    rating: 4.5,
    reviewCount: 64,
    verified: true,
    popularity: 0.62,
    activityLevel: 'quiet',
    reviews: [],
    products: [
      {
        id: 'loc-em-6-p1',
        name: 'Recovery Day Pass',
        priceUSD: 79,
        priceAIG: 610,
        image: 'https://picsum.photos/seed/loc-spa1/400/280',
        volumeRule: 'staking',
      },
    ],
  },
];

/**
 * @deprecated Prefer `SEED_LOCAL_MERCHANTS` plus `useMergedLocalMerchants()` for directory + user stores.
 */
export const MOCK_LOCAL_MERCHANTS = SEED_LOCAL_MERCHANTS;
