import React, { memo } from 'react';

/** @typedef {'default'|'primary'|'danger'|'amber'|'cyan'|'violet'|'ghost'} ActionVariant */

const VARIANT_CLASS = /** @type {Record<ActionVariant, string>} */ ({
  default: 'border border-white/10 bg-slate-900/80 text-white hover:bg-slate-800',
  primary: 'border border-cyan-500/35 bg-cyan-600/90 text-white hover:bg-cyan-500',
  danger: 'border border-rose-500/35 bg-rose-600/90 text-white hover:bg-rose-500',
  amber: 'border border-amber-500/30 bg-amber-500/12 text-amber-100 hover:bg-amber-500/18',
  cyan: 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/16',
  violet: 'border border-violet-500/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/16',
  ghost: 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-white',
});

/**
 * Grupo de acciones compactas (estilo exchange).
 * @param {{
 *   items: { id: string, label: string, variant?: ActionVariant, onClick: () => void, disabled?: boolean }[],
 *   className?: string,
 * }} props
 */
function ActionButtonsInner({ items, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {items.map((item) => {
        const v = item.variant ?? 'default';
        return (
          <button
            key={item.id}
            type="button"
            disabled={Boolean(item.disabled)}
            onClick={item.onClick}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${VARIANT_CLASS[v]}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export const ActionButtons = memo(ActionButtonsInner);
ActionButtons.displayName = 'ActionButtons';
