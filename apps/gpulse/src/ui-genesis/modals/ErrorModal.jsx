import React from 'react';
import { XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassModal } from '../components/GlassModal.jsx';
import { GradientButton } from '../components/GradientButton.jsx';

export function ErrorModal({ open, onClose, title = 'Something went wrong', message = 'Please try again or contact support.', detail }) {
  return (
    <GlassModal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center px-6 py-8 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-400/35 bg-rose-500/15 shadow-[0_0_24px_rgba(244,63,94,0.22)]"
        >
          <XCircle className="h-7 w-7 text-rose-300" strokeWidth={1.5} />
        </motion.div>
        <p className="text-sm text-slate-300">{message}</p>
        {detail ? <p className="mt-2 font-mono text-[10px] text-rose-300/80">{detail}</p> : null}
        <GradientButton className="mt-6" variant="ghost" onClick={onClose}>
          Dismiss
        </GradientButton>
      </div>
    </GlassModal>
  );
}
