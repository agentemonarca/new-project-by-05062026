import React, { memo, useCallback, useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const LOGO_SRC = '/logo-icon.png';
const BG_BASE = '#0b0f1a';

const cardStyle = {
  background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(0,240,255,0.2)',
  borderRadius: 20,
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08, duration: 0.4 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
};

function NetworkMesh({ className }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg
      className={className}
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M20 200 Q100 60 200 200 T380 200"
        stroke={`url(#${gid})`}
        strokeWidth="0.35"
        vectorEffect="non-scaling-stroke"
        opacity="0.3"
      />
      <path
        d="M0 300 Q180 100 360 260"
        stroke={`url(#${gid})`}
        strokeWidth="0.3"
        vectorEffect="non-scaling-stroke"
        opacity="0.2"
      />
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f0ff" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const PARTICLE_KEYS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

function FloatingParticles({ reduceMotion }) {
  if (reduceMotion) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-[12%] top-[20%] h-1 w-1 rounded-full bg-cyan-400/30" />
        <div className="absolute right-[18%] top-[35%] h-1 w-1 rounded-full bg-violet-400/25" />
        <div className="absolute bottom-[25%] left-[40%] h-0.5 w-0.5 rounded-full bg-fuchsia-400/30" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {PARTICLE_KEYS.map((key, i) => (
        <motion.div
          key={key}
          className="absolute rounded-full bg-cyan-400/20"
          style={{
            width: 3 + (i % 3),
            height: 3 + (i % 3),
            left: `${10 + i * 14}%`,
            top: `${18 + (i * 11) % 55}%`,
          }}
          animate={{
            y: [0, -14, 0],
            x: [0, i % 2 === 0 ? 6 : -6, 0],
            opacity: [0.2, 0.45, 0.2],
          }}
          transition={{
            duration: 5 + i * 0.6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.4,
          }}
        />
      ))}
    </div>
  );
}

function EliteLogo({ reduceMotion }) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);

  if (failed) {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-[rgba(0,240,255,0.35)] bg-gradient-to-br from-cyan-500/15 to-fuchsia-600/15 shadow-[0_0_40px_-8px_rgba(0,240,255,0.45)]">
        <Sparkles className="h-11 w-11 text-[#00f0ff]" strokeWidth={1.5} aria-hidden />
      </div>
    );
  }

  return (
    <motion.div
      className="relative"
      animate={
        reduceMotion
          ? undefined
          : {
              filter: [
                'drop-shadow(0 0 22px rgba(0,240,255,0.45))',
                'drop-shadow(0 0 36px rgba(236,72,153,0.35))',
                'drop-shadow(0 0 22px rgba(0,240,255,0.45))',
              ],
            }
      }
      transition={reduceMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <img
        src={LOGO_SRC}
        alt="AiGenesis"
        width={128}
        height={128}
        decoding="async"
        loading="eager"
        onError={onError}
        className="relative h-24 w-24 object-contain sm:h-28 sm:w-28"
      />
    </motion.div>
  );
}

/**
 * Elite invitation threshold — glass card, exact premium copy.
 *
 * @param {{
 *   refUser: string,
 *   onEnter: () => void,
 * }} props
 */
function OnboardingEliteInner({ refUser, onEnter }) {
  const reduceMotion = useReducedMotion();
  const displayRef =
    refUser && String(refUser).trim().length > 0 ? String(refUser).trim() : 'un miembro de la red';

  return (
    <section
      className="relative isolate flex min-h-[100dvh] w-full items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-14"
      style={{ backgroundColor: BG_BASE }}
    >
      {/* Base gradients */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-20%,rgba(0,240,255,0.12),transparent_50%),radial-gradient(ellipse_80%_50%_at_100%_80%,rgba(168,85,247,0.14),transparent_55%),radial-gradient(ellipse_70%_45%_at_0%_90%,rgba(236,72,153,0.08),transparent_45%)]"
        aria-hidden
      />

      <motion.div
        className="pointer-events-none absolute inset-[-8%] -z-10 scale-105"
        aria-hidden
        initial={false}
        animate={reduceMotion ? undefined : { scale: [1, 1.03, 1] }}
        transition={reduceMotion ? undefined : { duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background:
            'linear-gradient(135deg, rgba(15,23,42,0.4) 0%, rgba(15,23,42,0.15) 40%, rgba(30,27,75,0.2) 100%)',
        }}
      />

      <FloatingParticles reduceMotion={reduceMotion} />
      <NetworkMesh className="pointer-events-none absolute left-1/2 top-[8%] -z-10 h-[min(120vw,520px)] w-full max-w-2xl -translate-x-1/2 opacity-80 sm:top-[5%]" />

      <motion.div
        className="relative z-10 w-full max-w-lg px-1 shadow-[0_0_56px_-12px_rgba(0,240,255,0.16)] sm:max-w-xl"
        style={cardStyle}
        initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col items-center">
            <motion.div
              className="mb-8 flex justify-center"
              variants={itemVariants}
              initial="hidden"
              animate="show"
            >
              <EliteLogo reduceMotion={reduceMotion} />
            </motion.div>

            <motion.div
              className="w-full text-center"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              <motion.p
                variants={itemVariants}
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.32em] text-[#00f0ff]/90 sm:text-[11px]"
              >
                INVITACIÓN PRIVILEGIADA
              </motion.p>

              <motion.p
                variants={itemVariants}
                className="mt-5 text-balance text-base font-medium leading-snug text-slate-100 sm:text-lg sm:leading-snug"
              >
                <span className="font-semibold text-[#00f0ff]" style={{ textShadow: '0 0 24px rgba(0,240,255,0.35)' }}>
                  {displayRef}
                </span>{' '}
                te ha seleccionado para acceder al{' '}
                <span className="bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-pink-400 bg-clip-text font-semibold text-transparent [filter:drop-shadow(0_0_12px_rgba(168,85,247,0.45))]">
                  ecosistema elite
                </span>{' '}
                de AiGenesis
              </motion.p>

              <motion.p
                variants={itemVariants}
                className="mt-5 text-balance text-sm leading-relaxed text-slate-300/95 sm:text-[15px]"
              >
                Un entorno reservado para quienes entienden
                <br />
                el valor de la innovación, la inteligencia y la expansión.
              </motion.p>

              <motion.div variants={itemVariants} className="mt-5 space-y-0.5 text-sm text-slate-400 sm:text-[15px]">
                <p>El acceso no es público.</p>
                <p>No es abierto.</p>
                <p>No es para todos.</p>
              </motion.div>

              <motion.p
                variants={itemVariants}
                className="mt-5 text-balance text-sm leading-relaxed text-slate-300/95 sm:text-[15px]"
              >
                Solo quienes reciben esta invitación
                <br />
                pueden cruzar este umbral.
              </motion.p>

              <motion.p variants={itemVariants} className="mt-6 text-sm text-slate-500">
                No estás entrando a una plataforma.
              </motion.p>

              <motion.p
                variants={itemVariants}
                className="mt-2 text-balance text-lg font-medium italic leading-snug text-white sm:text-xl"
              >
                Estás accediendo a un{' '}
                <span className="not-italic font-semibold text-transparent [text-shadow:0_0_28px_rgba(236,72,153,0.35)] bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-pink-300 bg-clip-text">
                  ecosistema elite
                </span>
                .
              </motion.p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="show"
              className="mt-10 w-full max-w-sm"
            >
              <motion.button
                type="button"
                onClick={onEnter}
                className="group relative w-full overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500 via-violet-600 to-fuchsia-600 px-6 py-4 text-center text-sm font-semibold text-white shadow-[0_0_32px_-4px_rgba(0,240,255,0.5),0_0_28px_-6px_rgba(236,72,153,0.35)] transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00f0ff]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f1a] sm:py-[1.05rem] sm:text-base"
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 1.02,
                        boxShadow:
                          '0 0 48px -2px rgba(0,240,255,0.55), 0 0 40px -4px rgba(236,72,153,0.4)',
                      }
                }
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              >
                <span
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.22) 45%, transparent 65%)',
                  }}
                  aria-hidden
                />
                <span className="relative">Acceder al Ecosistema Elite</span>
              </motion.button>
              <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">
                Acceso únicamente mediante invitación verificada
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

export const OnboardingElite = memo(OnboardingEliteInner);
OnboardingElite.displayName = 'OnboardingElite';
