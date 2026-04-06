import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function ToastViewportInner({ toast, onDismiss }) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[200] flex w-[min(92vw,28rem)] -translate-x-1/2 flex-col gap-2">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.message}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur-xl ${
              toast.type === 'success'
                ? 'border-emerald-500/35 bg-emerald-950/90 text-emerald-100'
                : 'border-rose-500/35 bg-rose-950/90 text-rose-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span>{toast.message}</span>
              <button
                type="button"
                className="shrink-0 rounded-lg text-xs opacity-70 hover:opacity-100"
                onClick={onDismiss}
              >
                ✕
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export const ToastViewport = memo(ToastViewportInner);
ToastViewport.displayName = 'ToastViewport';
