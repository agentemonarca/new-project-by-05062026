/**
 * Persisted invite / referral handle for premium onboarding and registration flows.
 */
export const INVITE_REF_STORAGE_KEY = 'aigenesis-invite-ref-v1';

/**
 * @returns {string | null}
 */
export function getStoredInviteRef() {
  try {
    const raw = localStorage.getItem(INVITE_REF_STORAGE_KEY);
    if (raw == null) return null;
    const t = String(raw).trim();
    return t.length ? t : null;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} ref
 */
export function setStoredInviteRef(ref) {
  try {
    const t = String(ref ?? '').trim();
    if (!t) return;
    localStorage.setItem(INVITE_REF_STORAGE_KEY, t);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * @param {unknown} ref
 * @returns {string}
 */
export function formatInviteDisplayName(ref) {
  if (ref == null) return '';
  const t = String(ref).trim();
  if (!t) return '';
  if (t.startsWith('0x') && t.length >= 10) return `${t.slice(0, 6)}…${t.slice(-4)}`;
  return t;
}
