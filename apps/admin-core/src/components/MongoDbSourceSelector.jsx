import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Database } from 'lucide-react';
import { MONGO_DB_OPTIONS } from '../lib/adminBackendApi.js';

/**
 * Selector de base Mongo para queries admin (`?source=`).
 * @param {{
 *   value: 'genesis' | 'winx' | 'gpulse',
 *   onChange: (id: 'genesis' | 'winx' | 'gpulse') => void,
 *   disabled?: boolean,
 * }} props
 */
function MongoDbSourceSelectorInner({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const current = MONGO_DB_OPTIONS.find((p) => p.id === value) ?? MONGO_DB_OPTIONS[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const select = useCallback(
    (id) => {
      onChange(id);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-[160px] max-w-[min(100%,220px)] items-center justify-between gap-2 rounded-xl border border-violet-500/25 bg-slate-950/80 px-3 py-2.5 text-left text-sm shadow-[0_0_20px_rgba(139,92,246,0.08)] transition hover:border-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Base Mongo para API admin (signals, métricas…)"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Database className="h-4 w-4 shrink-0 text-violet-400/90" aria-hidden />
          <span className="min-w-0 truncate font-semibold text-white">
            <span className="text-slate-500">DB · </span>
            {current.label}
          </span>
          <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
            {current.short}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-xl border border-white/10 bg-[#0a0e18] py-1 shadow-xl backdrop-blur-xl"
          role="listbox"
        >
          {MONGO_DB_OPTIONS.map((p) => (
            <li key={p.id} role="option" aria-selected={p.id === value}>
              <button
                type="button"
                onClick={() => select(p.id)}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-violet-500/10 ${
                  p.id === value ? 'bg-violet-500/15 text-violet-100' : 'text-slate-200'
                }`}
              >
                <span className="font-medium">{p.label}</span>
                <span className="ml-auto font-mono text-[10px] text-slate-500">{p.short}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export const MongoDbSourceSelector = memo(MongoDbSourceSelectorInner);
MongoDbSourceSelector.displayName = 'MongoDbSourceSelector';
