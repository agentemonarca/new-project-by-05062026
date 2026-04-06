import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radar } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.jsx';
import { NeonButton } from '../components/NeonButton.jsx';

const ringDelays = ['0s', '0.8s', '1.6s', '2.4s'];

/**
 * GPulse Oracle lobby — immersive boot / scan visual (Genesis shell).
 * @param {{ onBackToDashboard: () => void, onActivateMembership?: () => void }} props
 */
export function GPulseLobby({ onBackToDashboard, onActivateMembership }) {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-[#070b14] px-4 py-10 md:py-14">
      {/* Concentric radial rings — cyan, pulse / ping */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 flex h-[min(140vw,900px)] w-[min(140vw,900px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        aria-hidden
      >
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-full border border-cyan-400/[0.14] shadow-[0_0_40px_rgba(34,211,238,0.08)]"
            style={{
              width: `${38 + i * 18}%`,
              height: `${38 + i * 18}%`,
            }}
            initial={{ scale: 0.92, opacity: 0.35 }}
            animate={{
              scale: [0.92, 1.04, 0.92],
              opacity: [0.25, 0.5, 0.25],
            }}
            transition={{
              duration: 5.5 + i * 0.6,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: parseFloat(ringDelays[i]) || 0,
            }}
          />
        ))}
        <span className="absolute h-[32%] w-[32%] rounded-full border border-cyan-400/25 shadow-[0_0_60px_rgba(34,211,238,0.15)] animate-ping [animation-duration:4s]" />
      </div>

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Top icon — rounded square, cyan glow, Radar, magenta status dot */}
        <div className="relative mb-8 md:mb-10">
          <motion.div
            className="relative rounded-2xl border border-cyan-400/45 bg-gradient-to-br from-slate-900/90 to-slate-950/95 p-5 shadow-[0_0_48px_rgba(34,211,238,0.38),0_0_80px_rgba(34,211,238,0.12),inset_0_1px_0_0_rgba(255,255,255,0.08)] md:p-6"
            animate={{
              boxShadow: [
                '0 0 48px rgba(34,211,238,0.38), 0 0 80px rgba(34,211,238,0.12), inset 0 1px 0 0 rgba(255,255,255,0.08)',
                '0 0 56px rgba(34,211,238,0.48), 0 0 100px rgba(34,211,238,0.18), inset 0 1px 0 0 rgba(255,255,255,0.1)',
                '0 0 48px rgba(34,211,238,0.38), 0 0 80px rgba(34,211,238,0.12), inset 0 1px 0 0 rgba(255,255,255,0.08)',
              ],
            }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Radar className="mx-auto h-12 w-12 text-cyan-200 md:h-14 md:w-14" strokeWidth={1.35} />
          </motion.div>
          <motion.span
            className="absolute -right-0.5 -top-0.5 z-20 h-3 w-3 rounded-full border border-fuchsia-400/50 bg-gradient-to-br from-fuchsia-400 to-fuchsia-600 shadow-[0_0_14px_rgba(217,70,239,0.95)]"
            animate={{ scale: [1, 1.2, 1], boxShadow: ['0 0 14px rgba(217,70,239,0.95)', '0 0 22px rgba(217,70,239,1)', '0 0 14px rgba(217,70,239,0.95)'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl lg:text-6xl xl:text-7xl">
          <span className="text-white">GPulse </span>
          <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
            Oracle
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/60 md:mt-8 md:text-base">
          El motor predictivo está escaneando la red neuronal global. Las señales se consolidan en tiempo real para
          maximizar la precisión del protocolo.
        </p>

        {/* Stats — GlassCard row */}
        <div className="mt-10 grid w-full max-w-4xl gap-4 md:mt-12 md:grid-cols-3">
          <GlassCard
            hover={false}
            glowClassName="!shadow-[0_0_32px_rgba(34,211,238,0.22)] border-cyan-500/35"
            className="!border-cyan-500/25"
            contentClassName="p-5 md:p-6"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/80">Precisión actual</p>
            <p className="mt-3 font-display text-3xl font-bold tabular-nums text-white md:text-4xl">98.4%</p>
          </GlassCard>

          <GlassCard hover={false} glowClassName="shadow-[0_0_24px_rgba(255,255,255,0.06)]" contentClassName="p-5 md:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Nodos analizados</p>
            <p className="mt-3 font-display text-3xl font-bold tabular-nums text-white md:text-4xl">12,048</p>
          </GlassCard>

          <GlassCard
            hover={false}
            glowClassName="!shadow-[0_0_36px_rgba(217,70,239,0.22)] border-fuchsia-500/30"
            className="relative !overflow-hidden !border-fuchsia-500/25"
            contentClassName="relative z-10 p-5 md:p-6"
          >
            <motion.div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(217,70,239,0.35), transparent 65%), radial-gradient(ellipse 60% 50% at 20% 0%, rgba(34,211,238,0.12), transparent 55%)',
              }}
              animate={{ opacity: [0.28, 0.45, 0.28] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200/85">Estado del sistema</p>
            <p className="relative mt-3 font-display text-lg font-semibold text-white md:text-xl">Sincronizando...</p>
          </GlassCard>
        </div>

        <div className="mt-10 flex w-full max-w-xl flex-col items-stretch justify-center gap-3 sm:flex-row sm:gap-4 md:mt-12">
          <NeonButton variant="outline" className="!normal-case !font-semibold !tracking-normal" onClick={onBackToDashboard}>
            Regresar al Panel Principal
          </NeonButton>
          {onActivateMembership ? (
            <NeonButton
              variant="outline"
              className="!normal-case !font-semibold !tracking-normal !border-fuchsia-400/35 !text-fuchsia-100"
              onClick={onActivateMembership}
            >
              Activar membresía GPulse
            </NeonButton>
          ) : null}
          <NeonButton
            variant="primary"
            className="!normal-case !font-semibold !tracking-normal"
            onClick={() => navigate('/gpulse')}
          >
            Abrir App GPulse
          </NeonButton>
        </div>
      </motion.div>
    </div>
  );
}
