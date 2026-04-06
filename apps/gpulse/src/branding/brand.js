/**
 * AiGenesis — single source of truth for product identity (UI + meta).
 * Assets live in `public/` so paths are root-absolute.
 */

export const BRAND = {
  name: 'AiGenesis',
  productLine: 'G-Pulse',
  tagline: 'G-Pulse Core',
  /** Browser tab title */
  htmlTitle: 'AiGenesis · G-Pulse',

  /** Horizontal / default mark (square icon works as full logo in-app) */
  logo: {
    src: '/logo-icon.png',
    alt: 'AiGenesis',
  },

  /** Favicon + compact chrome */
  icon: {
    src: '/logo-icon.png',
    alt: '',
  },

  /** Canonical palette (reference for CSS / Tailwind extensions) */
  colors: {
    cyan: '#22d3ee',
    violet: '#8b5cf6',
    fuchsia: '#d946ef',
    slate950: '#020617',
    slate900: '#0f172a',
    slate200: '#e2e8f0',
  },

  /** Shared “exchange” chrome — icon container */
  shell: {
    iconFrame:
      'flex shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/15 to-violet-600/15 text-cyan-200 shadow-[0_0_20px_-8px_rgba(34,211,238,0.4)]',
    wordmarkGradient: 'bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-500 bg-clip-text text-transparent',
  },
};
