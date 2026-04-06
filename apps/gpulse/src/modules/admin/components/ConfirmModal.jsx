import React, { memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * @param {{
 *   open: boolean,
 *   title: string,
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
function ConfirmModalInner({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[190] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
          >
            <h2 id="confirm-title" className="font-display text-lg font-semibold text-white">
              {title}
            </h2>
            <p id="confirm-desc" className="mt-2 text-sm text-slate-400">
              {message}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                  danger
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-cyan-600 hover:bg-cyan-500'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export const ConfirmModal = memo(ConfirmModalInner);
ConfirmModal.displayName = 'ConfirmModal';
