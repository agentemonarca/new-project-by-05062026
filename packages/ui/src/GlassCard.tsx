import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { tokens } from './tokens.js';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  glow?: boolean;
}

export function GlassCard({ children, className = '', glow = false, ...rest }: GlassCardProps) {
  const { blur } = tokens;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={[
        'rounded-2xl border border-white/[0.08] p-5 shadow-2xl backdrop-blur-[22px] transition-[box-shadow,transform] duration-300 ease-out hover:border-cyan-400/20',
        glow ? 'shadow-[0_0_48px_rgba(0,240,255,0.12)]' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        background: `linear-gradient(145deg, rgba(11,15,26,0.92) 0%, rgba(7,11,20,0.72) 100%)`,
        borderColor: 'rgba(0, 240, 255, 0.12)',
        backdropFilter: `blur(${blur.glass})`,
        WebkitBackdropFilter: `blur(${blur.glass})`,
        boxShadow: glow
          ? `0 0 0 1px rgba(123, 44, 255, 0.15), 0 24px 64px rgba(0,0,0,0.45)`
          : `0 16px 48px rgba(0,0,0,0.35)`,
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
