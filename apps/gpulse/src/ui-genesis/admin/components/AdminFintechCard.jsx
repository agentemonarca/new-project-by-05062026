import React from 'react';
import { motion } from 'framer-motion';
import { fadeUpBlur } from '../../motion/variants.js';

/**
 * Contenedor glass reutilizable para bloques del admin.
 *
 * @param {{
 *   title?: string,
 *   description?: string,
 *   children: React.ReactNode,
 *   className?: string,
 *   variant?: 'default' | 'dense',
 * }} props
 */
export function AdminFintechCard({ title, description, children, className = '', variant = 'default' }) {
  const pad = variant === 'dense' ? 'p-4 md:p-5' : 'p-5 md:p-6';
  return (
    <motion.section variants={fadeUpBlur} className={`rounded-2xl border border-white/[0.08] bg-slate-950/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ${className}`}>
      {(title || description) && (
        <div className={`border-b border-white/[0.06] ${pad} pb-4`}>
          {title ? <h2 className="font-display text-base font-semibold text-white md:text-lg">{title}</h2> : null}
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
      )}
      <div className={title || description ? `${pad} pt-4` : pad}>{children}</div>
    </motion.section>
  );
}
