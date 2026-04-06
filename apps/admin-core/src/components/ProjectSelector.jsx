import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Building2 } from 'lucide-react';

/**
 * Cambio de proyecto — todo el panel depende de `currentProject`.
 * @param {{
 *   projects: { id: string, label: string, code?: string }[],
 *   value: string | null,
 *   onChange: (id: string) => void,
 *   disabled?: boolean,
 * }} props
 */
function ProjectSelectorInner({ projects, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const current = projects.find((p) => p.id === value) ?? projects[0];

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

  if (!projects.length) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        Sin proyectos configurados
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-[200px] max-w-[min(100%,280px)] items-center justify-between gap-3 rounded-xl border border-cyan-500/25 bg-slate-950/80 px-4 py-2.5 text-left text-sm shadow-[0_0_24px_rgba(34,211,238,0.08)] transition hover:border-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-cyan-400/90" aria-hidden />
          <span className="min-w-0 truncate font-semibold text-white">
            {current?.label ?? 'Proyecto'}
          </span>
          {current?.code ? (
            <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
              {current.code}
            </span>
          ) : null}
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
          {projects.map((p) => (
            <li key={p.id} role="option" aria-selected={p.id === value}>
              <button
                type="button"
                onClick={() => select(p.id)}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-cyan-500/10 ${
                  p.id === value ? 'bg-cyan-500/15 text-cyan-100' : 'text-slate-200'
                }`}
              >
                <span className="font-medium">{p.label}</span>
                {p.code ? (
                  <span className="ml-auto font-mono text-[10px] text-slate-500">{p.code}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export const ProjectSelector = memo(ProjectSelectorInner);
ProjectSelector.displayName = 'ProjectSelector';
