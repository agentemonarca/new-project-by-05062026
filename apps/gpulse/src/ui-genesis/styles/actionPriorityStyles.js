/** Shared visual tokens for priority-scored action / insight cards (user NextAction + admin insights). */
export const ACTION_PRIORITY_STYLES = {
  high: {
    wrap: 'border-amber-400/50 bg-gradient-to-br from-amber-950/55 via-slate-950/85 to-slate-950 shadow-[0_0_40px_rgba(251,191,36,0.22)] ring-1 ring-amber-400/40',
    glassGlow: 'border-amber-400/45 shadow-[0_0_40px_-10px_rgba(251,191,36,0.35)]',
    badge: 'border-amber-400/55 bg-amber-500/25 text-amber-50',
    cta: 'bg-gradient-to-r from-amber-500 to-fuchsia-600 text-white shadow-[0_0_28px_rgba(251,191,36,0.4)]',
    impact: 'text-amber-100',
  },
  medium: {
    wrap: 'border-cyan-500/40 bg-slate-950/75 shadow-[0_0_28px_rgba(34,211,238,0.14)]',
    glassGlow: 'border-cyan-500/45 shadow-[0_0_36px_-10px_rgba(34,211,238,0.28)]',
    badge: 'border-cyan-400/45 bg-cyan-500/15 text-cyan-50',
    cta: 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-[0_0_22px_rgba(139,92,246,0.35)]',
    impact: 'text-cyan-100',
  },
  low: {
    wrap: 'border-white/12 bg-slate-950/55',
    glassGlow: 'border-white/15 shadow-[0_0_28px_-8px_rgba(148,163,184,0.14)]',
    badge: 'border-white/18 bg-white/[0.06] text-slate-200',
    cta: 'border border-cyan-500/45 bg-cyan-500/10 text-cyan-50 hover:bg-cyan-500/18',
    impact: 'text-slate-100',
  },
  healthy: {
    wrap: 'border-emerald-500/40 bg-slate-950/75 shadow-[0_0_28px_rgba(52,211,153,0.16)]',
    glassGlow: 'border-emerald-500/40 shadow-[0_0_36px_-10px_rgba(52,211,153,0.22)]',
    badge: 'border-emerald-400/45 bg-emerald-500/15 text-emerald-50',
    cta: 'border border-emerald-500/45 bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/25',
    impact: 'text-emerald-100',
  },
};
