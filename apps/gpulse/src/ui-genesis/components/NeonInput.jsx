import React, { forwardRef } from 'react';

/**
 * Custom-styled field — not a raw browser input look.
 */
export const NeonInput = forwardRef(function NeonInput(
  { label, hint, error, className = '', id, type = 'text', ...props },
  ref,
) {
  const inputId = id || (label ? `neon-${String(label).replace(/\s+/g, '-').toLowerCase()}` : undefined);

  return (
    <label className={`block ${className}`}>
      {label ? (
        <span className="mb-1.5 block font-display text-xs font-medium uppercase tracking-wider text-cyan-200/70">
          {label}
        </span>
      ) : null}
      <div className="group relative rounded-xl border border-white/10 bg-slate-950/50 backdrop-blur-md transition-all duration-300 focus-within:border-cyan-400/50 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.18)]">
        <input
          ref={ref}
          id={inputId}
          type={type}
          className="w-full rounded-xl bg-transparent px-4 py-3 font-display text-sm text-white placeholder:text-slate-500 outline-none ring-0"
          {...props}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-focus-within:opacity-100"
          style={{
            boxShadow: 'inset 0 0 0 1px rgba(236, 72, 153, 0.2)',
          }}
        />
      </div>
      {hint && !error ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs text-fuchsia-400">{error}</p> : null}
    </label>
  );
});
