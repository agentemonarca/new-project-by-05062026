import React from 'react';
import { motion } from 'framer-motion';

/** Circular “consciousness” loader — soft neon rings */
export function AnimatedLoader({ size = 56, label = 'Synchronizing' }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-1 rounded-full border-2 border-t-fuchsia-400/80 border-r-transparent border-b-violet-400/50 border-l-transparent"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-[18%] rounded-full bg-gradient-to-br from-cyan-400/40 via-fuchsia-500/30 to-violet-600/40 blur-sm animate-breathe"
          layout
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[10px] font-bold uppercase tracking-tighter text-white/90">AG</span>
        </div>
      </div>
      {label ? (
        <motion.p
          className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/70"
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          {label}
        </motion.p>
      ) : null}
    </div>
  );
}
