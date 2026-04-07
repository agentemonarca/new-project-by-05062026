import { useMemo } from 'react';
import GenesisHologram from "../components/GenesisHologram";
import { motion, useReducedMotion } from 'framer-motion';
import {
  Binary,
  Coins,
  Crown,
  Pickaxe,
  Radar,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard.jsx';
import { NeonButton } from '../components/NeonButton.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { AnimatedMetric } from '../components/AnimatedMetric.jsx';
import { NextActionCard } from '../components/NextActionCard.jsx';
import { AIDecisionCard } from '../components/AIDecisionCard.jsx';
import { ActivityFeed } from '../widgets/ActivityFeed.jsx';
import { ExternalSignalBoard } from '../components/signals/ExternalSignalBoard.jsx';
import { useCore } from '../core/CoreContext.jsx';
import { fadeUpBlur, staggerContainer } from '../motion/variants.js';
import { RuleHint } from '../components/RuleHint.jsx';
import { useUiModeStore } from '../stores/uiModeStore.js';
import { BRAND } from '@/branding/brand.js';
import { BrandLogo } from '@/branding/BrandLogo.jsx';

const FEED_ITEMS = [
  { id: '1', text: 'WhaleX hizo staking de $5,000', tone: 'cyan' },
  { id: '2', text: 'CryptoKing generó $1,200 en binario', tone: 'violet' },
  { id: '3', text: 'Nuevo rango alcanzado: Diamond', tone: 'neutral' },
  { id: '4', text: 'NovaStake activó plan Genesis 12m', tone: 'magenta' },
  { id: '5', text: 'Equipo sur +420k volumen esta semana', tone: 'cyan' },
];

/**
 * AiGenesis lobby — default entry: status, balances, generation hint, binary summary, modules, next action, activity.
 * @param {{
 *   onNavigate: (navId: string) => void,
 *   onOpenMarketplace: () => void,
 *   hasSession: boolean,
 *   totalBalanceUsd: number,
 *   miningActiveDisplay: number,
 *   networkVolumeTotal: number,
 *   holdingPct: number,
 *   userHasActiveStaking: boolean,
 *   accountFrozen: boolean,
 *   userEconomicallyActive: boolean,
 *   minHoldingPct: number,
 * }} props
 */
export function GenesisLobbyPage({
  onNavigate,
  onOpenMarketplace,
  hasSession,
  totalBalanceUsd,
  miningActiveDisplay,
  networkVolumeTotal,
  holdingPct,
  userHasActiveStaking,
  accountFrozen,
  userEconomicallyActive,
  minHoldingPct,
}) {
  const shouldReduceMotion = useReducedMotion();
  const uiMode = useUiModeStore((s) => s.uiMode);
  const isLite = uiMode === 'lite';
  const { leftPts, rightPts, totalYieldUsdtPerSecond, hasSession: coreSession } = useCore();
  const leftLeg = Number(leftPts ?? 0);
  const rightLeg = Number(rightPts ?? 0);

  const activityItems = useMemo(
    () =>
      FEED_ITEMS.map((item) => ({
        id: item.id,
        text: item.text,
        meta: 'Preview',
        tone: /** @type {'cyan'|'violet'|'magenta'|'neutral'} */ (
          item.tone === 'fuchsia' ? 'magenta' : item.tone === 'amber' ? 'neutral' : item.tone
        ),
      })),
    [],
  );

  const binaryTotal = leftLeg + rightLeg;
  const binaryBalancePct =
    binaryTotal > 0 ? Math.round((100 * 2 * Math.min(leftLeg, rightLeg)) / binaryTotal) : 0;
  const pendingVol = Math.max(0, Math.max(leftLeg, rightLeg) - Math.min(leftLeg, rightLeg));

  const statusLabel = useMemo(() => {
    if (!hasSession) return 'OFFLINE';
    if (accountFrozen) return 'FROZEN';
    if (userEconomicallyActive) return 'ACTIVE';
    return 'INACTIVE';
  }, [hasSession, accountFrozen, userEconomicallyActive]);

  const statusClass =
    statusLabel === 'ACTIVE'
      ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.2)]'
      : statusLabel === 'FROZEN'
        ? 'border-rose-500/45 bg-rose-500/15 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
        : 'border-slate-500/40 bg-slate-800/60 text-slate-300';

  const modules = useMemo(
    () => [
      {
        id: 'mining',
        title: 'Mining Core',
        desc: 'Motores de generación del protocolo',
        icon: Pickaxe,
        gradient: 'from-cyan-500/25 via-sky-500/15 to-cyan-500/20',
        onEnter: () => onNavigate('mining'),
      },
      {
        id: 'booster',
        title: 'AiG Booster',
        desc: 'Aceleración y liquidez dual',
        icon: Zap,
        gradient: 'from-violet-500/25 via-fuchsia-500/15 to-cyan-500/15',
        onEnter: () => onNavigate('booster'),
      },
      {
        id: 'gpulse',
        title: 'GPulse Oracle',
        desc: 'Motor predictivo y shell neuronal',
        icon: Radar,
        gradient: 'from-cyan-500/25 via-violet-500/15 to-fuchsia-500/20',
        onEnter: () => onNavigate('gpulse-lobby'),
      },
      {
        id: 'staking',
        title: 'Staking',
        desc: 'Participación bloqueada y motor económico',
        icon: Coins,
        gradient: 'from-violet-500/25 via-fuchsia-500/15 to-cyan-500/15',
        onEnter: () => onNavigate('staking'),
      },
      {
        id: 'marketplace',
        title: 'Marketplace',
        desc: 'Listados, liquidez y AIG',
        icon: ShoppingBag,
        gradient: 'from-emerald-500/20 via-cyan-500/15 to-violet-500/20',
        onEnter: onOpenMarketplace,
      },
      {
        id: 'network',
        title: 'Red Binaria',
        desc: 'Volumen, panel binario y comunidad',
        icon: Binary,
        gradient: 'from-fuchsia-500/20 via-violet-500/20 to-cyan-500/15',
        onEnter: () => onNavigate('network'),
      },
    ],
    [onNavigate, onOpenMarketplace],
  );

  return (
    <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
      <GenesisHologram />
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 85% 55% at 50% -15%, rgba(139,92,246,0.22), transparent 55%), radial-gradient(ellipse 70% 45% at 100% 30%, rgba(34,211,238,0.12), transparent 50%), radial-gradient(ellipse 55% 40% at 0% 70%, rgba(217,70,239,0.1), transparent 45%)',
        }}
      />
      <motion.div
        className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden
        animate={
          shouldReduceMotion
            ? {}
            : {
                opacity: [0.35, 0.55, 0.35],
                scale: [1, 1.06, 1],
              }
        }
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute -right-20 bottom-32 h-80 w-80 rounded-full bg-violet-500/12 blur-3xl"
        aria-hidden
        animate={
          shouldReduceMotion
            ? {}
            : {
                opacity: [0.3, 0.5, 0.3],
                scale: [1.05, 1, 1.05],
              }
        }
        transition={{ duration: 9.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
      />

      <motion.div
        className="relative z-10 mx-auto max-w-7xl space-y-12 px-2 pb-16 pt-6 md:space-y-14 md:px-0 md:pb-20 md:pt-8"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.section variants={fadeUpBlur} className="text-center md:text-left">
          {!isLite ? (
            <div className="mb-6 flex flex-col items-center gap-3 md:flex-row md:items-end md:justify-between">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-gradient-to-r from-amber-500/15 to-yellow-500/10 px-4 py-2 shadow-[0_0_28px_rgba(251,191,36,0.15)]">
                <Crown className="h-4 w-4 text-amber-300" strokeWidth={1.75} />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100/95">Black Diamond</span>
              </div>
              <span
                className={`rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-wider ${statusClass}`}
              >
                <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-current opacity-90 shadow-[0_0_10px_currentColor]" />
                {statusLabel}
              </span>
            </div>
          ) : (
            <div className="mb-4 flex justify-center md:justify-start">
              <span
                className={`rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-wider ${statusClass}`}
              >
                <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-current opacity-90 shadow-[0_0_10px_currentColor]" />
                {statusLabel}
              </span>
            </div>
          )}
          <div className={`mb-4 flex justify-center ${isLite ? '' : 'md:justify-start'}`}>
            <BrandLogo size={isLite ? 'md' : 'lg'} />
          </div>
          <h1
            className={`font-display font-bold leading-[1.08] tracking-tight text-white ${
              isLite ? 'text-3xl md:text-4xl' : 'text-4xl md:text-5xl lg:text-6xl'
            }`}
          >
            {isLite ? (
              <span className={BRAND.shell.wordmarkGradient}>{BRAND.name}</span>
            ) : (
              <>
                <span className="bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent">
                  Bienvenido a{' '}
                </span>
                <span className={BRAND.shell.wordmarkGradient}>{BRAND.name}</span>
              </>
            )}
          </h1>
          {!isLite ? (
            <>
              <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 md:mx-0 md:text-lg">
                El núcleo operativo de tu ecosistema digital
              </p>
              <div className="mx-auto mt-4 max-w-xl md:mx-0">
                <RuleHint
                  variant="inline"
                  message="Debes cumplir las condiciones del sistema (staking, holding y productos activos) para el flujo completo de ingresos."
                  linkText="Ver reglas"
                  modalTitle="Condiciones del protocolo"
                  modalContent={
                    <div className="space-y-3 text-slate-300">
                      <p>
                        El uso de {BRAND.name} implica aceptar las reglas de participación, incluidas binario (match por lado menor,
                        consumo de volumen), posible reducción mensual de arrastre en piernas, staking y umbral de holding en AIG
                        mostrado en la app.
                      </p>
                      <p className="text-[11px] text-slate-500">Consulta el acuerdo completo en tu primer inicio de sesión.</p>
                    </div>
                  }
                />
              </div>
            </>
          ) : (
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 md:mx-0">Resumen esencial de tu cuenta</p>
          )}
          <div className={`mx-auto max-w-xl rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4 backdrop-blur-md md:mx-0 ${isLite ? 'mt-6' : 'mt-8'}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Balance total estimado</p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums text-white md:text-4xl">
              $
              <AnimatedMetric
                value={hasSession ? totalBalanceUsd : 0}
                format={(v) => Number(v).toLocaleString('es-ES', { maximumFractionDigits: 2 })}
              />
            </p>
            {!hasSession ? <p className="mt-2 text-xs text-slate-500">Conecta sesión para sincronizar balances.</p> : null}
          </div>
        </motion.section>

        {!isLite ? (
        <motion.section variants={fadeUpBlur}>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            <h2 className="font-display text-lg font-semibold text-white md:text-xl">Resumen de poder</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Total Ecosystem Balance',
                value: totalBalanceUsd,
                prefix: '$',
                sub: 'USD aprox. · protocolo',
                glow: 'border-cyan-500/30 shadow-[0_0_36px_-8px_rgba(34,211,238,0.25)]',
              },
              {
                label: 'Total Mining Active',
                value: miningActiveDisplay,
                prefix: '$',
                sub: 'Potencia desplegada (USDT)',
                glow: 'border-violet-500/30 shadow-[0_0_36px_-8px_rgba(139,92,246,0.25)]',
              },
              {
                label: 'Total Network Volume',
                value: networkVolumeTotal,
                prefix: '',
                sub: 'Puntos volumen L+R',
                glow: 'border-fuchsia-500/25 shadow-[0_0_36px_-8px_rgba(217,70,239,0.2)]',
              },
              {
                label: 'Generación (USDT/s)',
                value: hasSession && coreSession ? totalYieldUsdtPerSecond : 0,
                prefix: '+',
                sub: 'Protocolo en tiempo real',
                glow: 'border-emerald-500/25 shadow-[0_0_36px_-8px_rgba(52,211,153,0.2)]',
                decimals: 6,
              },
            ].map((card) => (
              <GlassCard
                key={card.label}
                glowClassName={card.glow}
                className="border-white/10"
                contentClassName="p-5 md:p-6"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                <p className="mt-3 font-display text-2xl font-bold tabular-nums text-white md:text-3xl">
                  {card.prefix}
                  <AnimatedMetric
                    value={hasSession ? card.value : 0}
                    format={(v) =>
                      Number(v).toLocaleString('es-ES', {
                        maximumFractionDigits:
                          card.decimals != null ? card.decimals : card.prefix === '$' ? 2 : card.prefix === '+' ? 6 : 0,
                      })
                    }
                  />
                </p>
                <p className="mt-2 text-xs text-slate-500">{card.sub}</p>
              </GlassCard>
            ))}
          </div>
        </motion.section>
        ) : null}

        {!isLite ? (
        <motion.section variants={fadeUpBlur}>
          <GlassCard hover={false} className="border-emerald-500/20" contentClassName="p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Binary className="h-5 w-5 text-emerald-400" />
                <h3 className="font-display text-base font-semibold text-white">Binario · resumen</h3>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono text-emerald-200">
                Equilibrio · {binaryBalancePct}%
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Izq. / Der.</p>
                <p className="mt-1 font-mono text-sm text-white">
                  {leftLeg} · {rightLeg}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Match</p>
                <p className="mt-1 font-mono text-sm text-emerald-200">{binaryBalancePct}%</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Pendiente</p>
                <p className="mt-1 font-mono text-sm text-amber-100">{pendingVol}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('network')}
              className="mt-4 text-xs font-medium text-emerald-300 hover:text-emerald-200"
            >
              Panel binario completo en Red →
            </button>
          </GlassCard>
        </motion.section>
        ) : null}

        <motion.section variants={fadeUpBlur} className={`grid gap-6 lg:items-start ${isLite ? '' : 'lg:grid-cols-2'}`}>
          <div className="flex flex-col gap-5">
            <NextActionCard
              userHasActiveStaking={userHasActiveStaking}
              holdingPctAig={holdingPct}
              minHoldingPct={minHoldingPct}
              userEconomicallyActive={userEconomicallyActive}
            />
            {!isLite ? (
              <AIDecisionCard
                userHasActiveStaking={userHasActiveStaking}
                holdingPctAig={holdingPct}
                minHoldingPct={minHoldingPct}
                userEconomicallyActive={userEconomicallyActive}
                accountFrozen={accountFrozen}
              />
            ) : null}
          </div>
          {!isLite ? (
            <div className="flex flex-col gap-5">
              <ExternalSignalBoard compact />
              <div>
                <h2 className="mb-3 font-display text-lg font-semibold text-white">Actividad (preview)</h2>
                <ActivityFeed items={activityItems} />
              </div>
            </div>
          ) : null}
        </motion.section>

        {isLite ? (
          <motion.section variants={fadeUpBlur}>
            <h2 className="mb-3 font-display text-lg font-semibold text-white md:text-xl">Acciones rápidas</h2>
            <p className="mb-3 text-xs text-slate-500">Operaciones financieras en Portfolio (cuenta interna).</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <NeonButton type="button" variant="outline" className="!min-w-0 w-full" onClick={() => onNavigate('mining')}>
                Minería
              </NeonButton>
              <NeonButton type="button" variant="outline" className="!min-w-0 w-full" onClick={() => onNavigate('booster')}>
                Booster
              </NeonButton>
              <NeonButton type="button" variant="outline" className="!min-w-0 w-full" onClick={() => onNavigate('staking')}>
                Staking
              </NeonButton>
              <NeonButton
                type="button"
                variant="outline"
                className="!min-w-0 w-full !border-cyan-500/30 !text-cyan-100"
                onClick={() => onNavigate('wallet')}
              >
                <Wallet className="mr-2 inline h-4 w-4" strokeWidth={1.75} />
                Portfolio
              </NeonButton>
            </div>
          </motion.section>
        ) : null}

        {isLite ? (
          <motion.section variants={fadeUpBlur}>
            <h2 className="mb-3 font-display text-lg font-semibold text-white">Actividad (vista previa)</h2>
            <ActivityFeed items={activityItems} />
          </motion.section>
        ) : null}

        {!isLite ? (
        <motion.section variants={fadeUpBlur}>
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-400" />
            <h2 className="font-display text-lg font-semibold text-white md:text-xl">Módulos núcleo</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.id}
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className="group relative"
                >
                  <div
                    className={`pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br opacity-60 blur-xl transition duration-500 group-hover:opacity-90 ${m.gradient}`}
                    aria-hidden
                  />
                  <GlassCard
                    hover
                    className="relative border-white/12"
                    glowClassName="border-white/15 shadow-[0_0_40px_-12px_rgba(34,211,238,0.2)] group-hover:shadow-[0_0_52px_-8px_rgba(139,92,246,0.35)]"
                    contentClassName="flex h-full flex-col p-6 md:p-7"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br ${m.gradient} shadow-inner`}
                      >
                        <Icon className="h-7 w-7 text-white" strokeWidth={1.5} />
                      </div>
                      <TrendingUp className="h-5 w-5 text-slate-600 opacity-60 transition group-hover:text-cyan-300/80" />
                    </div>
                    <h3 className="mt-5 font-display text-xl font-semibold text-white">{m.title}</h3>
                    <p className="mt-2 flex-1 text-sm text-slate-400">{m.desc}</p>
                    <div className="mt-6">
                      <NeonButton
                        type="button"
                        variant="primary"
                        className="!min-w-0 w-full !px-5 !py-3 !text-xs sm:w-auto sm:!min-w-[160px]"
                        onClick={m.onEnter}
                      >
                        Entrar
                      </NeonButton>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
        ) : null}

        {!isLite ? (
        <motion.section variants={fadeUpBlur}>
          <GlassCard
            hover={false}
            className="border-cyan-500/20"
            glowClassName="shadow-[0_0_40px_-12px_rgba(34,211,238,0.18)]"
            contentClassName="space-y-5 p-6 md:p-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-cyan-400" />
                <h2 className="font-display text-lg font-semibold text-white">Estado del sistema</h2>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Holding AIG</p>
                <p className="mt-1 font-mono text-lg text-cyan-100/90">
                  {holdingPct.toFixed(1)}% · mín. {minHoldingPct}%
                </p>
                <div className="mt-3">
                  <ProgressBar value={Math.min(100, holdingPct)} />
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <p className="text-slate-400">
                  <span className="font-semibold text-slate-200">Staking:</span>{' '}
                  {userHasActiveStaking ? (
                    <span className="text-emerald-200">Activo</span>
                  ) : (
                    <span className="text-slate-500">Inactivo</span>
                  )}
                </p>
                <p className="text-slate-400">
                  <span className="font-semibold text-slate-200">Cuenta:</span>{' '}
                  <span
                    className={
                      accountFrozen ? 'text-rose-300' : userEconomicallyActive ? 'text-emerald-200' : 'text-amber-200'
                    }
                  >
                    {accountFrozen ? 'Congelada' : userEconomicallyActive ? 'Activa (ingresos)' : 'Inactiva'}
                  </span>
                </p>
              </div>
            </div>
            {!userEconomicallyActive && hasSession ? (
              <motion.p
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95"
                animate={shouldReduceMotion ? {} : { opacity: [0.92, 1, 0.92] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                No estás generando ingresos actualmente
              </motion.p>
            ) : null}
          </GlassCard>
        </motion.section>
        ) : null}

        {!isLite ? (
        <motion.section variants={fadeUpBlur} className="pb-4">
          <h2 className="mb-4 font-display text-lg font-semibold text-white md:text-xl">Acciones rápidas</h2>
          <p className="mb-3 text-xs text-slate-500">Reclamaciones y retiros solo en Portfolio.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <NeonButton type="button" variant="outline" className="!min-w-0 flex-1" onClick={() => onNavigate('mining')}>
              Minería
            </NeonButton>
            <NeonButton type="button" variant="outline" className="!min-w-0 flex-1" onClick={() => onNavigate('booster')}>
              Booster
            </NeonButton>
            <NeonButton type="button" variant="outline" className="!min-w-0 flex-1" onClick={() => onNavigate('staking')}>
              Staking
            </NeonButton>
            <NeonButton
              type="button"
              variant="outline"
              className="!min-w-0 flex-1 !border-cyan-500/30 !text-cyan-100"
              onClick={() => onNavigate('wallet')}
            >
              <Wallet className="mr-2 inline h-4 w-4" strokeWidth={1.75} />
              Portfolio
            </NeonButton>
          </div>
        </motion.section>
        ) : null}
      </motion.div>
    </div>
  );
}
