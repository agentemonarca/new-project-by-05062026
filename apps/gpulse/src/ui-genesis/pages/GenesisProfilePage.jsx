import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Brain, Gem, Shield, Sparkles, Trophy, User, Wallet } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { AnimatedMetric } from '../components/AnimatedMetric.jsx';
import { fadeUpBlur, staggerContainer } from '../motion/variants.js';

const RANK_PROGRESS_PCT = 68;
const SECURITY_PCT = 88;
const LEVEL = 42;

const PROFILE_FEED = [
  { user: '@AlphaTrader', message: '🔥 Este usuario está subiendo fuerte' },
  { user: '@CryptoKing', message: '💎 Líder sólido en el ecosistema' },
  { user: '@NodeRunner', message: '🚀 Ejemplo de consistencia' },
];

const ACHIEVEMENTS = [
  { id: 'topg', label: 'Top G Leader', icon: Trophy, glow: 'shadow-[0_0_28px_rgba(251,191,36,0.25)] border-amber-500/30' },
  { id: 'diamond', label: 'Diamond Rank', icon: Gem, glow: 'shadow-[0_0_28px_rgba(34,211,238,0.2)] border-cyan-500/30' },
  { id: 'early', label: 'Early Adopter', icon: Sparkles, glow: 'shadow-[0_0_28px_rgba(217,70,239,0.22)] border-fuchsia-500/30' },
  { id: 'ai', label: 'AI Trader', icon: Brain, glow: 'shadow-[0_0_28px_rgba(139,92,246,0.25)] border-violet-500/30' },
];

function avatarFromAddress(addr) {
  if (!addr || addr.length < 4) return '?';
  return addr.slice(2, 3).toUpperCase();
}

/**
 * Perfil — Web3 identity hub (`nav === 'profile'`).
 * @param {{ walletAddress: string | null, hasSession: boolean }} props
 */
export function GenesisProfilePage({ walletAddress, hasSession }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div className="space-y-8 md:space-y-10" variants={staggerContainer} initial="hidden" animate="show">
      {/* Hero — digital passport */}
      <motion.section variants={fadeUpBlur}>
        <GlassCard
          hover={false}
          glowClassName="border-violet-500/25 shadow-[0_0_48px_-12px_rgba(139,92,246,0.35)]"
          className="overflow-visible"
          contentClassName="relative p-6 md:p-10"
        >
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-8 md:flex-row md:items-start md:gap-10">
            {/* Avatar + aura */}
            <div className="relative mx-auto shrink-0 md:mx-0">
              <motion.div
                className="absolute -inset-3 rounded-full"
                animate={
                  reduceMotion
                    ? {}
                    : {
                        boxShadow: [
                          '0 0 32px rgba(139,92,246,0.45), 0 0 64px rgba(168,85,247,0.25)',
                          '0 0 48px rgba(192,132,252,0.55), 0 0 88px rgba(34,211,238,0.18)',
                          '0 0 32px rgba(139,92,246,0.45), 0 0 64px rgba(168,85,247,0.25)',
                        ],
                        opacity: [0.85, 1, 0.85],
                      }
                }
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute -inset-1 rounded-full bg-gradient-to-br from-violet-500/50 via-fuchsia-500/40 to-cyan-400/40 opacity-80 blur-md"
                animate={reduceMotion ? {} : { rotate: [0, 360] }}
                transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-white/20 bg-gradient-to-br from-slate-900 to-slate-950 text-3xl font-black text-white shadow-inner md:h-32 md:w-32">
                {walletAddress ? (
                  <span className="font-display tracking-tight">{avatarFromAddress(walletAddress)}</span>
                ) : (
                  <User className="h-14 w-14 text-slate-500" strokeWidth={1.25} />
                )}
              </div>

              <motion.div
                className="absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap"
                animate={reduceMotion ? {} : { scale: [1, 1.04, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="inline-flex items-center rounded-full border border-violet-400/40 bg-gradient-to-r from-violet-600/40 to-fuchsia-600/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_20px_rgba(167,139,250,0.45)]">
                  Black Diamond
                </span>
              </motion.div>
            </div>

            <div className="min-w-0 flex-1 space-y-5 text-center md:pt-2 md:text-left">
              <div>
                <h2 className="font-display text-2xl font-bold text-white md:text-3xl">Perfil AiGenesis</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                  Identidad digital, estatus y prueba social en un solo centro. Pasaporte de poder dentro del protocolo.
                </p>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 md:flex-row md:flex-wrap md:items-center md:gap-x-8 md:gap-y-2">
                <p className="text-sm text-slate-300">
                  <span className="text-slate-500">Influencia:</span>{' '}
                  <span className="font-display font-bold tracking-wide text-fuchsia-300">ELITE</span>
                </p>
                <p className="text-sm text-slate-300">
                  <span className="text-slate-500">Comunidad impactada:</span>{' '}
                  <span className="font-mono font-semibold text-cyan-200/90">
                    <AnimatedMetric value={12450} format={(v) => `${Number(v).toLocaleString('es-ES')} usuarios`} />
                  </span>
                </p>
                <p className="text-sm text-slate-300">
                  <span className="text-slate-500">Volumen generado:</span>{' '}
                  <span className="font-mono font-semibold text-emerald-200/90">
                    $
                    <AnimatedMetric
                      value={1_250_000}
                      format={(v) => Number(v).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                    />
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-lg font-bold text-white">
                    Nivel{' '}
                    <AnimatedMetric value={LEVEL} format={(v) => String(Math.round(v))} />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Progreso al siguiente rango
                  </span>
                </div>
                <ProgressBar value={RANK_PROGRESS_PCT} />
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.section>

      {/* Achievements */}
      <motion.section variants={fadeUpBlur}>
        <h3 className="mb-4 font-display text-lg font-bold text-white">Logros</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a, i) => {
            const Icon = a.icon;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                whileHover={reduceMotion ? {} : { scale: 1.04 }}
                className="h-full"
              >
                <GlassCard
                  hover
                  glowClassName={`${a.glow} hover:shadow-glowMagenta`}
                  className="h-full border-white/10"
                  contentClassName="flex flex-col items-center gap-3 p-5 text-center"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-200">
                    <Icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-semibold text-white">{a.label}</p>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Security */}
      <motion.section variants={fadeUpBlur}>
        <GlassCard
          hover={false}
          glowClassName="border-emerald-500/25 shadow-[0_0_32px_-8px_rgba(52,211,153,0.2)]"
          contentClassName="space-y-4 p-5 md:p-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Shield className="h-6 w-6 text-emerald-400" strokeWidth={1.5} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Protección</p>
              <p className="font-display text-lg font-bold text-white">Nivel de Seguridad: ALTO</p>
            </div>
          </div>
          <ProgressBar value={SECURITY_PCT} variant="green" />
        </GlassCard>
      </motion.section>

      {/* Wallet */}
      <motion.section variants={fadeUpBlur}>
        <GlassCard hover={false} glowClassName="shadow-glowCyan" contentClassName="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-200">
                <Wallet className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-mono text-xs text-slate-500">Wallet</p>
                <p className="mt-1 break-all font-mono text-sm text-cyan-200/90 md:text-base">{walletAddress || '—'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-200">
                    <span className="relative flex h-2 w-2">
                      {!reduceMotion ? (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                      ) : null}
                      <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    {walletAddress ? 'ACTIVE' : 'OFFLINE'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Sesión API: {hasSession ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Última transacción</p>
              <p className="mt-1 font-mono text-sm text-slate-300">
                {walletAddress ? 'Hace 2 h · Depósito USDT' : '—'}
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.section>

      {/* Community voice */}
      <motion.section variants={fadeUpBlur}>
        <h3 className="mb-4 font-display text-lg font-bold text-white">Lo que dice la comunidad</h3>
        <div className="flex flex-col gap-3">
          {PROFILE_FEED.map((item, i) => (
            <motion.div
              key={`${item.user}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassCard hover glowClassName="shadow-glowCyan hover:shadow-glowMagenta" contentClassName="p-4 md:p-5">
                <p className="font-mono text-xs font-semibold text-cyan-200/90">{item.user}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.message}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
