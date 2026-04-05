import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Award,
  Cpu,
  Crown,
  Gem,
  Pickaxe,
  Sparkles,
  Timer,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { AnimatedMetric } from '../components/AnimatedMetric.jsx';
import { useCore } from '../core/CoreContext.jsx';
import { multiplierFromBooster } from '../core/energyEngine.js';
import { staggerContainer, fadeUpBlur } from '../motion/variants.js';
import { coreRemainingUsdt, coreProgress01, USDT_TO_AIG_DISPLAY } from '../types/miningCore.js';

const TABS = [
  { id: 'mining', label: 'MINERÍA' },
  { id: 'booster', label: 'BOOSTER' },
  { id: 'ranks', label: 'RANGOS' },
  { id: 'rewards', label: 'PREMIOS' },
];

const RANK_NFTS = [
  {
    id: 'bd',
    name: 'Black Diamond',
    badge: 'BD',
    benefits: ['Bonus binario +2% cap', 'Prioridad en retiros', 'Acceso Genesis Lobby premium'],
    requirements: ['Volumen equipo 500k+', 'Staking activo 12m', 'Holding AIG ≥ 7%'],
  },
  {
    id: 'em',
    name: 'Emerald',
    badge: 'EM',
    benefits: ['Boost de minería visible', 'Pool promocional', 'NFT rango conmemorativo'],
    requirements: ['Volumen equipo 120k+', '3 referidos activos en staking'],
  },
  {
    id: 'sa',
    name: 'Sapphire',
    badge: 'SP',
    benefits: ['Multiplicador booster base', 'Soporte prioridad', 'Badge en red'],
    requirements: ['Primer hito de volumen', 'Cuenta ACTIVA del protocolo'],
  },
];

const REWARD_NFTS = [
  {
    id: 'dubai',
    title: 'Dubai Trip',
    description: 'Experiencia exclusiva patrocinada — vuelo + hospitality (simulado)',
    locked: true,
    progress: 34,
  },
  {
    id: 'bonus',
    title: 'Bonus USDT',
    description: 'Pool adicional por hitos de volumen trimestral',
    locked: false,
    progress: 100,
  },
  {
    id: 'special',
    title: 'Special rewards',
    description: 'Acceso a drops limitados y colaboraciones marca',
    locked: true,
    progress: 62,
  },
];

function miningPackName(core, index) {
  return `Miner Pack ${String(index + 1).padStart(2, '0')}`;
}

function boosterTier(contribution) {
  const v = Number(contribution) || 0;
  if (v >= 10000) return { level: 'Nivel III', tier: 3 };
  if (v >= 5000) return { level: 'Nivel II', tier: 2 };
  return { level: 'Nivel I', tier: 1 };
}

function formatDurationDays(startTime) {
  const d = Math.max(0, Math.floor((Date.now() - startTime) / 86400000));
  if (d === 0) return '<1 día';
  if (d === 1) return '1 día';
  return `${d} días`;
}

function formatTimeRemainingSec(core, now = Date.now()) {
  const r = coreRemainingUsdt(core);
  if (r <= 0 || core.ratePerSecond <= 0) return '—';
  const sec = r / core.ratePerSecond;
  if (sec >= 86400) return `${Math.floor(sec / 86400)}d restantes`;
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h restantes`;
  return `${Math.floor(sec / 60)}m restantes`;
}

/**
 * NFT hub — multi-category: mining & booster reflect live core state; ranks & rewards are protocol UX.
 * @param {{ onNavigate: (id: string) => void }} props
 */
export function GenesisNftPage({ onNavigate }) {
  const reduceMotion = useReducedMotion();
  const { cores, hasSession, totalYield } = useCore();
  const safeCores = cores ?? [];
  const [tab, setTab] = useState('mining');

  const globalMult = useMemo(() => multiplierFromBooster(safeCores), [safeCores]);

  const miningCores = useMemo(() => safeCores.filter((c) => c.type === 'mining'), [safeCores]);
  const boosterCores = useMemo(() => safeCores.filter((c) => c.type === 'booster'), [safeCores]);

  const miningRateSum = useMemo(
    () =>
      miningCores.reduce((s, c) => s + (coreRemainingUsdt(c) > 0 ? c.ratePerSecond : 0), 0),
    [miningCores],
  );

  const miningRateTotal = miningRateSum || 1e-12;

  return (
    <motion.div className="space-y-8" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={fadeUpBlur} className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-400/90">NFT · Instrumentos activos</p>
        <h2 className="font-display text-2xl font-bold text-white md:text-3xl">Tu ecosistema tokenizado</h2>
        <p className="max-w-2xl text-sm text-slate-400">
          Tus NFT no son solo arte: son <span className="font-semibold text-cyan-200/90">máquinas de flujo</span> ligadas
          a minería, booster y estatus del protocolo.
        </p>
      </motion.header>

      {/* Tabs */}
      <motion.div variants={fadeUpBlur} className="sticky top-0 z-20 -mx-1 border-b border-white/10 bg-slate-950/75 py-2 backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:py-0 md:backdrop-blur-none">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none md:flex-wrap md:overflow-visible">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition md:px-5 ${
                tab === t.id
                  ? 'bg-gradient-to-r from-cyan-500/25 to-violet-500/25 text-white shadow-[0_0_24px_rgba(34,211,238,0.2)] ring-1 ring-cyan-400/35'
                  : 'border border-white/10 bg-slate-950/50 text-slate-400 hover:border-cyan-500/25 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === 'mining' ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {miningCores.length === 0 ? (
                <GlassCard hover={false} className="border-cyan-500/20 sm:col-span-2" contentClassName="p-8">
                  <p className="text-sm text-slate-400">No hay packs de minería sincronizados. Inyecta liquidez en minería.</p>
                  <GradientButton type="button" className="mt-4 !py-2 !text-xs" onClick={() => onNavigate('mining')}>
                    Ir a minería
                  </GradientButton>
                </GlassCard>
              ) : (
                miningCores.map((core, i) => {
                  const remain = coreRemainingUsdt(core);
                  const active = remain > 0 && hasSession;
                  const completed = !active && hasSession;
                  const powerShare = Math.round((core.ratePerSecond / miningRateTotal) * 100);
                  const generated = core.totalGenerated + core.accumulated;
                  return (
                    <motion.div
                      key={core.id}
                      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    >
                      <GlassCard
                        hover
                        className="border-cyan-500/25"
                        glowClassName={`border-cyan-400/30 shadow-[0_0_40px_-10px_rgba(34,211,238,0.35)] ${active ? 'shadow-[0_0_48px_-8px_rgba(34,211,238,0.4)]' : ''}`}
                        contentClassName="flex flex-col p-6"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/35 bg-gradient-to-br from-cyan-500/20 to-slate-900/90 shadow-[0_0_20px_rgba(34,211,238,0.25)]">
                            <Cpu className="h-6 w-6 text-cyan-200" strokeWidth={1.5} />
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                              active
                                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                                : 'border-slate-500/40 bg-slate-800/60 text-slate-400'
                            }`}
                          >
                            {active ? 'ACTIVE' : completed ? 'COMPLETED' : '—'}
                          </span>
                        </div>
                        <h3 className="font-display text-lg font-semibold text-white">{miningPackName(core, i)}</h3>
                        <p className="mt-1 text-xs text-slate-500">Motor sincronizado con core · {core.id}</p>
                        <dl className="mt-4 space-y-2 text-sm">
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Power %</dt>
                            <dd className="font-mono text-cyan-100 tabular-nums">{powerShare}% del cluster</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Duración activa</dt>
                            <dd className="text-slate-300">{formatDurationDays(core.startTime)}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Generado (USDT)</dt>
                            <dd className="font-mono tabular-nums text-white">
                              <AnimatedMetric value={generated} format={(v) => Number(v).toFixed(2)} />
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Progreso ciclo</dt>
                            <dd className="font-mono text-slate-300">{Math.round(coreProgress01(core) * 100)}%</dd>
                          </div>
                        </dl>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <GradientButton
                            type="button"
                            variant="ghost"
                            className="!min-w-0 flex-1 !px-4 !py-2 !text-xs"
                            onClick={() => onNavigate('mining')}
                          >
                            Ver Detalles
                          </GradientButton>
                          <GradientButton type="button" className="!min-w-0 flex-1 !px-4 !py-2 !text-xs" onClick={() => onNavigate('booster')}>
                            Expandir rendimiento
                          </GradientButton>
                        </div>
                      </GlassCard>
                    </motion.div>
                  );
                })
              )}
            </div>
          ) : null}

          {tab === 'booster' ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {boosterCores.length === 0 ? (
                <GlassCard hover={false} className="border-fuchsia-500/25 sm:col-span-2" contentClassName="p-8">
                  <p className="text-sm text-slate-400">Sin booster NFT activo. Acelera el motor en Booster.</p>
                  <GradientButton type="button" className="mt-4 !py-2 !text-xs" onClick={() => onNavigate('booster')}>
                    Ir a Booster
                  </GradientButton>
                </GlassCard>
              ) : (
                boosterCores.map((core, i) => {
                  const { level } = boosterTier(core.contribution);
                  const miningBase = miningCores.reduce(
                    (s, c) => s + (coreRemainingUsdt(c) > 0 ? c.ratePerSecond : 0),
                    0,
                  );
                  const boosterRate = coreRemainingUsdt(core) > 0 ? core.ratePerSecond : 0;
                  const impactPct =
                    miningBase > 0 ? Math.min(100, Math.round((boosterRate / miningBase) * 88)) : 0;
                  const multDisplay = globalMult.toFixed(2);
                  return (
                    <motion.div
                      key={core.id}
                      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    >
                      <GlassCard
                        hover
                        className="border-fuchsia-500/25"
                        glowClassName="border-fuchsia-400/35 shadow-[0_0_44px_-10px_rgba(217,70,239,0.38)]"
                        contentClassName="flex flex-col p-6"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-400/35 bg-gradient-to-br from-fuchsia-500/25 to-violet-950/80 shadow-[0_0_24px_rgba(217,70,239,0.3)]">
                            <Zap className="h-6 w-6 text-fuchsia-200" strokeWidth={1.5} />
                          </div>
                          <Pickaxe className="h-5 w-5 text-violet-300/50" />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-white">Booster NFT {i + 1}</h3>
                        <p className="mt-1 text-xs text-fuchsia-200/70">{level}</p>
                        <dl className="mt-4 space-y-2 text-sm">
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Multiplicador sistema</dt>
                            <dd className="font-mono text-fuchsia-100 tabular-nums">{multDisplay}×</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Impacto estimado</dt>
                            <dd className="font-mono text-violet-200 tabular-nums">+{impactPct}%</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="flex items-center gap-1 text-slate-500">
                              <Timer className="h-3.5 w-3.5" /> Tiempo restante
                            </dt>
                            <dd className="text-slate-300">{formatTimeRemainingSec(core)}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">AIG /s (vista)</dt>
                            <dd className="font-mono text-xs text-slate-400">
                              {(core.ratePerSecond * USDT_TO_AIG_DISPLAY).toFixed(6)}
                            </dd>
                          </div>
                        </dl>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <GradientButton
                            type="button"
                            variant="ghost"
                            className="!min-w-0 flex-1 !border-fuchsia-500/35 !px-4 !py-2 !text-xs !text-fuchsia-100"
                            onClick={() => onNavigate('booster')}
                          >
                            Optimizar
                          </GradientButton>
                          <GradientButton type="button" className="!min-w-0 flex-1 !px-4 !py-2 !text-xs" onClick={() => onNavigate('mining')}>
                            Ver impacto
                          </GradientButton>
                        </div>
                      </GlassCard>
                    </motion.div>
                  );
                })
              )}
            </div>
          ) : null}

          {tab === 'ranks' ? (
            <div className="grid gap-5 md:grid-cols-3">
              {RANK_NFTS.map((rank, i) => (
                <motion.div
                  key={rank.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={reduceMotion ? undefined : { y: -5, scale: 1.02 }}
                >
                  <GlassCard
                    hover
                    className="border-amber-400/30"
                    glowClassName="border-amber-400/40 shadow-[0_0_48px_-8px_rgba(251,191,36,0.35)]"
                    contentClassName="p-6"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/45 bg-gradient-to-br from-amber-500/30 via-yellow-600/20 to-amber-950/60 shadow-[0_0_28px_rgba(251,191,36,0.35)]">
                        <span className="font-display text-lg font-bold text-amber-100">{rank.badge}</span>
                      </div>
                      <Crown className="h-6 w-6 text-amber-300/80" />
                    </div>
                    <h3 className="mt-5 font-display text-xl font-semibold text-white">{rank.name}</h3>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Beneficios</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
                      {rank.benefits.map((b) => (
                        <li key={b} className="flex gap-2">
                          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/90" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Requisitos</p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-400">
                      {rank.requirements.map((r) => (
                        <li key={r} className="flex gap-2">
                          <Gem className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          ) : null}

          {tab === 'rewards' ? (
            <div className="grid gap-5 md:grid-cols-3">
              {REWARD_NFTS.map((rw, i) => (
                <motion.div
                  key={rw.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }}
                >
                  <GlassCard
                    hover
                    className="border-violet-500/25"
                    glowClassName={
                      rw.locked
                        ? 'border-slate-500/30 shadow-[0_0_32px_-12px_rgba(100,116,139,0.25)]'
                        : 'border-amber-400/30 shadow-[0_0_40px_-10px_rgba(251,191,36,0.28)]'
                    }
                    contentClassName="p-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-600/25 to-amber-900/20">
                        <Trophy className="h-6 w-6 text-amber-200" strokeWidth={1.4} />
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${
                          rw.locked
                            ? 'border-slate-500/40 bg-slate-800/70 text-slate-400'
                            : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                        }`}
                      >
                        {rw.locked ? 'Locked' : 'Unlocked'}
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold text-white">{rw.title}</h3>
                    <p className="mt-2 text-sm text-slate-400">{rw.description}</p>
                    <div className="mt-4">
                      <div className="mb-2 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        <span>Progreso</span>
                        <span>{rw.progress}%</span>
                      </div>
                      <ProgressBar value={rw.progress} />
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                      <Award className="h-4 w-4 text-amber-400/70" />
                      Premio de protocolo · no garantizado
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <motion.footer variants={fadeUpBlur} className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-center text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-cyan-500/80" />
          Multiplicador global actual (cores): <span className="font-mono text-cyan-200/90">{globalMult.toFixed(2)}×</span> ·
          Yield dim. <span className="font-mono text-slate-400">{totalYield.toFixed(3)}</span>
        </span>
      </motion.footer>
    </motion.div>
  );
}
