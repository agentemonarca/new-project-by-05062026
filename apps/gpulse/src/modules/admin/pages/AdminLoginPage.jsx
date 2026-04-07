import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail, Sparkles } from 'lucide-react';
import { fadeUpBlur, staggerContainer } from '@/ui-genesis/motion/variants.js';

const ADMIN_AUTH_LS_KEY = 'admin_auth';

/**
 * Logo mark — identidad Genesis (marca vectorial, sin asset externo).
 */
function GenesisLogoMark({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="genesisLogoGrad" x1="12" y1="10" x2="68" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="0.5" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="genesisLogoGlow" x1="40" y1="8" x2="40" y2="72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <path
        d="M40 6l28 16v36L40 74 12 58V22L40 6z"
        stroke="url(#genesisLogoGrad)"
        strokeWidth="1.35"
        fill="rgba(3,7,18,0.92)"
      />
      <path d="M40 16l22 13v24L40 64 18 53V29L40 16z" fill="url(#genesisLogoGlow)" />
      <path
        d="M40 28v10h10"
        stroke="url(#genesisLogoGrad)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="40" cy="48" r="3.5" fill="url(#genesisLogoGrad)" />
    </svg>
  );
}

/**
 * Login admin Genesis — invitación exclusiva; credenciales solo en servidor.
 */
export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const adminHome = location.pathname.startsWith('/admin-core') ? '/admin-core/overview' : '/admin/overview';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((/** @type {{ admin?: boolean }} */ data) => {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.log('Login response (session check):', data);
        }
        if (data?.admin) {
          if (import.meta.env.DEV) {
            localStorage.setItem(ADMIN_AUTH_LS_KEY, 'true');
          }
          navigate(adminHome, { replace: true });
        } else if (import.meta.env.DEV) {
          localStorage.removeItem(ADMIN_AUTH_LS_KEY);
        }
      })
      .catch(() => {
        if (import.meta.env.DEV) {
          localStorage.removeItem(ADMIN_AUTH_LS_KEY);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, adminHome]);

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      setSubmitting(true);
      try {
        const res = await fetch('/api/admin/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (import.meta.env.DEV) {
          console.log('Login response:', data);
        }
        if (!res.ok) {
          if (import.meta.env.DEV) {
            localStorage.removeItem(ADMIN_AUTH_LS_KEY);
          }
          setError(
            res.status === 503
              ? 'El acceso no está configurado en el servidor.'
              : res.status === 401 || data?.error === 'invalid_credentials'
                ? 'Credenciales no válidas para esta invitación.'
                : 'No se pudo completar el acceso.',
          );
          return;
        }
        if (import.meta.env.DEV) {
          localStorage.setItem(ADMIN_AUTH_LS_KEY, 'true');
        }
        navigate(adminHome, { replace: true });
      } catch {
        setError('Error de red. Verifica tu conexión e inténtalo de nuevo.');
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, navigate, adminHome],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] font-display text-slate-200">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.95]"
          style={{
            background:
              'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(6,182,212,0.18), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(139,92,246,0.14), transparent 50%), radial-gradient(ellipse 50% 40% at 0% 80%, rgba(59,130,246,0.08), transparent 45%), linear-gradient(180deg, #030712 0%, #0a0f1a 50%, #030712 100%)',
          }}
        />
        <motion.div
          className="absolute -left-[20%] top-[10%] h-[480px] w-[480px] rounded-full bg-cyan-500/20 blur-[100px]"
          animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.08, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-[15%] bottom-[5%] h-[520px] w-[520px] rounded-full bg-violet-600/18 blur-[110px]"
          animate={{ opacity: [0.28, 0.48, 0.28], scale: [1.05, 1, 1.05] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <motion.div
        className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-16 sm:px-8"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeUpBlur} className="mb-10 text-center">
          <div className="mx-auto mb-8 flex justify-center">
            <motion.div
              className="relative"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="absolute -inset-6 rounded-full bg-cyan-400/15 blur-2xl" aria-hidden />
              <GenesisLogoMark className="relative h-20 w-20 drop-shadow-[0_0_28px_rgba(34,211,238,0.35)]" />
            </motion.div>
          </div>
          <p className="mb-3 inline-flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-300/90 sm:text-[11px]">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400/80" strokeWidth={2} />
            Acceso exclusivo <span className="text-slate-600">•</span>{' '}
            <span className="bg-gradient-to-r from-cyan-200 to-violet-200 bg-clip-text text-transparent">
              Genesis Intelligence System
            </span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Bienvenido al núcleo
          </h1>
        </motion.div>

        <motion.p
          variants={fadeUpBlur}
          className="mx-auto mb-10 max-w-md text-center text-sm leading-relaxed text-slate-400 sm:text-[15px]"
        >
          Has sido invitado a formar parte de una red privada de inteligencia operativa. Este entorno está
          reservado para operadores autorizados. Introduce tus credenciales para acceder a módulos y señales
          en tiempo real.
        </motion.p>

        <motion.form
          variants={fadeUpBlur}
          onSubmit={onSubmit}
          className="relative rounded-2xl border border-white/[0.08] bg-slate-950/50 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_-24px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:p-8"
        >
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
          <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-cyan-500/10 via-transparent to-violet-600/10 opacity-50" />

          <div className="relative space-y-5">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                <Mail className="h-3.5 w-3.5 text-cyan-500/70" strokeWidth={2} />
                Correo
              </span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
                className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3.5 text-sm text-white outline-none ring-0 placeholder:text-slate-600 transition-colors focus:border-cyan-500/40 focus:bg-black/55 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.12)]"
                placeholder="tu@organización.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                <Lock className="h-3.5 w-3.5 text-violet-400/70" strokeWidth={2} />
                Contraseña
              </span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
                className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3.5 text-sm text-white outline-none ring-0 placeholder:text-slate-600 transition-colors focus:border-violet-500/40 focus:bg-black/55 focus:shadow-[0_0_0_3px_rgba(167,139,250,0.12)]"
                placeholder="Clave de acceso"
              />
            </label>

            {error ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-rose-500/25 bg-rose-950/40 px-4 py-3 text-sm text-rose-100/95"
              >
                {error}
              </motion.p>
            ) : null}

            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ scale: submitting ? 1 : 1.01 }}
              whileTap={{ scale: submitting ? 1 : 0.99 }}
              className="group relative mt-2 w-full overflow-hidden rounded-xl py-4 text-sm font-semibold tracking-wide text-white shadow-[0_12px_40px_-12px_rgba(34,211,238,0.45)] transition-[box-shadow] disabled:pointer-events-none disabled:opacity-45"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 opacity-95 transition-opacity group-hover:opacity-100" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
              <span className="relative flex items-center justify-center gap-2">
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Autenticando…
                  </>
                ) : (
                  'Entrar al núcleo'
                )}
              </span>
            </motion.button>
          </div>
        </motion.form>

        <motion.p
          variants={fadeUpBlur}
          className="mt-8 text-center text-[10px] uppercase tracking-[0.25em] text-slate-600"
        >
          Genesis · canal cifrado · solo personal autorizado
        </motion.p>
      </motion.div>
    </div>
  );
}
