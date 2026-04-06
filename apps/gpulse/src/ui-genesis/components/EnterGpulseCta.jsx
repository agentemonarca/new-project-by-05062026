import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const glowIdle =
  '0 0 18px rgba(139, 92, 246, 0.5), 0 0 36px rgba(34, 211, 238, 0.22), 0 0 56px rgba(139, 92, 246, 0.12)';
const glowPulse =
  '0 0 26px rgba(139, 92, 246, 0.65), 0 0 48px rgba(34, 211, 238, 0.38), 0 0 72px rgba(167, 139, 250, 0.2)';
const glowHover =
  '0 0 32px rgba(139, 92, 246, 0.75), 0 0 56px rgba(34, 211, 238, 0.45), 0 0 88px rgba(34, 211, 238, 0.25)';

/**
 * Primary entry CTA → GPulse lobby (`/gpulse-lobby`) or in-app `onNavigate` (e.g. `navigateTo('gpulse-lobby')`).
 * @param {{ onNavigate?: () => void }} props
 */
export function EnterGpulseCta({ onNavigate }) {
  const navigate = useNavigate();
  const go = () => {
    if (typeof onNavigate === 'function') {
      onNavigate();
      return;
    }
    navigate('/gpulse-lobby');
  };

  return (
    <motion.button
      type="button"
      title="Access the core engine"
      aria-label="Enter G-Pulse — Access the core engine"
      onClick={go}
      className="group relative shrink-0 select-none rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      initial={false}
      animate={{
        boxShadow: [glowIdle, glowPulse, glowIdle],
      }}
      transition={{
        duration: 2.4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      whileHover={{
        scale: 1.03,
        boxShadow: glowHover,
      }}
      whileTap={{ scale: 0.98 }}
    >
      <span
        className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400 opacity-60 blur-md transition-opacity duration-300 group-hover:opacity-90"
        aria-hidden
      />
      <span className="relative flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-violet-500 to-cyan-400 px-4 py-2.5 text-sm font-extrabold tracking-wide text-white shadow-inner ring-1 ring-white/25 md:px-5">
        <Sparkles className="h-4 w-4 shrink-0 text-cyan-100/95" strokeWidth={2.2} aria-hidden />
        Enter G-Pulse
      </span>
    </motion.button>
  );
}
