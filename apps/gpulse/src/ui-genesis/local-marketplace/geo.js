/**
 * Geo helpers for local marketplace (Haversine, open-hours).
 */

const DAY_MAP = /** @type {const} */ ({
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
});

/**
 * Haversine distance in kilometers.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number}
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * @param {number | null | undefined} km
 * @returns {string}
 */
export function formatDistanceKm(km) {
  if (km == null || Number.isNaN(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * @param {{ tz?: string, slots?: Array<{ d: number, open: string, close: string }> }} schedule
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isMerchantOpenNow(schedule, now = new Date()) {
  if (!schedule?.slots?.length) return true;
  const tz = schedule.tz || 'UTC';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const d = weekday && DAY_MAP[/** @type {keyof typeof DAY_MAP} */ (weekday)];
  if (d === undefined) return true;
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const nowM = hour * 60 + minute;
  const slot = schedule.slots.find((s) => s.d === d);
  if (!slot) return false;
  const [oh, om] = slot.open.split(':').map(Number);
  const [ch, cm] = slot.close.split(':').map(Number);
  const openM = oh * 60 + om;
  const closeM = ch * 60 + cm;
  if (closeM < openM) return nowM >= openM || nowM <= closeM;
  return nowM >= openM && nowM <= closeM;
}
