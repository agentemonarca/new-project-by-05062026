import React, { memo } from 'react';

/** Placeholder durante `isSwitchingProject` — evita flash de datos mezclados. */
function ProjectSwitchSkeletonInner() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Cargando proyecto">
      <div className="h-8 w-2/3 max-w-md rounded-lg bg-white/[0.06]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
      <div className="h-40 rounded-xl bg-white/[0.04]" />
    </div>
  );
}

export const ProjectSwitchSkeleton = memo(ProjectSwitchSkeletonInner);
ProjectSwitchSkeleton.displayName = 'ProjectSwitchSkeleton';
