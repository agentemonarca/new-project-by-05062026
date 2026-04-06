import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Panel lateral estándar para detalle / acciones (multi-proyecto).
 */
function AdminSidePanelInner({
  open,
  onClose,
  eyebrow = 'Panel',
  title,
  subtitle,
  children,
  widthClassName = 'md:max-w-md',
  asideClassName = '',
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm md:bg-slate-950/45"
            aria-label="Cerrar"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className={`fixed inset-y-0 right-0 z-[101] flex w-full max-w-[100vw] flex-col border-l border-cyan-500/15 bg-[#070a12]/98 shadow-[0_0_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl ${widthClassName} ${asideClassName}`}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3 lg:px-5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-400/85">{eyebrow}</p>
                <h2 className="font-display truncate text-lg font-semibold tracking-tight text-white lg:text-xl">
                  {title}
                </h2>
                {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Cerrar panel"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-5 lg:py-5">{children}</div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export const AdminSidePanel = memo(AdminSidePanelInner);
AdminSidePanel.displayName = 'AdminSidePanel';
