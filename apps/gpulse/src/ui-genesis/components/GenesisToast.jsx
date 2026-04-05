import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

/**
 * Lightweight success / info toast (no extra dependencies).
 */
export function GenesisToast({ open, message, variant = 'success', onClose, durationMs = 4000 }) {
  useEffect(() => {
    if (!open || !message) return undefined;
    const t = setTimeout(() => onClose?.(), durationMs);
    return () => clearTimeout(t);
  }, [open, message, durationMs, onClose]);

  return (
    <AnimatePresence>
      {open && message ? (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="pointer-events-none fixed bottom-6 left-1/2 z-[200] flex max-w-md -translate-x-1/2 px-4"
        >
          <div
            className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md ${
              variant === 'success'
                ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-100'
                : 'border-cyan-500/30 bg-slate-950/90 text-slate-100'
            }`}
          >
            {variant === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : null}
            <span>{message}</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
