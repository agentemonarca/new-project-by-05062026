import React from 'react';
import { motion } from 'framer-motion';

/**
 * Indicador persistente de sincronización (bucle de retención).
 */
export default function GpulseSynchronizationBar({ percent, className = '' }) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <motion.div
      layout
      initial={{ opacity: 0.85 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`pointer-events-none select-none rounded-full border border-cyan-500/25 bg-black/50 px-3 py-1.5 shadow-[0_0_20px_rgba(34,211,238,0.12)] backdrop-blur-md ${className}`}
      aria-live="polite"
      aria-label={`Sincronización ${Math.round(p)} por ciento`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200/85">Sincronización</span>
        <span className="font-mono text-[11px] font-black tabular-nums text-white/90">{p.toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-violet-500/70"
          initial={false}
          animate={{ width: `${p}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      </div>
    </motion.div>
  );
}
