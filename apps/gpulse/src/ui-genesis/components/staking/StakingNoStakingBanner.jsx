import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

/**
 * @param {{ visible: boolean }} props
 */
export function StakingNoStakingBanner({ visible }) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-950/50 to-slate-950/60 px-4 py-4 shadow-[0_0_32px_-8px_rgba(251,191,36,0.25)] backdrop-blur-sm md:px-6"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" strokeWidth={1.75} />
      <p className="text-sm leading-relaxed text-amber-100/95">
        Tu red está generando volumen, pero no estás ganando.{' '}
        <span className="font-semibold text-white">Activa staking</span> para desbloquear tus ingresos.
      </p>
    </motion.div>
  );
}
