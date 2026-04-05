import React from 'react';
import { motion } from 'framer-motion';

/**
 * Cyan / spectrum fill (default) or emerald (security / health).
 * @param {{ value: number, className?: string, variant?: 'default' | 'green' }} props  — `value` is 0–100
 */
export function ProgressBar({ value, className = '', variant = 'default' }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const track =
    variant === 'green'
      ? 'border-emerald-500/30 bg-slate-950/90 shadow-[inset_0_0_14px_rgba(52,211,153,0.12)]'
      : 'border-cyan-500/25 bg-slate-950/90 shadow-[inset_0_0_14px_rgba(34,211,238,0.14)]';
  const fill =
    variant === 'green'
      ? 'bg-gradient-to-r from-emerald-500 to-green-400 shadow-[0_0_18px_rgba(52,211,153,0.45)]'
      : 'bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500 shadow-[0_0_18px_rgba(34,211,238,0.4)]';

  return (
    <div
      className={`relative h-3 w-full overflow-hidden rounded-full ${track} ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={`h-full rounded-full ${fill}`}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
