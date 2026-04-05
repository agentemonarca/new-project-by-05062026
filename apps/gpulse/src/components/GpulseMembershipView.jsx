import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import GpulseActivationOptions from './GpulseActivationOptions.jsx';
import GpulseEntryOverlay from './GpulseEntryOverlay.jsx';
import GpulsePostActivationOverlay from './GpulsePostActivationOverlay.jsx';
import GpulseStatusPanel from './GpulseStatusPanel.jsx';
import { isPremium as readPremiumFromStorage, usePremiumStatus } from '../hooks/usePremiumStatus.js';

const DEMO_USER = {
  plan: 'Operator',
  startDate: new Date(Date.now() - 5 * 86400000).toISOString(),
  durationDays: 30,
};

const plans = [
  {
    name: 'SIGNAL',
    duration: '1 mes',
    price: '100 USDT',
    features: {
      sync: 'Básica',
      validation: 'Sí',
      priority: 'Estándar',
      history: '7 días',
      support: 'Email',
      wallet: '—',
    },
  },
  {
    name: 'OPERATOR',
    duration: '6 meses',
    price: '500 USDT',
    highlight: true,
    features: {
      sync: 'Completa',
      validation: 'Sí',
      priority: 'Alta',
      history: '30 días',
      support: 'Prioritario',
      wallet: 'Sí',
    },
  },
  {
    name: 'ARCHITECT',
    duration: '9 meses',
    price: '750 USDT',
    features: {
      sync: 'Avanzada',
      validation: 'Sí + capas',
      priority: 'Alta',
      history: '60 días',
      support: 'Prioritario',
      wallet: 'Sí',
    },
  },
  {
    name: 'VERTEX',
    duration: '12 meses',
    price: '1000 USDT',
    features: {
      sync: 'Máxima',
      validation: 'Sí + capas extra',
      priority: 'Máxima',
      history: 'Ilimitado',
      support: 'Directo',
      wallet: 'Sí + API',
    },
  },
];

/** Estética premium por plan (gradientes / glow) */
const PLAN_THEME = {
  SIGNAL: {
    gradient: 'from-blue-600 via-cyan-500 to-indigo-500',
    border: 'border-cyan-500/40',
    glow: 'shadow-[0_0_28px_rgba(34,211,238,0.18)]',
  },
  OPERATOR: {
    gradient: 'from-violet-600 via-fuchsia-600 to-rose-500',
    border: 'border-fuchsia-500/65',
    glow: 'shadow-[0_0_32px_rgba(236,72,153,0.28)]',
  },
  ARCHITECT: {
    gradient: 'from-indigo-600 via-purple-600 to-fuchsia-600',
    border: 'border-purple-500/50',
    glow: 'shadow-[0_0_28px_rgba(168,85,247,0.22)]',
  },
  VERTEX: {
    gradient: 'from-red-600 via-orange-500 to-amber-500',
    border: 'border-orange-500/55',
    glow: 'shadow-[0_0_28px_rgba(249,115,22,0.24)]',
  },
};

const COMPARE_ROWS = [
  { label: 'Sincronía con G_Pulse', key: 'sync' },
  { label: 'Validación adaptativa', key: 'validation' },
  { label: 'Prioridad en señales', key: 'priority' },
  { label: 'Historial', key: 'history' },
  { label: 'Soporte', key: 'support' },
  { label: 'Multi-wallet', key: 'wallet' },
];

const KNOWN_PLAN_NAMES = plans.map((p) => p.name);

/** Alinea `user.plan` con nombres de columna (SIGNAL, OPERATOR, …). */
function normalizePlanName(raw) {
  if (raw == null || raw === '') return null;
  const u = String(raw).trim().toUpperCase();
  return KNOWN_PLAN_NAMES.includes(u) ? u : null;
}

const hoverScale = { scale: 1.03 };
const hoverTransition = { type: 'spring', stiffness: 400, damping: 24 };

const fadeEase = [0.22, 1, 0.36, 1];

/** Transición antes del pago (1–1.5 s). */
const ACTIVATION_OVERLAY_MS = 1250;

/** Overlay de activación: sensación de entrada al sistema */
function GpulseActivationOverlay({ show }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="gpulse-activation"
          role="status"
          aria-live="assertive"
          aria-busy="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: fadeEase }}
          className="absolute inset-0 z-[48] flex flex-col items-center justify-center overflow-hidden rounded-[inherit] bg-black px-6"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_50%_40%,rgba(139,92,246,0.22),transparent_58%),radial-gradient(ellipse_75%_55%_at_50%_60%,rgba(34,211,238,0.12),transparent_55%)]"
            aria-hidden
          />
          <motion.div
            className="pointer-events-none absolute h-40 w-40 rounded-full bg-violet-500/15 blur-3xl"
            animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
          <motion.div
            className="pointer-events-none absolute bottom-0 h-32 w-64 rounded-full bg-cyan-500/10 blur-3xl"
            animate={{ opacity: [0.25, 0.45, 0.25] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45, ease: fadeEase }}
            className="relative text-center text-[14px] font-medium tracking-[-0.02em] text-white/92"
          >
            Activando sincronización…
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.45, ease: fadeEase }}
            className="relative mt-3 text-center text-[12px] font-light text-white/55"
          >
            Conectando con el pulso…
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Estado dinámico: sistema operando + CTA implícita (zona hot opcional vía gpulse). */
function GpulseAccessSyncBanner({ gpulse, show }) {
  const isHot = gpulse?.zone === 'hot';

  if (!show) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: fadeEase }}
      className={`mb-5 rounded-2xl border px-4 py-4 sm:px-5 sm:py-4 ${
        isHot
          ? 'border-red-500/35 bg-red-950/[0.18] shadow-[0_0_36px_rgba(239,68,68,0.14),inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'border-white/[0.1] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
      }`}
      aria-label="Estado de sincronización G_Pulse"
    >
      <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-white/92">
        Sincronización en curso
      </h2>
      <p className="mt-1.5 text-[12px] leading-relaxed text-white/58">
        El sistema está funcionando…
        <br />
        <span className="font-medium text-white/88">pero no estás viendo todo.</span>
      </p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        Nivel de acceso actual: <span className="text-amber-200/90">LIMITADO</span>
      </p>

      <AnimatePresence>
        {isHot ? (
          <motion.div
            key="gpulse-hot-hint"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.4, ease: fadeEase }}
            className="mt-4 space-y-2 border-t border-red-500/25 pt-3"
          >
            <p className="text-[12px] font-medium text-red-200/95">🔥 Actividad alta detectada</p>
            <p className="text-[11px] leading-relaxed text-white/60">
              Este es el tipo de momento donde se generan decisiones clave
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-300/85">
              Acceso completo recomendado
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

function SubNav({ subView, setSubView }) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'compare', label: 'Compare' },
    { id: 'upgrade', label: 'Upgrade' },
  ];
  return (
    <nav
      className="mb-5 flex flex-wrap gap-1 rounded-xl border border-white/[0.1] bg-black/80 p-1 shadow-[0_0_40px_rgba(139,92,246,0.08)]"
      aria-label="Navegación membresía"
    >
      {tabs.map(({ id, label }) => {
        const active = subView === id;
        return (
          <motion.button
            key={id}
            type="button"
            onClick={() => setSubView(id)}
            whileHover={hoverScale}
            transition={hoverTransition}
            className={`flex-1 min-w-[5.5rem] rounded-lg px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-colors duration-200 ${
              active
                ? 'bg-white/[0.14] text-white shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                : 'text-white/45 hover:bg-white/[0.06] hover:text-white/75'
            }`}
          >
            {label}
          </motion.button>
        );
      })}
    </nav>
  );
}

export default function GpulseMembershipView({ gpulse = null, user = DEMO_USER, onSubViewChange, onTrustPremiumFlow }) {
  const [subView, setSubView] = useState('overview');
  const [selectedPlan, setSelectedPlan] = useState('OPERATOR');
  const { isPremium } = usePremiumStatus();
  const [entryOpen, setEntryOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !readPremiumFromStorage();
  });
  const [showActivationOverlay, setShowActivationOverlay] = useState(false);
  const [showPostActivationOverlay, setShowPostActivationOverlay] = useState(false);
  const activationTimerRef = useRef(null);
  const prevPremiumRef = useRef(isPremium);
  const premiumMountRef = useRef(false);
  const dismissEntry = useCallback(() => setEntryOpen(false), []);

  const handleEnterSystem = useCallback(() => {
    setShowActivationOverlay(true);
    if (activationTimerRef.current != null) {
      window.clearTimeout(activationTimerRef.current);
    }
    activationTimerRef.current = window.setTimeout(() => {
      activationTimerRef.current = null;
      setShowActivationOverlay(false);
      setSubView('payment');
    }, ACTIVATION_OVERLAY_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (activationTimerRef.current != null) {
        window.clearTimeout(activationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    onSubViewChange?.(subView);
  }, [subView, onSubViewChange]);

  useEffect(() => {
    if (isPremium) {
      setEntryOpen(false);
    }
  }, [isPremium]);

  /** Fase 6.5: transición recién premium → micro-overlay (sin disparar si ya era premium al cargar). */
  useEffect(() => {
    if (!premiumMountRef.current) {
      premiumMountRef.current = true;
      prevPremiumRef.current = isPremium;
      return;
    }
    if (isPremium && !prevPremiumRef.current) {
      setShowPostActivationOverlay(true);
    }
    prevPremiumRef.current = isPremium;
  }, [isPremium]);

  const currentPlan = user?.plan;
  const compareColumnMeta = useMemo(() => {
    const currentName = normalizePlanName(currentPlan);
    const idx = currentName != null ? plans.findIndex((p) => p.name === currentName) : -1;
    const nextName =
      idx >= 0 && idx < plans.length - 1 ? plans[idx + 1].name : null;
    return { currentName, nextName };
  }, [currentPlan]);

  const activePlan = useMemo(() => {
    const found = plans.find((p) => p.name === selectedPlan);
    return found || plans.find((p) => p.highlight) || plans[1];
  }, [selectedPlan]);

  const activeTheme = PLAN_THEME[activePlan.name] || PLAN_THEME.OPERATOR;

  return (
    <div className="flex w-full min-h-0 flex-col items-stretch px-0 py-1 sm:px-2">
      <div className="mx-auto w-full max-w-3xl">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.12] bg-black px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-6 sm:py-6">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-950/30 via-transparent to-red-950/15"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-600/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-blue-600/10 blur-3xl"
            aria-hidden
          />

          <AnimatePresence>
            {entryOpen ? (
              <GpulseEntryOverlay key="gpulse-access-entry" onComplete={dismissEntry} />
            ) : null}
          </AnimatePresence>

          <GpulseActivationOverlay show={showActivationOverlay} />

          <GpulsePostActivationOverlay
            show={showPostActivationOverlay}
            onComplete={() => {
              setShowPostActivationOverlay(false);
              setSubView('overview');
              try {
                sessionStorage.setItem('gpulse_guided_pending', '1');
              } catch {
                /* ignore */
              }
              window.dispatchEvent(new CustomEvent('gpulse:guided-start'));
            }}
          />

          <div className="relative z-10">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40">
              G_Pulse Access
            </p>
            <GpulseAccessSyncBanner gpulse={gpulse} show={!entryOpen} />
            {subView === 'payment' ? null : (
              <SubNav subView={subView} setSubView={setSubView} />
            )}

            <AnimatePresence mode="wait">
              {subView === 'overview' && (
                <motion.div
                  key="overview"
                  role="tabpanel"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-5"
                >
                  <motion.div whileHover={hoverScale} transition={hoverTransition}>
                    <GpulseStatusPanel user={user} />
                  </motion.div>
                  <p className="text-[15px] font-medium leading-snug tracking-[-0.02em] text-white/88">
                    Tu nivel define lo que puedes ver… y lo que puedes perder
                  </p>
                  <motion.button
                    type="button"
                    onClick={() => setSubView('compare')}
                    whileHover={hoverScale}
                    whileTap={{ scale: 0.98 }}
                    transition={hoverTransition}
                    className="w-full rounded-2xl border border-white/15 bg-gradient-to-r from-white/[0.08] to-white/[0.04] py-3.5 text-[11px] font-black uppercase tracking-[0.22em] text-white shadow-[0_0_24px_rgba(139,92,246,0.12)] transition-colors hover:border-fuchsia-500/35 hover:shadow-[0_0_32px_rgba(236,72,153,0.15)]"
                  >
                    Explorar niveles
                  </motion.button>
                </motion.div>
              )}

              {subView === 'compare' && (
                <motion.div
                  key="compare"
                  role="tabpanel"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4"
                >
                  <p className="text-[13px] font-medium leading-snug text-white/82">
                    Tu nivel actual vs lo que podrías desbloquear
                  </p>

                  <div className="overflow-x-auto rounded-2xl border border-white/[0.1] bg-black/60 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                    <table className="w-full min-w-[600px] border-collapse text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="sticky left-0 z-[1] bg-black px-3 py-3.5 font-semibold uppercase tracking-wider text-white/35">
                            Beneficio
                          </th>
                          {plans.map((plan) => {
                            const theme = PLAN_THEME[plan.name];
                            const isCurrent =
                              compareColumnMeta.currentName != null &&
                              plan.name === compareColumnMeta.currentName;
                            const isNext =
                              compareColumnMeta.nextName != null &&
                              plan.name === compareColumnMeta.nextName;
                            return (
                              <th
                                key={plan.name}
                                className={`relative px-3 py-3.5 text-center ${
                                  isNext
                                    ? 'border-x border-cyan-400/50 bg-gradient-to-b from-violet-500/[0.14] to-cyan-500/[0.08] shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35),0_0_28px_rgba(34,211,238,0.12)]'
                                    : isCurrent
                                      ? 'border-x border-white/[0.07] bg-white/[0.02] opacity-[0.72]'
                                      : ''
                                }`}
                              >
                                {isNext ? (
                                  <motion.div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-400/10 to-cyan-400/10"
                                    animate={{ opacity: [0.35, 0.55, 0.35] }}
                                    transition={{
                                      duration: 3.2,
                                      repeat: Infinity,
                                      ease: 'easeInOut',
                                    }}
                                  />
                                ) : null}
                                <span
                                  className={`relative z-[1] inline-block rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                                    isNext
                                      ? 'border-cyan-400/65 bg-white/[0.1] text-white shadow-[0_0_14px_rgba(34,211,238,0.22)]'
                                      : isCurrent
                                        ? 'border-white/[0.12] bg-black/30 text-white/55'
                                        : `${theme.border} bg-white/[0.05] text-white/90`
                                  }`}
                                >
                                  {plan.name}
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {COMPARE_ROWS.map((row) => (
                          <tr key={row.key} className="border-b border-white/[0.07] last:border-0">
                            <td className="sticky left-0 z-[1] bg-black px-3 py-2.5 font-medium text-white/65">
                              {row.label}
                            </td>
                            {plans.map((plan) => {
                              const val = plan.features?.[row.key] ?? '—';
                              const isCurrent =
                                compareColumnMeta.currentName != null &&
                                plan.name === compareColumnMeta.currentName;
                              const isNext =
                                compareColumnMeta.nextName != null &&
                                plan.name === compareColumnMeta.nextName;
                              return (
                                <td
                                  key={`${plan.name}-${row.key}`}
                                  className={`relative px-3 py-2.5 text-center ${
                                    isNext
                                      ? 'border-x border-cyan-400/45 bg-violet-500/[0.06] text-white/88 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.2)]'
                                      : isCurrent
                                        ? 'border-x border-white/[0.06] bg-black/25 text-white/48 opacity-80'
                                        : 'text-white/78'
                                  }`}
                                >
                                  {isNext ? (
                                    <motion.span
                                      className="inline-block"
                                      animate={{ opacity: [0.88, 1, 0.88] }}
                                      transition={{
                                        duration: 2.8,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                      }}
                                    >
                                      {val}
                                    </motion.span>
                                  ) : (
                                    val
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr>
                          <td className="sticky left-0 z-[1] bg-black px-3 py-3" />
                          {plans.map((plan) => {
                            const isCurrent =
                              compareColumnMeta.currentName != null &&
                              plan.name === compareColumnMeta.currentName;
                            const isNext =
                              compareColumnMeta.nextName != null &&
                              plan.name === compareColumnMeta.nextName;
                            return (
                              <td
                                key={`cta-${plan.name}`}
                                className={`relative px-2 pb-3 pt-1 text-center ${
                                  isNext
                                    ? 'border-x border-cyan-400/45 bg-violet-500/[0.05]'
                                    : isCurrent
                                      ? 'border-x border-white/[0.06] opacity-75'
                                      : ''
                                }`}
                              >
                                <motion.button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPlan(plan.name);
                                    setSubView('upgrade');
                                  }}
                                  whileHover={hoverScale}
                                  whileTap={{ scale: 0.97 }}
                                  transition={hoverTransition}
                                  className={`w-full max-w-[7.5rem] rounded-xl border py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${
                                    isNext
                                      ? 'border-cyan-400/55 bg-white/[0.1] text-white shadow-[0_0_16px_rgba(34,211,238,0.2)] hover:border-cyan-300/70 hover:bg-white/[0.14]'
                                      : isCurrent
                                        ? 'border-white/10 bg-black/40 text-white/45 hover:text-white/55'
                                        : 'border-white/15 bg-white/[0.06] text-white/80 hover:border-cyan-500/35 hover:bg-white/[0.1]'
                                  }`}
                                >
                                  Ver nivel
                                </motion.button>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {normalizePlanName(currentPlan) === 'SIGNAL' ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, ease: fadeEase }}
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-5"
                    >
                      <p className="text-[12px] font-medium leading-relaxed text-white/70">
                        Con tu nivel actual tienes acceso parcial
                      </p>
                      <p className="mt-2 text-[11px] leading-relaxed text-white/48">
                        El siguiente nivel desbloquea decisiones más precisas y control completo
                      </p>
                    </motion.div>
                  ) : null}
                </motion.div>
              )}

              {subView === 'upgrade' && (
                <motion.div
                  key="upgrade"
                  role="tabpanel"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-5"
                >
                  <div className="flex flex-wrap gap-2">
                    {plans.map((plan) => {
                      const sel = selectedPlan === plan.name;
                      const theme = PLAN_THEME[plan.name];
                      return (
                        <motion.button
                          key={plan.name}
                          type="button"
                          onClick={() => setSelectedPlan(plan.name)}
                          whileHover={hoverScale}
                          transition={hoverTransition}
                          className={`rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-widest ${
                            sel
                              ? `${theme.border} bg-white/[0.12] text-white shadow-[0_0_20px_rgba(255,255,255,0.08)] ring-1 ring-white/15`
                              : 'border-white/10 bg-white/[0.04] text-white/45 hover:text-white/75'
                          }`}
                        >
                          {plan.name}
                        </motion.button>
                      );
                    })}
                  </div>

                  <motion.div
                    whileHover={hoverScale}
                    transition={hoverTransition}
                    className={`relative overflow-hidden rounded-2xl border p-6 ${activeTheme.border} ${activeTheme.glow} bg-black/70`}
                  >
                    <div
                      className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-[0.22] ${activeTheme.gradient}`}
                      aria-hidden
                    />
                    <div className="relative space-y-5">
                      {activePlan.highlight ? (
                        <span className="inline-block rounded-full border border-fuchsia-400/55 bg-gradient-to-r from-fuchsia-600/90 to-rose-500/85 px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_20px_rgba(236,72,153,0.35)]">
                          Recomendado
                        </span>
                      ) : null}
                      <div>
                        <h3 className="text-2xl font-semibold tracking-[-0.03em] text-white">{activePlan.name}</h3>
                        <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.2em] text-white/40">
                          {activePlan.duration}
                        </p>
                      </div>

                      <ul className="space-y-2.5 border-t border-white/10 pt-4 text-[13px] text-white/70">
                        {COMPARE_ROWS.map((row) => (
                          <li key={row.key} className="flex justify-between gap-4 border-b border-white/[0.05] pb-2.5 last:border-0 last:pb-0">
                            <span className="text-white/45">{row.label}</span>
                            <span className="text-right font-medium text-white/90">
                              {activePlan.features?.[row.key] ?? '—'}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <p className="text-xl font-semibold tracking-tight text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.12)]">
                        Activación: {activePlan.price}
                      </p>

                      <p className="text-[12px] leading-relaxed text-white/50">
                        El sistema aún se encuentra en fase inicial. A medida que evoluciona… también lo hace el valor de
                        acceso.
                      </p>
                    </div>
                  </motion.div>

                  <div className="w-full space-y-2">
                    <motion.button
                      type="button"
                      onClick={handleEnterSystem}
                      disabled={showActivationOverlay}
                      whileHover={showActivationOverlay ? undefined : { scale: 1.03 }}
                      whileTap={showActivationOverlay ? undefined : { scale: 0.98 }}
                      transition={hoverTransition}
                      className="gp-upgrade-cta-pulse relative w-full overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-400 py-4 text-[11px] font-black uppercase tracking-[0.28em] text-white shadow-[0_0_28px_rgba(139,92,246,0.35)] transition-shadow duration-300 disabled:pointer-events-none disabled:opacity-55"
                    >
                      <span className="relative z-10">ENTRAR AL SISTEMA</span>
                      <span
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"
                        aria-hidden
                      />
                    </motion.button>
                    <p className="text-center text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-400/80">
                      Sincronización inmediata
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSubView('compare')}
                    className="w-full text-center text-[10px] font-semibold uppercase tracking-widest text-white/30 transition-colors hover:text-white/55"
                  >
                    Volver a comparar
                  </button>
                </motion.div>
              )}

              {subView === 'payment' && (
                <motion.div
                  key="payment"
                  role="tabpanel"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-6"
                >
                  <button
                    type="button"
                    onClick={() => setSubView('upgrade')}
                    className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 transition-colors hover:text-white/70"
                  >
                    ← Volver a activación
                  </button>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40">Pago</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
                      {activePlan.name}
                    </h3>
                    <p className="mt-1 text-[13px] text-white/55">Activación: {activePlan.price}</p>
                  </div>
                  <p className="text-[12px] leading-relaxed text-white/45">
                    Completa el pago para finalizar tu acceso. La integración del checkout se conectará aquí.
                  </p>
                  <div className="rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 py-6 text-center">
                    <GpulseActivationOptions activePlan={activePlan} onTrustFlowChange={onTrustPremiumFlow} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
