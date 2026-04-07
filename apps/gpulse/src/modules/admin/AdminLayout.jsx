import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Flame, Menu, Shield, X } from 'lucide-react';
import { GradientButton } from '@/ui-genesis/components/GradientButton.jsx';
import { ADMIN_NAV_SECTIONS } from './adminNavConfig.js';
import { useAdmin } from './context/AdminContext.jsx';
import { ToastViewport } from './components/ToastViewport.jsx';

/**
 * Shell premium tipo exchange — navegación modular + toasts globales.
 *
 * @param {{
 *   children: React.ReactNode,
 *   onBackToApp: () => void,
 * }} props
 */
export function AdminLayout({ children, onBackToApp }) {
  const navigate = useNavigate();
  const location = useLocation();
  const adminBase = location.pathname.startsWith('/admin-core') ? '/admin-core' : '/admin';
  const signalsPath = `${adminBase}/signals`;
  const [mobileNav, setMobileNav] = useState(false);
  const { state, clearToast } = useAdmin();

  return (
    <div className="relative min-h-screen bg-[linear-gradient(165deg,#050814_0%,#0b0f1a_40%,#020617_100%)] font-display text-slate-200">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.4]"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(ellipse 75% 55% at 50% -25%, rgba(0,240,255,0.07), transparent 55%), radial-gradient(ellipse 55% 40% at 100% 100%, rgba(168,85,247,0.08), transparent 50%)',
        }}
      />

      <ToastViewport toast={state.ui.toast} onDismiss={clearToast} />

      <header className="sticky top-0 z-50 border-b border-cyan-500/10 bg-slate-950/92 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between gap-3 px-4 md:h-16 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 md:hidden"
              aria-label="Abrir menú admin"
              onClick={() => setMobileNav(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/35 bg-gradient-to-br from-cyan-500/15 to-violet-600/20 text-cyan-200 shadow-[0_0_28px_-8px_rgba(0,240,255,0.45)]">
                <Shield className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold text-white md:text-base">
                  AiGenesis · Command Center
                </p>
                <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300/70 md:text-[11px]">
                  Control operativo en tiempo real
                </p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <GradientButton
              type="button"
              variant="ghost"
              className="!hidden !shrink-0 sm:!inline-flex !border-white/10 !bg-white/[0.04] !py-2 !text-xs !text-slate-200"
              onClick={() => navigate('/onboarding?ref=demo')}
            >
              Onboarding
            </GradientButton>
            <GradientButton
              type="button"
              variant="ghost"
              className="!shrink-0 !border-cyan-500/25 !bg-cyan-500/10 !py-2 !text-xs !text-cyan-100 hover:!bg-cyan-500/20 md:!px-4"
              onClick={onBackToApp}
            >
              Volver a la app
            </GradientButton>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)]">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[18rem] shrink-0 flex-col border-r border-white/[0.06] bg-slate-950/95 backdrop-blur-2xl transition-transform md:static md:translate-x-0 ${
            mobileNav ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-14 items-center justify-end border-b border-white/[0.06] px-3 md:hidden">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
              aria-label="Cerrar menú"
              onClick={() => setMobileNav(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav
            className="custom-scrollbar flex flex-1 flex-col gap-0.5 overflow-y-auto p-3"
            aria-label="Módulos administrativos"
          >
            {ADMIN_NAV_SECTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={`${adminBase}/${item.id}`}
                  onClick={() => setMobileNav(false)}
                  className={({ isActive }) =>
                    `flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'border border-cyan-500/35 bg-cyan-500/10 text-cyan-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                        : 'border border-transparent text-slate-400 hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-slate-200'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${isActive ? 'text-cyan-200' : 'text-slate-500'}`}
                        strokeWidth={1.75}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-snug">{item.label}</span>
                        {item.description ? (
                          <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                    </>
                  )}
                </NavLink>
              );
            })}
            <NavLink
              to={signalsPath}
              onClick={() => setMobileNav(false)}
              className={({ isActive }) =>
                `flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                    : 'border border-transparent text-slate-400 hover:border-emerald-500/25 hover:bg-emerald-500/[0.06] hover:text-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Flame
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      isActive ? 'text-emerald-200' : 'text-emerald-600/80'
                    }`}
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-snug">Signals Control</span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
                      Signal Intelligence · {signalsPath}
                    </span>
                  </span>
                </>
              )}
            </NavLink>
          </nav>
        </aside>

        {mobileNav ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm md:hidden"
            aria-label="Cerrar menú"
            onClick={() => setMobileNav(false)}
          />
        ) : null}

        <main className="min-h-0 flex-1 overflow-auto p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-7xl"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
