/**
 * Canonical localStorage keys — use these everywhere instead of string literals.
 */

export const STORAGE_KEYS = {
  TOKEN: 'ai-genesis.auth.token',
  USER: 'ai-genesis.auth.user',
  /** Serialized JSON: { connected, lastSync, status } for optional persistence / hydration */
  GPULSE_STATUS: 'ai-genesis.gpulse.status',
  /** Genesis dashboard slice (user domain + activity preview). */
  GENESIS_DASHBOARD: 'ai-genesis.dashboard',
} as const;

export type StorageKeyName = keyof typeof STORAGE_KEYS;

/** Additional keys checked when reading legacy tokens (read-only migration path). */
export const LEGACY_TOKEN_KEYS = [
  STORAGE_KEYS.TOKEN,
  'gpulse.auth.token',
  'genesis_token',
  'auth_token',
] as const;

export const LEGACY_USER_KEYS = [STORAGE_KEYS.USER, 'gpulse.auth.user'] as const;
