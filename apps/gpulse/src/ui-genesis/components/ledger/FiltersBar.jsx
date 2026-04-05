import React, { memo, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';

/**
 * @param {{
 *   search: string,
 *   onSearchChange: (v: string) => void,
 *   onRefresh?: () => void,
 *   loading?: boolean,
 *   groupBy?: 'none' | 'day' | 'category',
 *   onGroupByChange?: (v: 'none' | 'day' | 'category') => void,
 * }} props
 */
function FiltersBarInner({
  search,
  onSearchChange,
  onRefresh,
  loading = false,
  groupBy,
  onGroupByChange,
}) {
  const onChange = useCallback((ev) => onSearchChange(ev.target.value), [onSearchChange]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <label className="relative flex min-w-0 flex-1 items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-500" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={onChange}
          placeholder="Search title, summary, kind, tx hash…"
          className="w-full rounded-xl border border-white/10 bg-slate-950/60 py-2.5 pl-10 pr-4 font-mono text-xs text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {onGroupByChange != null && groupBy != null ? (
          <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Group
            <select
              value={groupBy}
              onChange={(ev) => onGroupByChange(/** @type {'none' | 'day' | 'category'} */ (ev.target.value))}
              className="rounded-lg border border-white/10 bg-slate-950/80 px-2 py-2 font-mono text-[11px] text-slate-200 focus:border-cyan-500/40 focus:outline-none"
            >
              <option value="none">Flat timeline</option>
              <option value="day">By day</option>
              <option value="category">By category</option>
            </select>
          </label>
        ) : null}
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/30 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh feed
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const FiltersBar = memo(FiltersBarInner);
