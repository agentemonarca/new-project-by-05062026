import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Exo 2"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundSize: {
        'gradient-xl': '200% 200%',
      },
      keyframes: {
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        floatBlob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(4%, -6%) scale(1.05)' },
          '66%': { transform: 'translate(-5%, 4%) scale(0.96)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.45', transform: 'scale(1)' },
          '50%': { opacity: '0.75', transform: 'scale(1.02)' },
        },
        spinSlow: {
          from: { transform: 'rotate(12deg)' },
          to: { transform: 'rotate(372deg)' },
        },
        loaderPulse: {
          '0%, 100%': { opacity: '0.55', strokeWidth: '2' },
          '50%': { opacity: '1', strokeWidth: '3' },
        },
      },
      animation: {
        gradientShift: 'gradientShift 6s ease infinite',
        floatBlob: 'floatBlob 14s ease-in-out infinite',
        breathe: 'breathe 4.5s ease-in-out infinite',
        spinSlow: 'spinSlow 12s linear infinite',
        loaderPulse: 'loaderPulse 1.8s ease-in-out infinite',
      },
      boxShadow: {
        glowCyan: '0 0 25px rgba(0, 255, 255, 0.15)',
        glowCyanLg: '0 0 35px rgba(0, 255, 255, 0.22)',
        glowMagenta: '0 0 35px rgba(255, 0, 200, 0.25)',
        glowViolet: '0 0 28px rgba(139, 92, 246, 0.2)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
