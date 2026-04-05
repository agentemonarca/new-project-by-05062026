import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Crown, Star, TrendingUp } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.jsx';
import { NeonButton } from '../components/NeonButton.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { AnimatedMetric } from '../components/AnimatedMetric.jsx';
import { fadeUpBlur, staggerContainer } from '../motion/variants.js';

const VOLUME_CAP_USDT = 12_000_000;

function formatCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(v));
}

const leaders = [
  {
    rank: 1,
    name: '@CryptoKing',
    followers: 12450,
    reputation: 4.9,
    influence: 'ELITE',
    communityImpact: 184200,
    quote: 'Construyendo el futuro del ecosistema',
    reactions: { fire: 1200, rocket: 980, diamond: 430 },
    volumeUsdt: 3_850_000,
  },
  {
    rank: 2,
    name: '@OracleNode',
    followers: 8920,
    reputation: 4.8,
    influence: 'HIGH',
    communityImpact: 126400,
    quote: 'Consistencia y visión a largo plazo.',
    reactions: { fire: 890, rocket: 720, diamond: 310 },
    volumeUsdt: 2_640_000,
  },
  {
    rank: 3,
    name: '@AIGWhale',
    followers: 7100,
    reputation: 4.7,
    influence: 'HIGH',
    communityImpact: 98300,
    quote: 'La red define el límite — yo amplío el horizonte.',
    reactions: { fire: 654, rocket: 540, diamond: 288 },
    volumeUsdt: 2_100_000,
  },
  {
    rank: 4,
    name: '@ChainBuilder',
    followers: 5430,
    reputation: 4.6,
    influence: 'HIGH',
    communityImpact: 72100,
    quote: '',
    reactions: { fire: 410, rocket: 380, diamond: 120 },
    volumeUsdt: 1_420_000,
  },
  {
    rank: 5,
    name: '@PulseRunner',
    followers: 4980,
    reputation: 4.5,
    influence: 'HIGH',
    communityImpact: 61500,
    quote: '',
    reactions: { fire: 360, rocket: 290, diamond: 95 },
    volumeUsdt: 1_180_000,
  },
  {
    rank: 6,
    name: '@VaultKeeper',
    followers: 3210,
    reputation: 4.4,
    influence: 'HIGH',
    communityImpact: 40200,
    quote: '',
    reactions: { fire: 220, rocket: 180, diamond: 64 },
    volumeUsdt: 890_000,
  },
];

const communityFeed = [
  { user: '@AlphaTrader', message: '🔥 @CryptoKing está imparable!', reaction: '🔥' },
  { user: '@Web3Master', message: 'Gracias por el liderazgo 💎', reaction: '💎' },
  { user: '@NodeRunner', message: 'Inspiración total 🚀', reaction: '🚀' },
  { user: '@DiamondHands', message: 'El ecosistema nunca duerme. Sigamos subiendo.', reaction: '💎' },
];

function avatarLetter(handle) {
  const s = handle.replace(/^@/, '');
  return s.slice(0, 1).toUpperCase();
}

function LeaderHoverPanel({ leader, position }) {
  if (!leader || !position) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
      transition={{ duration: 0.15 }}
      className="fixed z-[120] w-[260px] rounded-xl border border-violet-500/25 bg-slate-950/95 p-4 shadow-[0_0_40px_rgba(139,92,246,0.35)] backdrop-blur-xl"
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <Star className="h-4 w-4 text-amber-400" fill="currentColor" />
        <span className="font-semibold tabular-nums text-white">
          <AnimatedMetric value={leader.reputation} format={(v) => Number(v).toFixed(1)} />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reputación</span>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Nivel de influencia
        <span className="ml-2 font-display text-sm font-bold tracking-wide text-fuchsia-300">{leader.influence}</span>
      </p>
      <p className="mt-2 text-xs text-slate-500">Impacto comunitario</p>
      <p className="font-mono text-lg font-bold text-cyan-200">
        <AnimatedMetric value={leader.communityImpact} format={(v) => Number(v).toLocaleString('es-ES')} />
      </p>
    </motion.div>
  );
}

function PodiumCard({ leader, reduceMotion }) {
  const r = leader.rank;
  const glowByRank =
    r === 1
      ? 'shadow-[0_0_56px_-8px_rgba(251,191,36,0.45),0_0_40px_-8px_rgba(34,211,238,0.35),0_0_48px_-12px_rgba(217,70,239,0.25)] border-amber-400/35'
      : r === 2
        ? 'shadow-[0_0_40px_-10px_rgba(34,211,238,0.28),0_0_32px_-8px_rgba(167,139,250,0.22)] border-cyan-400/25'
        : 'shadow-[0_0_32px_-10px_rgba(139,92,246,0.2),0_0_24px_-8px_rgba(34,211,238,0.12)] border-white/12';

  return (
    <motion.div
      whileHover={reduceMotion ? {} : { scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="h-full"
    >
      <GlassCard
        hover
        glowClassName={`${glowByRank} hover:shadow-[0_0_60px_-6px_rgba(34,211,238,0.35)]`}
        className={`h-full ${r === 1 ? 'ring-1 ring-amber-400/25' : ''}`}
        contentClassName="flex h-full flex-col p-5 md:p-6"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] font-display text-sm font-black text-white">
            #{r}
          </span>
          {r === 1 ? (
            <motion.div
              animate={
                reduceMotion
                  ? {}
                  : {
                      scale: [1, 1.12, 1],
                      filter: [
                        'drop-shadow(0 0 12px rgba(251,191,36,0.7))',
                        'drop-shadow(0 0 22px rgba(251,191,36,0.95))',
                        'drop-shadow(0 0 12px rgba(251,191,36,0.7))',
                      ],
                    }
              }
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="text-amber-300"
            >
              <Crown className="h-8 w-8" strokeWidth={1.5} aria-hidden />
            </motion.div>
          ) : (
            <Crown className="h-6 w-6 text-slate-600/80" strokeWidth={1.25} aria-hidden />
          )}
        </div>

        <h3 className="mt-4 font-display text-lg font-bold text-white md:text-xl">{leader.name}</h3>
        <p className="mt-2 text-sm italic leading-relaxed text-slate-400">&ldquo;{leader.quote}&rdquo;</p>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-y border-white/10 py-3 text-sm">
          <span className="inline-flex items-center gap-1 font-medium text-orange-200">
            🔥 <AnimatedMetric value={leader.reactions.fire} format={formatCompact} />
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-cyan-200">
            🚀 <AnimatedMetric value={leader.reactions.rocket} format={formatCompact} />
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-fuchsia-200">
            💎 <AnimatedMetric value={leader.reactions.diamond} format={formatCompact} />
          </span>
        </div>

        <p className="mt-3 text-xs font-medium text-slate-500">
          Impacto:{' '}
          <span className="text-slate-200">
            <AnimatedMetric value={leader.followers} format={(v) => `${Number(v).toLocaleString('es-ES')} usuarios`} />
          </span>
        </p>

        <div className="mt-auto pt-5">
          <motion.div
            animate={reduceMotion ? {} : { scale: [1, 1.03, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <NeonButton type="button" variant="secondary" className="!w-full !normal-case !text-xs !font-semibold">
              Seguir líder
            </NeonButton>
          </motion.div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/**
 * Top G — elite leader arena (`nav === 'topg'`).
 */
export function GenesisTopGPage() {
  const reduceMotion = useReducedMotion();
  const [hoverRow, setHoverRow] = useState(null);

  const { energyPct, totalVolume } = useMemo(() => {
    const total = leaders.reduce((s, L) => s + (L.volumeUsdt || 0), 0);
    return {
      totalVolume: total,
      energyPct: Math.min(100, Math.round((total / VOLUME_CAP_USDT) * 100)),
    };
  }, []);

  const top3 = leaders.filter((L) => L.rank <= 3);
  const rest = leaders.filter((L) => L.rank > 3);

  const onRowHover = (leader, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverRow({
      leader,
      x: Math.min(rect.right + 12, window.innerWidth - 280),
      y: Math.max(8, rect.top),
    });
  };

  return (
    <motion.div className="space-y-8 md:space-y-10" variants={staggerContainer} initial="hidden" animate="show">
      <motion.section variants={fadeUpBlur}>
        <GlassCard
          hover={false}
          glowClassName="border-cyan-500/20 shadow-[0_0_36px_-8px_rgba(34,211,238,0.2)]"
          contentClassName="p-5 md:p-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/80">ENERGÍA DE LA COMUNIDAD</p>
              <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                <AnimatedMetric value={totalVolume} format={(v) => `${Number(v).toLocaleString('es-ES')} USDT agregados`} />
              </p>
            </div>
            <span className="font-display text-2xl font-bold tabular-nums text-cyan-200/90">
              <AnimatedMetric value={energyPct} format={(v) => `${Math.round(v)}%`} />
            </span>
          </div>
          <div className="mt-4">
            <ProgressBar value={energyPct} />
          </div>
        </GlassCard>
      </motion.section>

      <motion.header variants={fadeUpBlur} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-fuchsia-300/90">
            <TrendingUp className="h-5 w-5" strokeWidth={1.75} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">AiGenesis Elite</span>
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-white md:text-3xl">Top G Leaders</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            El salón de la fama del protocolo. Prestigio, poder y reconocimiento de la comunidad.
          </p>
        </div>
      </motion.header>

      <motion.div variants={fadeUpBlur} className="grid gap-4 md:grid-cols-3 md:gap-5">
        {top3.map((L) => (
          <PodiumCard key={L.rank} leader={L} reduceMotion={reduceMotion} />
        ))}
      </motion.div>

      {rest.length > 0 ? (
        <motion.section variants={fadeUpBlur}>
          <GlassCard hover={false} glowClassName="shadow-glowCyan" contentClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 md:px-6">#</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Líder</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Impacto</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Volumen</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 md:px-6">⭐</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((L) => (
                    <motion.tr
                      key={L.rank}
                      whileHover={reduceMotion ? {} : { scale: 1.005 }}
                      className="cursor-default border-b border-white/[0.06] transition-colors hover:bg-white/[0.04]"
                      onMouseEnter={(e) => onRowHover(L, e)}
                      onMouseMove={(e) => onRowHover(L, e)}
                      onMouseLeave={() => setHoverRow(null)}
                    >
                      <td className="px-4 py-3 font-mono text-sm text-slate-400 md:px-6">{L.rank}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-violet-200">{L.name}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-300">{L.communityImpact.toLocaleString('es-ES')}</td>
                      <td className="px-4 py-3 font-mono text-sm text-cyan-200/90">{L.volumeUsdt.toLocaleString('es-ES')} USDT</td>
                      <td className="px-4 py-3 md:px-6">{L.reputation.toFixed(1)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.section>
      ) : null}

      <motion.section variants={fadeUpBlur}>
        <h3 className="mb-4 font-display text-lg font-bold text-white">Comunidad hablando</h3>
        <div className="flex flex-col gap-3">
          {communityFeed.map((item, i) => (
            <motion.div
              key={`${item.user}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassCard hover glowClassName="shadow-glowCyan hover:shadow-glowMagenta" contentClassName="flex gap-3 p-4 md:p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/90 to-cyan-500/80 text-sm font-bold text-white shadow-lg">
                  {avatarLetter(item.user)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-semibold text-cyan-200/90">{item.user}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">{item.message}</p>
                </div>
                <span className="shrink-0 text-xl" aria-hidden>
                  {item.reaction}
                </span>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <AnimatePresence>
        {hoverRow ? (
          <LeaderHoverPanel
            key={hoverRow.leader.rank}
            leader={hoverRow.leader}
            position={{ x: hoverRow.x, y: hoverRow.y }}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
