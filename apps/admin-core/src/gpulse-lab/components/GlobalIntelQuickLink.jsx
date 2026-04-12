import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';

/**
 * Atajo al laboratorio (informe / análisis) desde vistas del Admin Panel.
 */
export const GlobalIntelQuickLink = memo(function GlobalIntelQuickLink({ label = 'GPulse Lab' }) {
  return (
    <Link
      to="/admin/gpulse-lab"
      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/[0.06] px-3 py-2 text-[11px] font-semibold text-cyan-100/95 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10"
    >
      <Brain className="h-3.5 w-3.5 shrink-0 text-cyan-300/90" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
});

GlobalIntelQuickLink.displayName = 'GlobalIntelQuickLink';
