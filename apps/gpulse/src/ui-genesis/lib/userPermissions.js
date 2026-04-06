/**
 * Roles y permisos granulares (alineado con Admin Core).
 */

/** @type {readonly string[]} */
export const PERMISSION_KEYS = Object.freeze([
  'canViewNetwork',
  'canViewFullNetwork',
  'canViewEarnings',
  'canEditProfile',
  'canAccessP2P',
  'canExecuteActions',
]);

/** @type {readonly string[]} */
export const USER_ROLES = Object.freeze([
  'super_admin',
  'operator',
  'member',
  'viewer',
  'restricted',
]);

export const DEFAULT_ROLE = 'member';

/** @type {Readonly<Record<string, boolean>>} */
export const DEFAULT_PERMISSIONS = Object.freeze({
  canViewNetwork: true,
  canViewFullNetwork: true,
  canViewEarnings: true,
  canEditProfile: true,
  canAccessP2P: true,
  canExecuteActions: true,
});

/** @type {Readonly<Record<string, Record<string, boolean>>>} */
export const ROLE_PRESETS = Object.freeze({
  super_admin: { ...DEFAULT_PERMISSIONS },
  operator: {
    ...DEFAULT_PERMISSIONS,
    canViewFullNetwork: false,
  },
  member: {
    ...DEFAULT_PERMISSIONS,
    canViewFullNetwork: false,
  },
  viewer: {
    canViewNetwork: true,
    canViewFullNetwork: false,
    canViewEarnings: true,
    canEditProfile: false,
    canAccessP2P: false,
    canExecuteActions: false,
  },
  restricted: {
    canViewNetwork: false,
    canViewFullNetwork: false,
    canViewEarnings: false,
    canEditProfile: false,
    canAccessP2P: false,
    canExecuteActions: false,
  },
});

/**
 * @param {unknown} input
 * @returns {Record<string, boolean>}
 */
export function normalizePermissions(input) {
  const base = { ...DEFAULT_PERMISSIONS };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return base;
  for (const k of PERMISSION_KEYS) {
    if (typeof input[k] === 'boolean') base[k] = input[k];
  }
  return base;
}

/**
 * @param {{ role?: string, permissions?: object } | null | undefined} userLike
 * @returns {{ role: string, permissions: Record<string, boolean> }}
 */
export function normalizeUserAccess(userLike) {
  const raw = typeof userLike?.role === 'string' ? userLike.role.trim() : '';
  const role = USER_ROLES.includes(raw) ? raw : DEFAULT_ROLE;
  const preset = ROLE_PRESETS[role] || DEFAULT_PERMISSIONS;
  const permissions = { ...preset, ...normalizePermissions(userLike?.permissions) };
  return { role, permissions };
}
