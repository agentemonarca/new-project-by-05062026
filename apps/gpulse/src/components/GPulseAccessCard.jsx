import React from 'react';
import { motion } from 'framer-motion';

const PLANS = [
  {
    id: 'signal',
    name: 'SIGNAL',
    blurb: 'Entrada al ecosistema. Sincronía básica con el pulso.',
    accent: 'electric',
    borderClass: 'border-cyan-500/35 hover:border-cyan-400/55',
    glowClass:
      'hover:shadow-[0_0_28px_rgba(0,237,255,0.25),0_0_48px_rgba(59,130,246,0.15)]',
    mesh: 'from-[#0066ff] via-[#00d4ff] to-[#60a5fa]',
  },
  {
    id: 'operator',
    name: 'OPERATOR',
    blurb: 'Ritmo completo. Prioridad en señales y capas de confianza.',
    featured: true,
    badge: 'Más activado',
    accent: 'fusion',
    borderClass: 'border-fuchsia-400/70',
    glowClass: 'gp-access-featured-ring border-fuchsia-400/80',
    mesh: 'from-[#a855f7] via-[#ec4899] to-[#f43f5e]',
  },
  {
    id: 'vertex',
    name: 'VERTEX',
    blurb: 'Máxima intensidad. Acceso prioritario y densidad total.',
    accent: 'ember',
    borderClass: 'border-orange-500/35 hover:border-red-500/50',
    glowClass:
      'hover:shadow-[0_0_28px_rgba(239,68,68,0.35),0_0_44px_rgba(251,146,60,0.2)]',
    mesh: 'from-[#ef4444] via-[#f97316] to-[#fb923c]',
  },
];

/**
 * Pantalla de membresía G_Pulse — capa visual premium (sin lógica de pago).
 */
export default function GPulseAccessCard() {
  return (
    <section
      className="relative shrink-0 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#000] text-white"
      aria-label="G_Pulse Access — membresía"
    >
      {/* Ambiente: gradientes púrpura→rosa, rojo→naranja, azul eléctrico */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="gp-access-ambient-blob absolute -left-1/4 top-0 h-[200px] w-[200px] rounded-full bg-gradient-to-br from-fuchsia-600/50 to-rose-600/40 blur-[72px]"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="gp-access-ambient-blob absolute -right-1/4 top-1/4 h-[180px] w-[220px] rounded-full bg-gradient-to-br from-red-600/45 to-orange-500/35 blur-[70px]"
          style={{ animationDelay: '-4s' }}
        />
        <div
          className="gp-access-ambient-blob absolute bottom-0 left-1/3 h-[160px] w-[240px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-blue-600/40 to-cyan-400/35 blur-[68px]"
          style={{ animationDelay: '-8s' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/90" />
      </div>

      <div className="relative z-10 space-y-6 px-4 py-6 sm:px-5">
        <header className="space-y-3 text-center sm:text-left">
          <motion.p
            className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/50"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <span className="mr-1.5" aria-hidden>
              🧠
            </span>
            G_PULSE ACCESS
          </motion.p>
          <motion.h2
            className="bg-gradient-to-r from-white via-white to-white/75 bg-clip-text text-[1.35rem] font-semibold leading-tight tracking-[-0.03em] text-transparent sm:text-2xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            No es para todos.
          </motion.h2>
          <motion.p
            className="text-[13px] leading-relaxed tracking-[-0.01em] text-white/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.12 }}
          >
            Algunos siguen jugando… otros ya están dentro del sistema.
          </motion.p>
          <motion.div
            className="flex flex-col gap-1 border-l-2 border-amber-400/60 pl-3 text-left"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/85">
              <span className="mr-1.5" aria-hidden>
                ⚡
              </span>
              Pulso activo ahora
            </p>
            <p className="text-[12px] text-white/45">
              Cada segundo fuera es una oportunidad que no estás viendo.
            </p>
          </motion.div>
        </header>

        <div className="space-y-4">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35 sm:text-left">
            Elige tu nivel
          </p>

          <ul className="flex flex-col gap-4">
            {PLANS.map((plan, idx) => (
              <motion.li
                key={plan.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 * idx }}
              >
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className={`relative rounded-2xl border bg-white/[0.03] backdrop-blur-md transition-shadow duration-300 ease-out ${plan.borderClass} ${plan.glowClass} ${plan.featured ? 'p-4 pt-6' : 'p-4'}`}
                >
                  {plan.featured ? (
                    <span className="absolute -top-2.5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-600 to-rose-500 px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_20px_rgba(236,72,153,0.5)]">
                      {plan.badge}
                    </span>
                  ) : null}

                  <div
                    className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br opacity-[0.12] ${plan.mesh}`}
                    aria-hidden
                  />

                  <div className="relative flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">
                          {plan.name}
                        </h3>
                        <p className="mt-1 text-[12px] leading-snug text-white/50">{plan.blurb}</p>
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      className={`relative w-full overflow-hidden rounded-2xl py-3.5 text-[10px] font-black uppercase tracking-[0.28em] text-white transition-transform duration-200 gp-access-cta-pulse ${
                        plan.featured
                          ? 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500'
                          : plan.id === 'signal'
                            ? 'bg-gradient-to-r from-blue-600 via-cyan-500 to-sky-400'
                            : 'bg-gradient-to-r from-red-600 via-orange-500 to-amber-500'
                      } `}
                    >
                      ACTIVAR ACCESO
                    </motion.button>
                  </div>
                </motion.div>
              </motion.li>
            ))}
          </ul>
        </div>

        <motion.footer
          className="border-t border-white/[0.08] pt-4 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <p className="text-[13px] font-semibold tracking-[-0.02em] text-white">
            <span className="mr-2" aria-hidden>
              🔥
            </span>
            ACTIVA TU ACCESO
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/40">
            No es una compra. Es una decisión.
          </p>
        </motion.footer>
      </div>
    </section>
  );
}
