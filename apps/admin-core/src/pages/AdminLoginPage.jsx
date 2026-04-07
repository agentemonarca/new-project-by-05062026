import React, { memo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Loader2, Lock, Mail } from 'lucide-react';
import { ADMIN_AUTH_STORAGE_KEY, useAdminAuth } from '../context/AdminAuthContext.jsx';

function AdminLoginPageInner() {
  const navigate = useNavigate();
  const { login, authNotice } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        await login(email.trim(), password);
        try {
          localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, 'true');
        } catch {
          /* ignore */
        }
        navigate('/admin/overview', { replace: true });
      } catch (err) {
        const code = err?.code || err?.message;
        if (code === 'admin_login_not_configured') {
          setError(
            'El servidor no tiene login admin configurado. Define ADMIN_EMAIL y ADMIN_PASSWORD en backend/core-api/.env y reinicia el API.',
          );
        } else if (code === 'invalid_credentials') {
          setError('Credenciales incorrectas.');
        } else if (code === 'RATE_LIMIT_EXCEEDED') {
          const s = err?.retryAfter ? ` Espera ${err.retryAfter}s o reinicia el API.` : '';
          setError(`Demasiadas peticiones al servidor (429).${s}`);
        } else {
          setError(String(err?.message || err || 'No se pudo iniciar sesión'));
        }
      } finally {
        setBusy(false);
      }
    },
    [email, password, login, navigate],
  );

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#05080f] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-950/90 to-slate-900/50 p-8 shadow-[0_0_40px_rgba(34,211,238,0.06)]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10">
            <Activity className="h-6 w-6 text-cyan-400" aria-hidden />
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight text-white">AiGenesis Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Inicia sesión para abrir el panel de control</p>
        </div>

        {authNotice?.code === 'RATE_LIMIT_EXCEEDED' ? (
          <p className="mb-4 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            El API está limitando peticiones (429) al comprobar la sesión.
            {authNotice.retryAfter ? ` Prueba en ~${authNotice.retryAfter}s.` : ''} Reinicia core-api si el
            límite no se libera.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="mb-1 block text-xs font-medium text-slate-400">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                placeholder="admin@example.com"
              />
            </div>
          </div>
          <div>
            <label htmlFor="admin-password" className="mb-1 block text-xs font-medium text-slate-400">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500/90 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Entrando…
              </>
            ) : (
              'Entrar al panel'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[10px] text-slate-600">
          Las credenciales las define el core-api (<span className="font-mono">ADMIN_EMAIL</span>,{' '}
          <span className="font-mono">ADMIN_PASSWORD</span>). El tráfico va por proxy a :5050.
        </p>
      </div>
    </div>
  );
}

export const AdminLoginPage = memo(AdminLoginPageInner);
AdminLoginPage.displayName = 'AdminLoginPage';
