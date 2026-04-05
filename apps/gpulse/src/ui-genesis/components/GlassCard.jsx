import React from 'react';
import { motion } from 'framer-motion';
import { hoverScale } from '../motion/variants.js';

/**
 * Double-layer glass: base blur + gradient aura (mix-blend-screen).
 */
export function GlassCard({
  children,
  className = '',
  contentClassName = '',
  hover = true,
  glowClassName = 'shadow-glowCyan hover:shadow-glowMagenta',
  as: Component = motion.div,
}) {
  return (
    <Component
      initial="rest"
      whileHover={hover ? 'hover' : undefined}
      whileTap={hover ? 'tap' : undefined}
      variants={hover ? hoverScale : undefined}
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl transition-shadow duration-500 ${glowClassName} ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[length:200%_200%] opacity-70 mix-blend-screen animate-gradientShift"
        style={{
          backgroundImage:
            'linear-gradient(to bottom right, rgba(217, 70, 239, 0.12), rgba(34, 211, 238, 0.12), rgba(139, 92, 246, 0.12))',
        }}
      />
      <div className={`relative z-10 ${contentClassName}`}>{children}</div>
    </Component>
  );
}
