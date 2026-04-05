import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { tokens } from './tokens.js';

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}

export function MetricCard({ label, value, hint, className = '' }: MetricCardProps) {
  const { colors } = tokens;
  return (
    <motion.div
      layout
      className={[
        'rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 transition-colors duration-300',
        'hover:border-cyan-400/20 hover:bg-white/[0.05]',
        className,
      ].join(' ')}
      style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04)` }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
    >
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">{label}</p>
      <div className="mt-1.5 font-mono text-lg font-bold tabular-nums text-white/95" style={{ textShadow: `0 0 20px ${colors.cyan}22` }}>
        {value}
      </div>
      {hint ? <p className="mt-1 text-[10px] text-white/35">{hint}</p> : null}
    </motion.div>
  );
}
