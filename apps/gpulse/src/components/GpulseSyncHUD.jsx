import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * HUD de sincronización (indicador de estado, no botón).
 * @param {{
 *   syncPercentage: number,
 *   status: 'syncing' | 'synced',
 *   message?: string,
 *   isLightMode?: boolean,
 *   className?: string,
 * }} props
 */
export default function GpulseSyncHUD({
  syncPercentage,
  status,
  message = '',
  isLightMode = false,
  className = '',
}) {
  const p = Math.max(0, Math.min(100, Number(syncPercentage) || 0));

  const tier = useMemo(() => {
    if (p < 30) return 0;
    if (p < 60) return 1;
    if (p < 80) return 2;
    return 3;
  }, [p]);

  const textClass =
    tier === 0
      ? isLightMode
        ? 'text-slate-500'
        : 'text-gray-400'
      : tier === 1
        ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]'
        : tier === 2
          ? 'text-purple-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.3)]'
          : 'text-cyan-300 drop-shadow-[0_0_14px_rgba(34,211,238,0.45)]';

  const glowClass =
    tier >= 3
      ? 'shadow-[0_0_20px_rgba(34,211,238,0.22),0_0_28px_rgba(168,85,247,0.14)]'
      : tier === 1
        ? 'shadow-[0_0_16px_rgba(34,211,238,0.14)]'
        : '';

  const synced = status === 'synced';

  return (
    <motion.div
      layout
      initial={false}
      animate={{ scale: status === 'syncing' ? 1.04 : 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={`pointer-events-none select-none rounded-full border border-white/10 bg-black/30 px-2 py-1 text-xs backdrop-blur-md dark:bg-white/5 ${glowClass} ${className}`}
      aria-live="polite"
      title="Nivel de conexión con el sistema"
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className={`text-[8px] font-black uppercase tracking-[0.18em] ${isLightMode ? 'text-slate-600' : 'text-white/50'}`}
          >
            SYNC
          </span>
          <span className={`font-mono text-[10px] font-black tabular-nums ${textClass}`}>{Math.round(p)}%</span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              synced ? 'bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-cyan-400/90 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.45)]'
            }`}
            aria-hidden
          />
        </div>
        {message ? (
          <p
            className={`max-w-[11rem] truncate text-center text-[8px] font-medium leading-tight ${isLightMode ? 'text-slate-600' : 'text-white/55'}`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
