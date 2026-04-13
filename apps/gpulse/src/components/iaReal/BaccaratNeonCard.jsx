import React from 'react';
import { motion } from 'framer-motion';

/**
 * Compact baccarat card: cyan/rose neon frame aligned with IaRealExecutionLayer tokens.
 * @param {{
 *   displayRank: string,
 *   suit: string,
 *   isRed?: boolean,
 *   isRevealed?: boolean,
 *   isDealt?: boolean,
 *   className?: string,
 * }} props
 */
export function BaccaratNeonCard({
  displayRank,
  suit,
  isRed = false,
  isRevealed = false,
  isDealt = true,
  className = '',
}) {
  const textCls = isRed ? 'text-rose-400' : 'text-slate-100';

  return (
    <div
      className={`gp-baccarat-card-perspective w-[3.5rem] h-[5rem] sm:w-16 sm:h-[5.75rem] ${className}`}
    >
      <motion.div
        className="h-full w-full"
        initial={false}
        animate={{ opacity: isDealt ? 1 : 0, y: isDealt ? 0 : 12 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className={`gp-baccarat-card-inner relative h-full w-full ${isRevealed ? 'gp-baccarat-card-flipped' : ''}`}
          style={{ transformStyle: 'preserve-3d' }}
        >
        {/* Dorso */}
        <div className="gp-baccarat-card-face absolute inset-0 rounded-xl border border-cyan-500/35 bg-gradient-to-br from-slate-950 via-slate-900 to-black shadow-[0_0_18px_rgba(34,211,238,0.22)] overflow-hidden">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,0.25),transparent_55%)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-9 w-9 rounded-full border border-cyan-400/40 shadow-[0_0_14px_rgba(34,211,238,0.35)] flex items-center justify-center">
              <span className="text-[10px] font-black text-cyan-300/90">G</span>
            </div>
          </div>
          <div className="absolute inset-1 rounded-lg border border-white/10" />
        </div>

        {/* Frente */}
        <div
          className={`gp-baccarat-card-face gp-baccarat-card-front absolute inset-0 rounded-xl border border-white/20 bg-white flex flex-col justify-between p-1.5 sm:p-2 shadow-lg ${textCls}`}
        >
          <div className={`text-sm sm:text-base font-black leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
            {displayRank}
            <span className="block text-[10px] mt-0.5 opacity-90">{suit}</span>
          </div>
          <div
            className={`absolute inset-0 flex items-center justify-center opacity-[0.12] ${isRed ? 'text-rose-600' : 'text-slate-900'}`}
          >
            <span className="text-3xl sm:text-4xl font-black">{suit}</span>
          </div>
          <div
            className={`text-sm sm:text-base font-black leading-none rotate-180 ${isRed ? 'text-rose-600' : 'text-slate-900'}`}
          >
            {displayRank}
            <span className="block text-[10px] mt-0.5 opacity-90">{suit}</span>
          </div>
        </div>
        </div>
      </motion.div>
    </div>
  );
}
