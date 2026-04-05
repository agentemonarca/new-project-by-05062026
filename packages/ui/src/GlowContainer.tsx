import type { ReactNode } from 'react';
import { tokens } from './tokens.js';

export interface GlowContainerProps {
  children: ReactNode;
  className?: string;
  /** Corner accent color */
  accent?: 'cyan' | 'magenta' | 'purple';
}

export function GlowContainer({ children, className = '', accent = 'cyan' }: GlowContainerProps) {
  const { colors } = tokens;
  const c = accent === 'magenta' ? colors.magenta : accent === 'purple' ? colors.purple : colors.cyan;
  return (
    <div className={`relative min-h-0 ${className}`}>
      <div
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-60 blur-2xl"
        style={{
          background: `radial-gradient(ellipse at top left, ${c}33 0%, transparent 55%)`,
        }}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
