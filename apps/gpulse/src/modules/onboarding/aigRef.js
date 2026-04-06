/** Canonical invite persistence — ecosystem rule: access only with referral. */
export const AIG_REF_KEY = 'aig_ref';

/**
 * @returns {string | null}
 */
export function getAigRef() {
  try {
    let raw = localStorage.getItem(AIG_REF_KEY);
    if (!raw?.trim()) {
      const legacy = localStorage.getItem('aigenesis-invite-ref-v1');
      if (legacy?.trim()) {
        localStorage.setItem(AIG_REF_KEY, legacy.trim());
        raw = legacy.trim();
      }
    }
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
export function setAigRef(ref) {
  try {
    const t = String(ref ?? '').trim();
    if (!t) return;
    localStorage.setItem(AIG_REF_KEY, t);
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {unknown} ref
 * @returns {string}
 */
export function formatAigRefDisplay(ref) {
  if (ref == null) return '';
  const t = String(ref).trim();
  if (!t) return '';
  if (t.startsWith('0x') && t.length >= 10) return `${t.slice(0, 6)}…${t.slice(-4)}`;
  return t;
}
