import React from 'react';
import { motion } from 'framer-motion';
import { Lock, AlertTriangle } from 'lucide-react';

/**
 * Global holding gate: sub-threshold AIG share shows FROZEN state (UX; ratio is display-only).
 * @param {{ frozen: boolean, holdingPct: number, minPct: number }} props
 */
export function GenesisHoldingBanner({ frozen, holdingPct, minPct }) {
  if (!frozen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-amber-500/35 bg-gradient-to-r from-amber-950/90 via-rose-950/80 to-amber-950/90 px-4 py-3 md:px-8"
      role="alert"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 text-sm text-amber-100/95">
        <Lock className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300 md:hidden" aria-hidden />
        <p className="font-medium">
          Tu cuenta está <span className="font-display text-amber-200">CONGELADA</span> — mantén al menos{' '}
          <span className="font-mono text-white">{minPct}%</span> en AIG respecto a tu posición neta.
        </p>
        <span className="ml-auto rounded-full border border-amber-400/40 bg-black/30 px-2.5 py-0.5 font-mono text-xs text-amber-200/90">
          Actual ~{holdingPct.toFixed(1)}% AIG
        </span>
      </div>
    </motion.div>
  );
}
