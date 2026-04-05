import React from 'react';
import { GlassModal } from '../components/GlassModal.jsx';

/**
 * Lightweight detail surface for RuleHint — not a full-screen block.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title: string,
 *   children: React.ReactNode,
 * }} props
 */
export function RulesDetailModal({ open, onClose, title, children }) {
  return (
    <GlassModal open={open} onClose={onClose} title={title} size="lg" dismissible>
      <div className="max-h-[min(72vh,560px)] overflow-y-auto px-6 py-5 text-[13px] leading-relaxed text-slate-300">{children}</div>
    </GlassModal>
  );
}
