import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutGrid,
  Menu,
  Shield,
  X,
} from 'lucide-react';
import { GradientButton } from '../components/GradientButton.jsx';

const SIDEBAR_ITEMS = [
  { id: 'overview', label: 'Vista general', icon: LayoutGrid },
];

/**
 * Standalone operator chrome — not GenesisDashboardLayout, user sidebar, or lobby shell.
 *
 * @param {{
 *   children: React.ReactNode,
 *   onBackToApp: () => void,
 * }} props
 */
export function AdminCoreLayout({ children, onBackToApp }) {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="relative min-h-screen bg-[linear-gradient(165deg,rgba(2,6,23,1)_0%,rgba(15,23,42,0.97)_45%,rgba(9,9,11,1)_100%)] font-display text-slate-200">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(245,158,11,0.08), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(34,211,238,0.04), transparent 50%)',
        }}
      />

      <header className="sticky top-0 z-50 border-b border-amber-500/15 bg-slate-950/90 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between gap-3 px-4 md:h-16 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 md:hidden"
              aria-label="Abrir menú admin"
              onClick={() => setMobileNav(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-200 shadow-[0_0_24px_-8px_rgba(245,158,11,0.35)]">
                <Shield className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold text-white md:text-base">Admin Core</p>
                <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200/70 md:text-[11px]">
                  Control plane
                </p>
              </div>
            </div>
          </div>
          <GradientButton
            type="button"
            variant="ghost"
            className="!shrink-0 !border-amber-500/25 !bg-amber-500/10 !py-2 !text-xs !text-amber-100 hover:!bg-amber-500/20 md:!px-4"
            onClick={onBackToApp}
          >
            Back to App
          </GradientButton>
        </div>
      </header>

      <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)]">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[17rem] shrink-0 border-r border-amber-500/10 bg-slate-950/92 backdrop-blur-2xl transition-transform md:static md:translate-x-0 ${
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
          <nav className="flex flex-col gap-0.5 p-3" aria-label="Administración">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-left text-sm font-medium text-amber-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                >
                  <Icon className="h-4 w-4 shrink-0 text-amber-300/90" strokeWidth={1.75} />
                  {item.label}
                </button>
              );
            })}
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
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-7xl"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
