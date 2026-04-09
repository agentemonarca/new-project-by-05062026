/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      zIndex: {
        bg: 'var(--z-bg)',
        layout: 'var(--z-layout)',
        surface: 'var(--z-surface)',
        table: 'var(--z-table)',
        cards: 'var(--z-cards)',
        effects: 'var(--z-effects)',
        hud: 'var(--z-hud)',
        overlay: 'var(--z-overlay)',
        alert: 'var(--z-alert)',
        /** Legacy aliases (admin shell / older classes) */
        base: 'var(--z-layout)',
        content: 'var(--z-surface)',
        panel: 'var(--z-layout)',
        modal: 'var(--z-overlay)',
      },
      fontFamily: {
        display: ['"Exo 2"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'gpulse-core': {
          '0%, 100%': {
            opacity: '0.75',
            transform: 'scale(1)',
            boxShadow: '0 0 28px rgba(34, 211, 238, 0.25)',
          },
          '50%': {
            opacity: '1',
            transform: 'scale(1.07)',
            boxShadow: '0 0 52px rgba(34, 211, 238, 0.45)',
          },
        },
        'gpulse-halo': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(1)' },
          '50%': { opacity: '0.65', transform: 'scale(1.08)' },
        },
        'gpulse-table-breathe': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.95', transform: 'scale(1.02)' },
        },
        /** READY_TO_RESOLVE: mismo ritmo visual, ciclo más corto (anticipación). */
        'gpulse-table-breathe-fast': {
          '0%, 100%': { opacity: '0.62', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.022)' },
        },
        'gpulse-shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'gpulse-card-glow': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(34, 211, 238, 0.12)' },
          '50%': { boxShadow: '0 0 28px rgba(34, 211, 238, 0.35)' },
        },
        /** Espera inteligente (WAITING_RESULT): velos suaves, sin estridencia */
        'gpulse-wait-shimmer': {
          '0%, 100%': { opacity: '0.03' },
          '50%': { opacity: '0.1' },
        },
        'gpulse-wait-breathe': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.97', filter: 'brightness(1.04)' },
        },
        'gpulse-wait-breathe-fast': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1.02)' },
          '50%': { opacity: '0.96', filter: 'brightness(1.07)' },
        },
      },
      animation: {
        'gpulse-core': 'gpulse-core 2.4s ease-in-out infinite',
        'gpulse-halo': 'gpulse-halo 2.4s ease-in-out infinite',
        'gpulse-table-breathe': 'gpulse-table-breathe 3.2s ease-in-out infinite',
        'gpulse-table-breathe-fast': 'gpulse-table-breathe-fast 2.35s ease-in-out infinite',
        'gpulse-shimmer': 'gpulse-shimmer 2.8s linear infinite',
        'gpulse-card-glow': 'gpulse-card-glow 1.8s ease-in-out infinite',
        'gpulse-wait-shimmer': 'gpulse-wait-shimmer 4.5s ease-in-out infinite',
        'gpulse-wait-breathe': 'gpulse-wait-breathe 5s ease-in-out infinite',
        'gpulse-wait-breathe-fast': 'gpulse-wait-breathe-fast 3.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
