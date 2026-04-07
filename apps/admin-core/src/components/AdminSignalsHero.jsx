import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

/**
 * Señal principal: última NEW_SIGNAL, estilo trading/casino con glow por lado.
 * @param {{ signal: any | null, compact?: boolean }} props
 */
export default function AdminSignalsHero({ signal, compact = false }) {
  const isPlayer = signal?.predictionColor === 'blue';
  const isBanker = signal?.predictionColor === 'red';
  const martingaleLevel = Number(signal?.martingaleLevel ?? 0) || 0;
  const showRisk = martingaleLevel >= 3;

  const glowClass = isPlayer
    ? 'shadow-[0_0_60px_-12px_rgba(59,130,246,0.75),0_0_120px_-24px_rgba(59,130,246,0.35),inset_0_1px_0_0_rgba(255,255,255,0.06)] border-sky-500/40 bg-gradient-to-br from-sky-950/90 via-slate-950/95 to-slate-950'
    : isBanker
      ? 'shadow-[0_0_60px_-12px_rgba(239,68,68,0.65),0_0_120px_-24px_rgba(239,68,68,0.3),inset_0_1px_0_0_rgba(255,255,255,0.06)] border-rose-500/45 bg-gradient-to-br from-rose-950/90 via-slate-950/95 to-slate-950'
      : 'border-white/10 bg-slate-950/90';

  const labelColor = isPlayer ? 'text-sky-300' : isBanker ? 'text-rose-300' : 'text-slate-400';

  if (!signal) {
    return (
      <div
        className={`rounded-2xl border border-white/[0.08] bg-slate-950/80 text-center ${
          compact ? 'px-4 py-6' : 'px-6 py-10'
        }`}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Señal principal</p>
        <p className={`mt-3 font-semibold text-slate-400 ${compact ? 'text-sm' : 'text-lg'}`}>Sin señal en vivo</p>
        <p className="mt-1 text-xs text-slate-600">Esperando NEW_SIGNAL…</p>
      </div>
    );
  }

  return (
    <motion.div
      key={signal.recvId}
      initial={{ opacity: 0.85, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className={`relative overflow-hidden rounded-2xl border ${compact ? 'px-4 py-4 md:px-5 md:py-5' : 'px-6 py-7 md:px-10 md:py-9'} ${glowClass}`}
    >
      <div
        className={`pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl ${
          isPlayer ? 'bg-sky-500/25' : isBanker ? 'bg-rose-500/22' : 'bg-slate-500/10'
        }`}
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Señal principal · {signal.mesa}</p>
          <p
            className={`mt-2 font-black tracking-tight ${labelColor} ${
              compact ? 'text-2xl md:text-3xl' : 'text-4xl md:text-5xl'
            }`}
          >
            {signal.predictionLabel}
          </p>
          {signal.classification ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`signal-type inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  signal.classification.color === 'green'
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
                    : signal.classification.color === 'yellow'
                      ? 'border-amber-400/35 bg-amber-500/10 text-amber-100'
                      : signal.classification.color === 'red'
                        ? 'border-rose-500/35 bg-rose-500/10 text-rose-100'
                        : 'border-white/10 bg-slate-900/60 text-slate-400'
                }`}
              >
                <span aria-hidden>{signal.classification.icon}</span>
                {signal.classification.label}
              </span>
              <span className="signal-direction text-xs font-semibold text-slate-300">
                {signal.classification.direction}
              </span>
            </div>
          ) : null}
          <div className={`mt-3 flex flex-wrap items-center gap-3 text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>
            <span className="font-mono font-semibold text-slate-300">{signal.martingale}</span>
            <span className="text-slate-600">·</span>
            <span>
              Ronda <span className="font-mono text-slate-200">{signal.round}</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-xs text-slate-500">{signal.timestamp}</span>
          </div>
          {signal.id ? (
            <p className="mt-2 font-mono text-[10px] text-slate-600">
              🆔 <span className="text-slate-500">{signal.id}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          {showRisk ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-100 shadow-[0_0_20px_-6px_rgba(245,158,11,0.8)]">
              ⚠️ RIESGO ALTO
            </span>
          ) : null}
          <span
            className={`inline-flex items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/20 font-black uppercase tracking-widest text-amber-50 shadow-[0_0_28px_-6px_rgba(251,191,36,0.85)] ${
              compact ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2.5 text-sm'
            }`}
          >
            <Zap className={`shrink-0 text-amber-200 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} aria-hidden />
            ENTRAR AHORA
          </span>
        </div>
      </div>
    </motion.div>
  );
}
