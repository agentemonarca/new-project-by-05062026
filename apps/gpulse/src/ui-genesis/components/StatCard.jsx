import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard.jsx';

function useAnimatedNumber(target, enabled, durationMs = 1100) {
  const [v, setV] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setV(target);
      return undefined;
    }
    let startTs;
    let raf;
    const from = v;
    const to = target;
    const step = (t) => {
      if (startTs == null) startTs = t;
      const p = Math.min(1, (t - startTs) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      setV(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional run on target change
  }, [target, enabled]);

  return v;
}

export function StatCard({
  label,
  value,
  suffix = '',
  prefix = '',
  sub,
  animate = true,
  className = '',
}) {
  const tv = typeof value === 'number' ? value : parseFloat(String(value));
  const isNum = !Number.isNaN(tv);
  const animated = useAnimatedNumber(isNum ? tv : 0, animate && isNum);
  const shown = isNum ? (animate ? animated : tv) : value;

  return (
    <GlassCard className={`p-5 ${className}`} hover contentClassName="p-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <motion.p
        className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-white balance-glow"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {prefix}
        {isNum ? Math.round(shown * 100) / 100 : shown}
        {suffix}
      </motion.p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </GlassCard>
  );
}
