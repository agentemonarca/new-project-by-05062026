import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Binary } from 'lucide-react';
import { GlassCard } from '../GlassCard.jsx';
import { ProgressBar } from '../ProgressBar.jsx';

/**
 * Admin network view: global legs, synthetic leaders, imbalance heuristic.
 *
 * @param {{
 *   totalVol: number,
 *   leftPts: number,
 *   rightPts: number,
 *   imbalancePct: number,
 *   severity: 'low'|'medium'|'high',
 *   leaders: { id: string, label: string, sharePct: number }[],
 *   onOpenNetwork?: () => void,
 * }} props
 */
export function AdminBinaryPanel({
  totalVol,
  leftPts,
  rightPts,
  imbalancePct,
  severity,
  leaders,
  onOpenNetwork,
}) {
  const balance01 = totalVol > 0 ? (2 * Math.min(leftPts, rightPts)) / totalVol : 0;
  const alertCls =
    severity === 'high'
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
      : severity === 'medium'
        ? 'border-amber-500/35 bg-amber-500/10 text-amber-100'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';

  return (
    <GlassCard className="p-5 md:p-6" hover={false} glowClassName="border-violet-500/25 shadow-[0_0_32px_-12px_rgba(139,92,246,0.25)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Binary className="h-5 w-5 text-violet-400" />
          <div>
            <h3 className="font-display text-base font-semibold text-white">Binario · panel operativo</h3>
            <p className="text-[11px] text-slate-500">Volumen global agregado · referencia administrativa</p>
          </div>
        </div>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-mono text-violet-200">
          Σ {totalVol.toLocaleString()} pts
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Izquierda</p>
          <p className="mt-1 font-display text-xl font-bold text-white">{leftPts.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Derecha</p>
          <p className="mt-1 font-display text-xl font-bold text-white">{rightPts.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
          <span>Equilibrio de match</span>
          <span>{Math.round(balance01 * 100)}%</span>
        </div>
        <ProgressBar value={Math.min(100, balance01 * 100)} />
      </div>

      <div
        className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${alertCls}`}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-90" />
        <div>
          <p className="font-semibold">Detección de desequilibrio</p>
          <p className="mt-0.5 text-[11px] opacity-95">
            Δ relativo {imbalancePct}% · severidad {severity.toUpperCase()}. Priorizar seguimiento en pierna menor.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Líderes sintéticos (share)</p>
        <ul className="mt-2 space-y-2">
          {leaders.map((L, i) => (
            <motion.li
              key={L.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs"
            >
              <span className="text-slate-200">{L.label}</span>
              <span className="font-mono text-violet-200/95">{L.sharePct.toFixed(1)}%</span>
            </motion.li>
          ))}
        </ul>
      </div>

      {onOpenNetwork ? (
        <button
          type="button"
          onClick={onOpenNetwork}
          className="mt-4 text-xs font-medium text-cyan-400 hover:text-cyan-300"
        >
          Abrir vista comunidad / red →
        </button>
      ) : null}
    </GlassCard>
  );
}
