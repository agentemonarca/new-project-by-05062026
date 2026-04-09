import React from 'react';
import { motion } from 'framer-motion';

/**
 * @param {{
 *   pattern: ('P'|'B'|'T'|'*')[],
 *   highlightIndex: number,
 *   predictionSide: 'P'|'B'|'T'|null,
 *   confidence: number | null,
 *   tiroCurrent: number,
 *   tiroMax: number,
 *   showPredictionPulse: boolean,
 * }} props
 */
export default function BaccaratIntelligenceStrip({
  pattern,
  highlightIndex,
  predictionSide,
  confidence,
  tiroCurrent,
  tiroMax,
  showPredictionPulse,
}) {
  const slots = Array.isArray(pattern) && pattern.length === 6 ? pattern : ['*', '*', '*', '*', '*', '*'];

  return (
    <div className="flex w-full flex-col gap-2 border-b border-white/[0.07] bg-black/25 px-[clamp(0.5rem,1.5vw,1rem)] py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[clamp(0.5625rem,0.5vw+0.45rem,0.6875rem)] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Patrón · 6
        </span>
        <span className="font-mono text-[clamp(0.625rem,0.65vw+0.45rem,0.75rem)] tabular-nums text-cyan-200/90">
          TIRO {Math.min(Math.max(tiroCurrent, 0), tiroMax)} / {tiroMax}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {slots.map((cell, i) => {
          const active = i === highlightIndex;
          const isEmpty = cell === '*';
          const bg =
            !isEmpty && cell === 'P'
              ? 'border-cyan-500/50 bg-cyan-950/50 text-cyan-100'
              : !isEmpty && cell === 'B'
                ? 'border-pink-500/50 bg-pink-950/40 text-pink-100'
                : !isEmpty && cell === 'T'
                  ? 'border-amber-500/50 bg-amber-950/40 text-amber-100'
                  : 'border-white/[0.12] bg-black/30 text-slate-600';
          return (
            <motion.div
              key={`bead-${i}-${cell}`}
              animate={active ? { scale: [1, 1.06, 1], boxShadow: ['0 0 0 rgba(34,211,238,0)', '0 0 18px rgba(34,211,238,0.35)', '0 0 0 rgba(34,211,238,0)'] } : {}}
              transition={{ duration: 1.1, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
              className={`flex h-8 min-w-[1.75rem] items-center justify-center rounded-md border font-mono text-[11px] font-bold tabular-nums ${bg} ${
                active ? 'ring-1 ring-cyan-400/40' : ''
              }`}
            >
              {isEmpty ? '·' : cell}
            </motion.div>
          );
        })}
      </div>

      {predictionSide != null ? (
        <div
          className={`flex flex-wrap items-center justify-center gap-2 rounded-lg border px-2 py-1.5 font-mono text-[clamp(0.625rem,0.7vw+0.45rem,0.8125rem)] ${
            showPredictionPulse ? 'animate-pulse border-violet-500/35 bg-violet-950/30' : 'border-white/[0.08] bg-black/20'
          }`}
        >
          <span className="text-slate-500">IA · predicción</span>
          <span
            className={
              predictionSide === 'P'
                ? 'font-bold text-cyan-200'
                : predictionSide === 'B'
                  ? 'font-bold text-pink-200'
                  : 'font-bold text-amber-200'
            }
          >
            {predictionSide}
          </span>
          {confidence != null ? (
            <span className="tabular-nums text-slate-400">
              conf <span className="text-slate-200">{confidence}%</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
