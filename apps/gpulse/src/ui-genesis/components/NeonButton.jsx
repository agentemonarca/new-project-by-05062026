import React from 'react';
import { motion } from 'framer-motion';
import { hoverScale } from '../motion/variants.js';

/**
 * High-gloss neon CTA — outline + solid variants for lobby / premium flows.
 * @param {{ variant?: 'primary' | 'outline' | 'secondary', className?: string, type?: string, disabled?: boolean, onClick?: () => void, children?: React.ReactNode }} props
 */
export function NeonButton({
  children,
  type = 'button',
  className = '',
  disabled,
  onClick,
  variant = 'primary',
  ...rest
}) {
  const primary =
    'border-0 text-slate-950 font-bold bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500 shadow-[0_0_28px_rgba(34,211,238,0.35),0_0_48px_rgba(168,85,247,0.2)] hover:shadow-[0_0_36px_rgba(34,211,238,0.45),0_0_64px_rgba(217,70,239,0.25)]';
  const outline =
    'border-2 border-cyan-400/50 bg-[#070b14]/80 text-white/95 backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.12)] hover:border-cyan-300/70 hover:shadow-[0_0_28px_rgba(34,211,238,0.22)]';
  const secondary =
    'border border-white/15 bg-white/[0.06] text-sm font-semibold text-white/95 !tracking-normal shadow-none hover:border-white/25 hover:bg-white/[0.1]';

  const styles =
    variant === 'outline' ? outline : variant === 'secondary' ? secondary : primary;

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      initial="rest"
      whileHover={disabled ? undefined : 'hover'}
      whileTap={disabled ? undefined : 'tap'}
      variants={hoverScale}
      className={`relative inline-flex min-w-0 items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-3.5 text-sm font-display uppercase tracking-wide transition-shadow duration-300 disabled:pointer-events-none disabled:opacity-45 ${variant === 'secondary' ? '!min-w-0 !px-5 !py-2.5' : 'min-w-[200px]'} ${styles} ${className}`}
      {...rest}
    >
      {variant === 'primary' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-35 mix-blend-soft-light"
          style={{
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)',
          }}
        />
      ) : null}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
