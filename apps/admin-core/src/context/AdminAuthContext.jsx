import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ADMIN_AUTH_STORAGE_KEY } from '../lib/adminAuthConstants.js';
import { redirectToAdminLogin } from '../lib/adminAuthRedirect.js';

/**
 * Sesión HTTP-only del core-api (`/api/admin/auth/*`), vía proxy Vite en el mismo origen.
 * Espejo opcional en localStorage (`admin_auth`) para UX; la fuente de verdad es GET /me.
 */
export { ADMIN_AUTH_STORAGE_KEY };

const AdminAuthContext = createContext(/** @type {any} */ (null));

function syncAdminAuthStorage(isAdmin) {
  try {
    if (isAdmin) localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, 'true');
    else localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
  } catch {
    /* private mode / denied */
  }
}

export function AdminAuthProvider({ children }) {
  const [status, setStatus] = useState(/** @type {'loading' | 'ready'} */ ('loading'));
  const [admin, setAdmin] = useState(false);
  const [email, setEmail] = useState(/** @type {string | null} */ (null));
  const [authNotice, setAuthNotice] = useState(
    /** @type {null | { code: string, retryAfter?: number }} */ (null),
  );

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/auth/me', { credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) {
        setAuthNotice(null);
        setAdmin(false);
        setEmail(null);
        syncAdminAuthStorage(false);
        redirectToAdminLogin();
      } else if (r.status === 429) {
        setAuthNotice({
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Number(j.retryAfter) || undefined,
        });
        setAdmin(false);
        setEmail(null);
        syncAdminAuthStorage(false);
      } else {
        setAuthNotice(null);
        const ok = Boolean(j.admin);
        setAdmin(ok);
        setEmail(j.email || null);
        syncAdminAuthStorage(ok);
      }
    } catch {
      setAuthNotice(null);
      setAdmin(false);
      setEmail(null);
      syncAdminAuthStorage(false);
    } finally {
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (loginEmail, password) => {
      const r = await fetch('/api/admin/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 503) {
        const err = new Error('admin_login_not_configured');
        err.code = 'admin_login_not_configured';
        throw err;
      }
      if (r.status === 429) {
        const err = new Error('rate_limited');
        err.code = 'RATE_LIMIT_EXCEEDED';
        err.retryAfter = j.retryAfter;
        throw err;
      }
      if (r.status === 401) {
        const err = new Error('invalid_credentials');
        err.code = 'invalid_credentials';
        throw err;
      }
      if (!r.ok) {
        const err = new Error(j.error || 'invalid_credentials');
        err.code = j.error || 'invalid_credentials';
        throw err;
      }
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      await refresh();
    }
  }, [refresh]);

  const value = useMemo(
    () => ({
      status,
      admin,
      email,
      authNotice,
      login,
      logout,
      refresh,
    }),
    [status, admin, email, authNotice, login, logout, refresh],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
