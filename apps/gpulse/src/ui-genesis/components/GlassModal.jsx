import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { modalBackdrop, modalContent } from '../motion/variants.js';

/**
 * Centered double-glass modal with deep backdrop blur.
 */
export function GlassModal({
  open,
  onClose,
  children,
  title,
  className = '',
  size = 'md',
  dismissible = true,
}) {
  const maxW =
    size === 'sm'
      ? 'max-w-md'
      : size === 'lg'
        ? 'max-w-2xl'
        : size === 'xl'
          ? 'max-w-4xl'
          : 'max-w-lg';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'glass-modal-title' : undefined}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial="hidden"
          animate="show"
          exit="hidden"
          variants={modalBackdrop}
        >
          {dismissible ? (
            <motion.button
              type="button"
              aria-label="Close"
              className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-xl"
              onClick={onClose}
            />
          ) : (
            <div
              role="presentation"
              className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-xl"
            />
          )}
          <motion.div
            variants={modalContent}
            initial="hidden"
            animate="show"
            exit="hidden"
            className={`relative z-10 w-full ${maxW} overflow-hidden rounded-2xl border border-white/15 bg-slate-900/50 shadow-glowCyanLg backdrop-blur-2xl ${className}`}
          >
            <div className="pointer-events-none absolute inset-0 opacity-70 mix-blend-screen bg-gradient-to-br from-fuchsia-500/15 via-cyan-400/10 to-violet-500/15" />
            {title ? (
              <h2 id="glass-modal-title" className="relative z-10 border-b border-white/10 px-6 py-4 font-display text-lg font-semibold tracking-tight text-white/95">
                {title}
              </h2>
            ) : null}
            <div className="relative z-10">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
