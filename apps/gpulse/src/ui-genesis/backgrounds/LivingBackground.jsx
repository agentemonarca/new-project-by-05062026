import React from 'react';
import { motion } from 'framer-motion';

/**
 * Floating gradient blobs + subtle animated mesh — base layer for auth / shell.
 */
export function LivingBackground({ className = '' }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#030712] ${className}`}
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-[length:200%_200%] animate-gradientShift opacity-90"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(99, 102, 241, 0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 80% 10%, rgba(236, 72, 153, 0.25), transparent 50%), radial-gradient(ellipse 60% 70% at 50% 100%, rgba(34, 211, 238, 0.2), transparent 55%)',
        }}
      />
      <motion.div
        className="absolute -left-[20%] top-[10%] h-[min(80vw,720px)] w-[min(80vw,720px)] rounded-full bg-gradient-to-br from-cyan-500/25 via-fuchsia-500/15 to-transparent blur-3xl"
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-[15%] bottom-[5%] h-[min(70vw,600px)] w-[min(70vw,600px)] rounded-full bg-gradient-to-tl from-violet-600/30 via-fuchsia-500/10 to-transparent blur-3xl"
        animate={{ x: [0, -35, 25, 0], y: [0, 25, -15, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  );
}
