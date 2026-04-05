import React from 'react';

/**
 * Page section title + description + optional trailing action (AiGenesis pattern).
 * @param {{ title: string, description: string, action?: React.ReactNode }} props
 */
export function SectionHeader({ title, description, action }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400 md:mt-3 md:text-base md:leading-relaxed">
          {description}
        </p>
      </div>
      {action ? <div className="flex shrink-0 items-start md:pt-1">{action}</div> : null}
    </div>
  );
}
