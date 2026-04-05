import React from 'react';
import { motion } from 'framer-motion';
import { fadeUpBlur } from '../motion/variants.js';

export function AuthCard({ children, className = '' }) {
  return (
    <motion.div
      variants={fadeUpBlur}
      initial="hidden"
      animate="show"
      className={`relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/45 p-8 shadow-glowCyan backdrop-blur-xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70 mix-blend-screen bg-gradient-to-br from-fuchsia-500/12 via-cyan-400/10 to-violet-500/12 bg-[length:200%_200%] animate-gradientShift" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
