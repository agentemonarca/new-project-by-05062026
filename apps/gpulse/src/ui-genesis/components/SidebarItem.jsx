import React from 'react';
import { motion } from 'framer-motion';

/**
 * @param {{
 *   icon?: React.ComponentType<{ className?: string, strokeWidth?: number }>,
 *   label: string,
 *   active?: boolean,
 *   onClick?: () => void,
 *   nested?: boolean,
 *   compact?: boolean,
 * }} props
 */
export function SidebarItem({ icon: Icon, label, active, onClick, nested = false, compact = false }) {
  const rail = compact ? 'md:justify-center md:gap-0 md:px-0 md:py-2.5 md:pr-0' : '';
  const pad = compact ? 'pl-3 md:pl-0' : nested ? 'pl-4' : 'pl-3';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={false}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      title={compact ? label : undefined}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex w-full items-center gap-3 rounded-xl border-l-2 py-2.5 pr-3 text-left font-display text-sm transition-all duration-300 ease-out ${pad} ${rail} ${
        active
          ? 'border-l-cyan-400 bg-gradient-to-r from-cyan-500/[0.14] via-violet-500/[0.1] to-transparent text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_0_28px_-4px_rgba(34,211,238,0.2),0_0_20px_-8px_rgba(139,92,246,0.25)]'
          : 'border-l-transparent text-slate-400 hover:border-l-violet-400/50 hover:bg-white/[0.05] hover:text-slate-100 hover:shadow-[0_0_26px_-6px_rgba(139,92,246,0.35),0_0_18px_-10px_rgba(34,211,238,0.12)]'
      } ${compact ? 'md:border-l-transparent md:bg-transparent md:shadow-none md:hover:bg-white/[0.06]' : ''}`}
    >
      <span
        className={`relative z-10 flex shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${
          active
            ? 'border border-cyan-400/35 bg-cyan-500/15 shadow-[0_0_16px_rgba(34,211,238,0.25)]'
            : 'border border-white/10 bg-white/[0.04] group-hover:border-violet-400/30 group-hover:bg-violet-500/10'
        } ${nested && !compact ? 'h-8 w-8' : 'h-9 w-9'} ${compact ? 'md:h-10 md:w-10' : ''}`}
      >
        {Icon ? (
          <Icon
            className={`transition-colors duration-300 ${
              active ? 'text-cyan-200' : 'text-slate-400 group-hover:text-violet-200'
            } ${nested && !compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`}
            strokeWidth={1.5}
          />
        ) : null}
      </span>
      <span className={`relative z-10 min-w-0 flex-1 leading-snug ${compact ? 'md:sr-only' : ''}`}>
        {label}
      </span>
    </motion.button>
  );
}
