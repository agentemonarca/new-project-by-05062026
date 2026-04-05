import type { GenesisUser } from '@ai-genesis/types';
import { LEGACY_TOKEN_KEYS, LEGACY_USER_KEYS, STORAGE_KEYS } from '@ai-genesis/config';
import { useGenesisStore } from '@ai-genesis/state';

/** Keys tried when reading legacy / shared auth from storage (canonical + migration). */
export const AUTH_STORAGE_KEYS = {
  token: [...LEGACY_TOKEN_KEYS],
  userJson: [...LEGACY_USER_KEYS],
} as const;

export { STORAGE_KEYS };

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1')}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function parseUser(raw: string | null): GenesisUser | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === 'object' && !Array.isArray(j)) return j as GenesisUser;
  } catch {
    /* ignore */
  }
  return null;
}

function firstLocalStorage(keys: readonly string[]): string | null {
  if (typeof localStorage === 'undefined') return null;
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v?.trim()) return v;
  }
  return null;
}

/**
 * Read token from localStorage (preferred keys) or optional cookie name.
 */
export function readTokenFromGenesis(cookieName = 'auth_token'): string | null {
  const fromLs = firstLocalStorage(AUTH_STORAGE_KEYS.token);
  if (fromLs) return fromLs;
  return readCookie(cookieName);
}

export function readUserFromGenesis(): GenesisUser | null {
  const raw = firstLocalStorage(AUTH_STORAGE_KEYS.userJson);
  return parseUser(raw);
}

/**
 * Push current storage-derived auth into Zustand (call on boot + storage events).
 */
export function syncAuthIntoStore(): void {
  const token = readTokenFromGenesis();
  const user = readUserFromGenesis();
  useGenesisStore.getState().applyAuthSync({
    token,
    user: user ?? (token ? { id: 'session' } : null),
  });
}

export function initAuthBridge(): () => void {
  syncAuthIntoStore();

  if (typeof window === 'undefined') {
    return () => {};
  }

  const onStorage = (e: StorageEvent) => {
    const key = e.key;
    if (!key) return;
    const tokenKeys = AUTH_STORAGE_KEYS.token as readonly string[];
    const userKeys = AUTH_STORAGE_KEYS.userJson as readonly string[];
    if (
      tokenKeys.includes(key) ||
      userKeys.includes(key) ||
      key === STORAGE_KEYS.TOKEN ||
      key === STORAGE_KEYS.USER
    ) {
      syncAuthIntoStore();
    }
  };

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
