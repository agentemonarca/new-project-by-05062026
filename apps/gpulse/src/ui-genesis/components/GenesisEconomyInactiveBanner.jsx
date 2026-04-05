import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

/**
 * Shown when the user is not economically active (no staking, frozen, or both).
 * @param {{ visible: boolean }} props
 */
export function GenesisEconomyInactiveBanner({ visible }) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-amber-500/35 bg-gradient-to-r from-amber-950/88 via-slate-950/90 to-amber-950/88 px-4 py-3 md:px-8"
      role="alert"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 text-sm text-amber-50/95">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <p className="font-medium leading-snug">
          Tu red está generando volumen, pero no estás ganando. Activa staking y mantén 7% en AIG para desbloquear
          ingresos.
        </p>
      </div>
    </motion.div>
  );
}
