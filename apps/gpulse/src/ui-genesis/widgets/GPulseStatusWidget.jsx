import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Cpu, LineChart } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.jsx';

export function GPulseStatusWidget({
  engineStatus = 'ONLINE',
  strategy = 'Adaptive consensus',
  confidence = 94.2,
}) {
  return (
    <GlassCard className="p-5" glowClassName="shadow-[0_0_20px_rgba(139,92,246,0.15)]" contentClassName="p-0">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/90">
          <Cpu className="h-3.5 w-3.5" strokeWidth={1.5} />
          G-Pulse
        </span>
        <motion.span
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center gap-1 text-[10px] text-emerald-400/90"
        >
          <Activity className="h-3 w-3" />
          {engineStatus}
        </motion.span>
      </div>
      <p className="font-display text-sm text-slate-300">{strategy}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Confidence</p>
          <p className="font-display text-2xl font-semibold tabular-nums text-cyan-200">{confidence}%</p>
        </div>
        <div className="flex h-10 w-24 items-end justify-between gap-0.5 rounded-lg border border-white/10 bg-slate-950/50 p-1">
          {[40, 72, 55, 88, 65, 92, 78, 95, 82, 100].map((h, i) => (
            <motion.span
              key={i}
              className="w-1.5 rounded-sm bg-gradient-to-t from-violet-600 to-cyan-400"
              initial={{ height: '20%' }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.04, duration: 0.6, type: 'spring' }}
            />
          ))}
        </div>
        <LineChart className="h-8 w-8 text-slate-600 opacity-50" strokeWidth={1} />
      </div>
    </GlassCard>
  );
}
