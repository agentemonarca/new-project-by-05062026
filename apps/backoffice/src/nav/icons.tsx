import type { ReactNode } from 'react';

const iconClass = 'h-4 w-4';

export const IconDashboard = (): ReactNode => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M4 4h7v7H4V4zM13 4h7v4h-7V4zM13 10h7v10h-7V10zM4 13h7v7H4v-7z" strokeLinejoin="round" />
  </svg>
);

export const IconNetwork = (): ReactNode => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" strokeLinecap="round" />
  </svg>
);

export const IconWallet = (): ReactNode => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="3" y="6" width="18" height="14" rx="2" />
    <path d="M3 10h15a2 2 0 012 2v0a2 2 0 01-2 2H3" />
    <circle cx="17" cy="13" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconHistory = (): ReactNode => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M4 6h16M4 12h10M4 18h14" strokeLinecap="round" />
    <circle cx="18" cy="12" r="2" fill="currentColor" stroke="none" opacity={0.35} />
  </svg>
);

export const IconConsole = (): ReactNode => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="3" y="4" width="18" height="14" rx="2" strokeLinejoin="round" />
    <path d="M7 9l2 2-2 2M11 15h5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 20h8" strokeLinecap="round" />
  </svg>
);

export const IconGpulse = (): ReactNode => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" strokeLinejoin="round" />
  </svg>
);

export const IconSettings = (): ReactNode => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="3" />
    <path
      d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      strokeLinecap="round"
    />
  </svg>
);

/** Emergency / legacy entry (sidebar fallback). */
export const IconLegacy = (): ReactNode => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
    <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
  </svg>
);

export const IconSupport = (): ReactNode => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M8 10h8M8 14h5M12 22a8 8 0 100-16 8 8 0 000 16z" strokeLinejoin="round" />
  </svg>
);
