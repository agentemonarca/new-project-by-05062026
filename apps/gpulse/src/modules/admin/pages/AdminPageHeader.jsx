import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { fadeUpBlur } from '@/ui-genesis/motion/variants.js';

export const AdminPageHeader = memo(function AdminPageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <motion.header
      variants={fadeUpBlur}
      initial="hidden"
      animate="show"
      className="relative overflow-hidden rounded-2xl border border-cyan-500/15 bg-slate-950/75 px-5 py-5 md:px-7 md:py-6"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_95%_-10%,rgba(0,240,255,0.08),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/75">{eyebrow}</p>
          ) : null}
          <h1 className="font-display text-xl font-bold text-white md:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </motion.header>
  );
});
