import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { tokens } from './tokens.js';

export interface NeonButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  variant?: 'cyan' | 'magenta' | 'ghost';
}

export function NeonButton({
  children,
  variant = 'cyan',
  className = '',
  type = 'button',
  ...rest
}: NeonButtonProps) {
  const { colors } = tokens;
  const gradient =
    variant === 'magenta'
      ? `linear-gradient(135deg, ${colors.magenta} 0%, ${colors.purple} 100%)`
      : variant === 'ghost'
        ? 'transparent'
        : `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.purple} 100%)`;
  const border =
    variant === 'ghost' ? `1px solid rgba(0, 240, 255, 0.25)` : '1px solid rgba(255,255,255,0.12)';
  const text = variant === 'ghost' ? colors.cyan : '#070b14';

  return (
    <motion.button
      type={type}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={[
        'relative overflow-hidden rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-[0.2em] transition-shadow duration-300 ease-out',
        variant === 'ghost' ? 'text-cyan-300' : 'text-[#070b14]',
        className,
      ].join(' ')}
      style={{
        background: gradient,
        border,
        color: text,
        boxShadow:
          variant === 'ghost'
            ? '0 0 24px rgba(0, 240, 255, 0.08)'
            : `0 0 28px rgba(0, 240, 255, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)`,
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
