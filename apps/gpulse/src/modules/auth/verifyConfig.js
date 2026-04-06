/**
 * Demo OTP — reemplazar por verificación con API en producción.
 * Opcional: `VITE_DEMO_VERIFY_CODE` (6 dígitos).
 */
const FALLBACK_DEMO = '428571';

function readEnvCode() {
  const raw = import.meta.env?.VITE_DEMO_VERIFY_CODE;
  if (raw == null || raw === '') return FALLBACK_DEMO;
  const digits = String(raw).replace(/\D/g, '').slice(0, 6);
  return digits.length === 6 ? digits : FALLBACK_DEMO;
}

export const EXPECTED_VERIFY_CODE = readEnvCode();

/**
 * @param {string} code
 */
export function validateAccessCode(code) {
  const c = String(code ?? '').replace(/\D/g, '');
  if (c.length !== 6) return false;
  return c === EXPECTED_VERIFY_CODE;
}

export const SESSION_EMAIL_KEY = 'aig_verify_email_pending';
