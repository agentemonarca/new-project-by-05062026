import React from 'react';
import { motion } from 'framer-motion';
import { hoverScale } from '../motion/variants.js';

export function GradientButton({
  children,
  type = 'button',
  className = '',
  disabled,
  onClick,
  variant = 'primary',
  ...rest
}) {
  const grad =
    variant === 'ghost'
      ? 'bg-white/5 text-white/90 border border-white/15 hover:bg-white/10'
      : 'border-0 text-slate-950 font-semibold bg-gradient-xl animate-gradientShift shadow-glowCyan hover:shadow-glowMagenta';

  const bgStyle =
    variant !== 'ghost'
      ? {
          backgroundImage:
            'linear-gradient(120deg, #22d3ee, #d946ef, #8b5cf6, #22d3ee)',
        }
      : undefined;

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      initial="rest"
      whileHover={disabled ? undefined : 'hover'}
      whileTap={disabled ? undefined : 'tap'}
      variants={hoverScale}
      className={`relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-sm transition-shadow disabled:opacity-45 disabled:pointer-events-none ${grad} ${className}`}
      style={bgStyle}
      {...rest}
    >
      {variant !== 'ghost' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 mix-blend-soft-light"
          style={{
            backgroundImage: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.35))',
          }}
        />
      ) : null}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
