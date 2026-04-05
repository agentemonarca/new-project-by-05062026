import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassModal } from '../components/GlassModal.jsx';
import { GradientButton } from '../components/GradientButton.jsx';

export function SuccessModal({
  open,
  onClose,
  title = 'Complete',
  message = 'Your action was processed successfully.',
  txHash,
  explorerUrl,
}) {
  return (
    <GlassModal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center px-6 py-8 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/35 bg-emerald-500/15 shadow-[0_0_24px_rgba(16,185,129,0.25)]"
        >
          <CheckCircle2 className="h-7 w-7 text-emerald-300" strokeWidth={1.5} />
        </motion.div>
        <p className="text-sm text-slate-300">{message}</p>
        {txHash ? (
          <div className="mt-4 w-full rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-left">
            <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/80">Transaction</p>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all font-mono text-xs text-cyan-200 underline decoration-cyan-500/40 underline-offset-2 hover:text-white"
              >
                {txHash}
              </a>
            ) : (
              <p className="mt-1 break-all font-mono text-xs text-slate-400">{txHash}</p>
            )}
          </div>
        ) : null}
        <GradientButton className="mt-6" onClick={onClose}>
          Close
        </GradientButton>
      </div>
    </GlassModal>
  );
}
