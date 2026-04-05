import React from 'react';
import { motion } from 'framer-motion';

const tones = {
  cyan: 'border-cyan-400/35 text-cyan-200 shadow-glowCyan bg-cyan-500/10',
  magenta: 'border-fuchsia-400/35 text-fuchsia-200 shadow-[0_0_18px_rgba(236,72,153,0.2)] bg-fuchsia-500/10',
  violet: 'border-violet-400/35 text-violet-200 shadow-glowViolet bg-violet-500/10',
  neutral: 'border-white/15 text-slate-200 bg-white/5',
};

export function GlowBadge({ children, tone = 'cyan', className = '', pulse = false }) {
  return (
    <motion.span
      animate={pulse ? { opacity: [0.85, 1, 0.85] } : undefined}
      transition={pulse ? { duration: 2.4, repeat: Infinity } : undefined}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-widest ${tones[tone] || tones.cyan} ${className}`}
    >
      {children}
    </motion.span>
  );
}
