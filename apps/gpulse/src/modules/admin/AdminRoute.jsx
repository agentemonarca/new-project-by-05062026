import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { redirectToAdminLogin } from '../../ui-genesis/lib/adminAuthRedirect.js';

const ADMIN_AUTH_LS_KEY = 'admin_auth';

/**
 * Layout guard: exige sesión admin (`/api/admin/auth/me` → `admin: true`, cookie httpOnly).
 * Usar como `<Route element={<AdminRoute />}>` para todo `/admin/*` salvo rutas públicas (p.ej. `login`).
 *
 * @param {{ children?: React.ReactNode }} [props] Si se pasa `children`, se usa en lugar de `<Outlet />` (compat).
 */
export function AdminRoute({ children }) {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/auth/me', { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.status === 401) {
          redirectToAdminLogin();
          return;
        }
        if (import.meta.env.DEV) {
          console.log('AdminRoute /me:', data);
        }
        const serverAdmin = Boolean(data?.admin);
        const devLsOk =
          import.meta.env.DEV &&
          typeof localStorage !== 'undefined' &&
          localStorage.getItem(ADMIN_AUTH_LS_KEY) === 'true';

        let allow = serverAdmin;
        if (import.meta.env.DEV) {
          if (serverAdmin) {
            localStorage.setItem(ADMIN_AUTH_LS_KEY, 'true');
          } else if (devLsOk) {
            /** DEV: carrera cookie tras redirect desde login (mismo origen). */
            allow = true;
          } else {
            localStorage.removeItem(ADMIN_AUTH_LS_KEY);
          }
        }
        setOk(allow);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.warn('AdminRoute /me: error de red');
        }
        setOk(false);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || ok) return;
    redirectToAdminLogin();
  }, [ready, ok]);

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#050814] font-display text-amber-200/90">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
        <p className="text-sm text-slate-400">Verificando acceso admin…</p>
      </div>
    );
  }

  if (!ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#050814] font-display text-amber-200/90">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
        <p className="text-sm text-slate-400">Redirigiendo…</p>
      </div>
    );
  }

  return children != null ? children : <Outlet />;
}
