import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Coins, Crown, Trophy } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.jsx';
import { NeonButton } from '../components/NeonButton.jsx';
import { SectionHeader } from '../components/SectionHeader.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { fadeUpBlur, staggerContainer } from '../motion/variants.js';

const HERO_PTS_CURRENT = 45_000;
const HERO_PTS_TARGET = 100_000;
const HERO_PCT = Math.round((HERO_PTS_CURRENT / HERO_PTS_TARGET) * 100);

/**
 * Promociones y eventos — `currentPath === 'promo'` (Genesis shell).
 */
export function GenesisPromoPage() {
  return (
    <motion.div className="space-y-8 md:space-y-10" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={fadeUpBlur}>
        <SectionHeader
          title="Promociones y Eventos"
          description="Participa en incentivos exclusivos, maximiza tus ganancias y califica a retiros globales."
            action={
            <NeonButton type="button" variant="secondary" className="!normal-case !font-semibold !tracking-normal">
              Mis Trofeos
            </NeonButton>
          }
        />
      </motion.header>

      {/* Hero — main promo */}
      <motion.div variants={fadeUpBlur}>
        <GlassCard
          hover={false}
          glowClassName="shadow-[0_0_48px_-12px_rgba(34,211,238,0.22),0_0_32px_-8px_rgba(139,92,246,0.15)] border-cyan-500/20"
          className="border-cyan-500/15"
          contentClassName="p-0"
        >
          <div className="relative grid gap-8 p-6 md:grid-cols-2 md:gap-10 md:p-8 lg:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_100%_50%,rgba(251,191,36,0.08),transparent_60%)]" />

            <div className="relative z-10 flex flex-col">
              <span className="inline-flex w-fit rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/95">
                Retiro de Liderazgo 2026
              </span>

              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-white md:mt-5 md:text-4xl lg:text-[2.5rem]">
                Destino:{' '}
                <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
                  Dubai
                </span>
              </h2>

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400 md:mt-5 md:text-base md:leading-relaxed">
                Califica acumulando puntos de volumen personal y de red. Los mejores líderes desbloquean un retiro
                exclusivo con experiencia premium en Dubai y acceso a la cumbre anual del protocolo.
              </p>

              <div className="mt-6 md:mt-8">
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-500">
                  PROGRESO DE CALIFICACIÓN
                </p>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-semibold tabular-nums text-cyan-100/95 md:text-base">
                    {HERO_PTS_CURRENT.toLocaleString('es-ES')} / {HERO_PTS_TARGET.toLocaleString('es-ES')} Pts
                  </span>
                </div>
                <div className="mt-3">
                  <ProgressBar value={HERO_PCT} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 md:text-[13px]">
                  <span>Finaliza en 45 días</span>
                  <span className="font-medium text-cyan-200/80">{HERO_PCT}% Completado</span>
                </div>
              </div>

              <div className="mt-6 md:mt-8">
                <NeonButton type="button" variant="primary" className="!normal-case !font-bold !tracking-normal">
                  Ver Bases de Calificación
                </NeonButton>
              </div>
            </div>

            <div className="relative z-10 flex min-h-[240px] items-center justify-center md:min-h-[320px]">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[min(100%,420px)] w-[min(100%,420px)] rounded-full bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.2)_0%,rgba(34,211,238,0.12)_35%,transparent_65%)] blur-2xl" />
                <div className="absolute h-3/4 w-3/4 rounded-full border border-cyan-400/10 shadow-[0_0_60px_rgba(34,211,238,0.12)]" />
              </div>
              <Trophy
                className="relative z-10 h-32 w-32 text-amber-200/95 drop-shadow-[0_0_40px_rgba(251,191,36,0.45)] md:h-44 md:w-44 lg:h-48 lg:w-48"
                strokeWidth={1.15}
                aria-hidden
              />
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Promo grid */}
      <motion.div variants={fadeUpBlur} className="grid gap-4 md:grid-cols-3 md:gap-5">
        <GlassCard
          hover
          glowClassName="shadow-glowCyan hover:shadow-glowMagenta"
          contentClassName="flex h-full flex-col p-5 md:p-6"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-200">
            <Zap className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <span className="mt-4 inline-flex w-fit rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-200/95">
            +10% EXTRA
          </span>
          <h3 className="mt-3 font-display text-lg font-semibold text-white md:text-xl">Bono de Inicio Rápido</h3>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">
            Obtén hasta un 10% adicional sobre tu primera activación al completar minería y staking en las primeras 72
            horas.
          </p>
          <div className="mt-5">
            <NeonButton type="button" variant="primary" className="!w-full !min-w-0 !normal-case !py-3 !text-xs !font-bold">
              Participar Ahora
            </NeonButton>
          </div>
        </GlassCard>

        <GlassCard
          hover
          glowClassName="shadow-glowCyan hover:shadow-glowMagenta"
          contentClassName="flex h-full flex-col p-5 md:p-6"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10 text-violet-200">
            <Coins className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <span className="mt-4 inline-flex w-fit rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-200/95">
            1% SHARE
          </span>
          <h3 className="mt-3 font-display text-lg font-semibold text-white md:text-xl">Sorteo Pool Global</h3>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">
            Participa automáticamente en el sorteo mensual: el 1% del pool global se reparte entre wallets activas que
            cumplan la meta mínima.
          </p>
          <div className="mt-5">
            <NeonButton type="button" variant="primary" className="!w-full !min-w-0 !normal-case !py-3 !text-xs !font-bold">
              Participar Ahora
            </NeonButton>
          </div>
        </GlassCard>

        <GlassCard
          hover
          glowClassName="shadow-glowCyan hover:shadow-glowMagenta"
          contentClassName="flex h-full flex-col p-5 md:p-6"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-200">
            <Crown className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <span className="mt-4 inline-flex w-fit rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-fuchsia-200/95">
            $5,000 USDT
          </span>
          <h3 className="mt-3 font-display text-lg font-semibold text-white md:text-xl">Recompensa de Rango</h3>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">
            Sube de rango antes del cierre del trimestre y desbloquea hasta $5,000 USDT en bonos progresivos según tu
            volumen calificado.
          </p>
          <div className="mt-5">
            <NeonButton type="button" variant="primary" className="!w-full !min-w-0 !normal-case !py-3 !text-xs !font-bold">
              Participar Ahora
            </NeonButton>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
