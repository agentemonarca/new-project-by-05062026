import React, { memo } from 'react';
import { Activity, Bell } from 'lucide-react';
import { ProjectSelector } from './ProjectSelector.jsx';

/**
 * @param {{
 *   title?: string,
 *   subtitle?: string,
 *   projects: { id: string, label: string, code?: string }[],
 *   currentProject: string | null,
 *   onProjectChange: (id: string) => void,
 *   isSwitchingProject?: boolean,
 *   toast?: null | { type: string, message: string },
 * }} props
 */
function AdminHeaderInner({
  title = 'Control Core',
  subtitle = 'Administración global multi-proyecto',
  projects,
  currentProject,
  onProjectChange,
  isSwitchingProject = false,
  toast,
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#05080f]/90 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-400" aria-hidden />
            <h1 className="truncate font-display text-lg font-bold tracking-tight text-white lg:text-xl">
              {title}
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ProjectSelector
            projects={projects}
            value={currentProject}
            onChange={onProjectChange}
            disabled={isSwitchingProject}
          />
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-slate-900/80 p-2.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Alertas"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>

      {toast?.message ? (
        <div
          className={`mx-4 mb-2 rounded-lg px-3 py-2 text-xs lg:mx-6 ${
            toast.type === 'error'
              ? 'border border-rose-500/30 bg-rose-500/10 text-rose-100'
              : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}

      {isSwitchingProject ? (
        <div className="h-0.5 w-full overflow-hidden bg-cyan-500/20">
          <div className="h-full w-1/2 animate-pulse bg-cyan-400/60" />
        </div>
      ) : (
        <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      )}
    </header>
  );
}

export const AdminHeader = memo(AdminHeaderInner);
AdminHeader.displayName = 'AdminHeader';
