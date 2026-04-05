import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { tokens } from './tokens.js';

export interface PanelContainerProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  accent?: 'cyan' | 'magenta' | 'purple';
}

export function PanelContainer({ title, subtitle, children, className = '', accent = 'cyan' }: PanelContainerProps) {
  const { colors } = tokens;
  const accentColor = accent === 'magenta' ? colors.magenta : accent === 'purple' ? colors.purple : colors.cyan;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={[
        'relative overflow-hidden rounded-2xl border border-white/[0.08] p-5 backdrop-blur-[22px]',
        'shadow-[0_16px_48px_rgba(0,0,0,0.35)]',
        className,
      ].join(' ')}
      style={{
        background: `linear-gradient(155deg, rgba(11,15,26,0.94) 0%, rgba(7,11,20,0.78) 100%)`,
        boxShadow: `0 0 0 1px ${accentColor}18, 0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-30 blur-3xl"
        style={{ background: `radial-gradient(circle, ${accentColor}44 0%, transparent 70%)` }}
      />
      <header className="relative z-[1] mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.32em] text-white/55">{title}</h3>
        {subtitle ? <p className="mt-1 text-[11px] font-mono text-white/35">{subtitle}</p> : null}
      </header>
      <div className="relative z-[1]">{children}</div>
    </motion.section>
  );
}
