/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ag: {
          bg: '#070b14',
          secondary: '#0b0f1a',
          cyan: '#00f0ff',
          magenta: '#ff00c8',
          purple: '#7b2cff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(0, 240, 255, 0.15)',
      },
    },
  },
  plugins: [],
};
