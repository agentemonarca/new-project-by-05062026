import React from 'react';
import { motion } from 'framer-motion';
import { fadeUpBlur } from '../../motion/variants.js';

/**
 * Cabecera consistente por módulo (fintech / control plane).
 *
 * @param {{
 *   eyebrow?: string,
 *   title: string,
 *   subtitle?: string,
 *   children?: React.ReactNode,
 * }} props
 */
export function AdminPanelPageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <motion.header
      variants={fadeUpBlur}
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-950/75 px-5 py-5 md:px-7 md:py-6"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_90%_-10%,rgba(251,191,36,0.1),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/75">{eyebrow}</p>
          ) : null}
          <h1 className="font-display text-xl font-bold text-white md:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </motion.header>
  );
}
