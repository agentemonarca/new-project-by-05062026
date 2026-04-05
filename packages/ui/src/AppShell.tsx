import type { ReactNode } from 'react';
import { tokens } from './tokens.js';

export interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

/** Full-viewport layout: sidebar + main column (topbar + content provided by parent). */
export function AppShell({ sidebar, children }: AppShellProps) {
  const { colors } = tokens;
  return (
    <div
      className="flex min-h-screen w-full overflow-hidden font-sans antialiased"
      style={{
        backgroundColor: colors.bg,
        color: tokens.colors.white,
      }}
    >
      {sidebar}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
