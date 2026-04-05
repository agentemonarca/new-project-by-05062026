import React from 'react';
import { motion } from 'framer-motion';
import { Binary, Zap } from 'lucide-react';
import { GlassCard } from '../GlassCard.jsx';
import { AnimatedMetric } from '../AnimatedMetric.jsx';
import { useStakingEngineStore } from '../../stores/stakingEngineStore.js';

const DEFAULT_BONUS_PCT = 11;

function safeVolumeFromTeamFlat(teamFlat) {
  const rows = Array.isArray(teamFlat) ? teamFlat : [];
  return rows.reduce((s, u) => s + (u?.active ? (Number(u?.volume) || 0) : 0), 0);
}

/**
 * Binary bonus rules gated by global economy (staking + AIG% + not frozen).
 * @param {{
 *   userEconomicallyActive?: boolean,
 *   data?: { team?: { left?: { volume?: number }, right?: { volume?: number } }, bonusPct?: number } | null,
 * }} props — pass `data: null` to skip render (e.g. loading).
 */
export function StakingBinaryEngine({ userEconomicallyActive = false, data }) {
  const bonusPctFromStore = useStakingEngineStore((s) => {
    const n = Number(s?.binaryBonusPct);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_BONUS_PCT;
  });

  const storeVolume = useStakingEngineStore((s) => {
    try {
      if (typeof s?.getTeamStakingVolume === 'function') {
        const v = s.getTeamStakingVolume();
        if (Number.isFinite(Number(v))) return Math.max(0, Number(v));
      }
    } catch {
      /* ignore */
    }
    return safeVolumeFromTeamFlat(s?.teamFlat);
  });

  if (data === null) return null;

  const safeData = data != null && typeof data === 'object' ? data : {};
  const teamLeftVol = Number(safeData?.team?.left?.volume);
  const teamRightVol = Number(safeData?.team?.right?.volume);
  const hasStructuredVolumes =
    Number.isFinite(teamLeftVol) && Number.isFinite(teamRightVol) && (teamLeftVol > 0 || teamRightVol > 0);

  const volume = hasStructuredVolumes ? Math.max(0, teamLeftVol) + Math.max(0, teamRightVol) : storeVolume;

  const bonusPctRaw = Number(safeData?.bonusPct);
  const bonusPct =
    Number.isFinite(bonusPctRaw) && bonusPctRaw > 0 ? bonusPctRaw : bonusPctFromStore;

  const displayActive =
    typeof userEconomicallyActive === 'boolean' ? userEconomicallyActive : Boolean(userEconomicallyActive);

  return (
    <GlassCard
      hover={false}
      glowClassName={
        displayActive ? 'border-violet-500/25 shadow-[0_0_36px_-8px_rgba(139,92,246,0.25)]' : 'border-rose-500/20'
      }
      contentClassName="space-y-4 p-5 md:p-6"
    >
      <div className="flex items-center gap-2">
        <Binary className="h-5 w-5 text-violet-300" strokeWidth={1.75} />
        <h2 className="font-display text-base font-semibold text-white">Motor Binario Activado por Staking</h2>
      </div>
      <p className="text-xs leading-relaxed text-slate-400">
        Volumen de staking del equipo y bonificación de red. Si tu cuenta no está ACTIVA (staking + mín. 7% AIG, sin
        congelación), no se acreditan bonus aunque el equipo produzca volumen.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Volumen staking del equipo</p>
          <p className="mt-1 font-mono text-xl font-bold text-cyan-200">
            $
            <AnimatedMetric
              value={Math.max(0, volume)}
              format={(v) => Number(v).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
            />
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tu bonus</p>
          <div className="mt-1 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-300" />
            <span className="font-display text-2xl font-bold text-white">{bonusPct}%</span>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
        <p>
          <span className="font-semibold text-emerald-200">SI</span> tu cuenta está ACTIVA → ganas sobre el volumen del
          equipo.
        </p>
        <p className="mt-2">
          <span className="font-semibold text-rose-300">SI NO</span> → <span className="font-bold text-rose-200">no</span>{' '}
          recibes bonus binario acumulado.
        </p>
      </div>
      {!displayActive ? (
        <motion.p
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          Activa staking y cumple el mínimo AIG para desbloquear ganancias del equipo
        </motion.p>
      ) : null}
    </GlassCard>
  );
}
