import React, { useCallback, useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BrandLogo } from '../../branding/BrandLogo.jsx';
import { ONBOARDING_ASSETS } from './onboardingAssets.js';

const BG_FALLBACK =
  'radial-gradient(ellipse 120% 80% at 50% 0%, rgba(34,211,238,0.14) 0%, transparent 55%), radial-gradient(ellipse 90% 70% at 100% 100%, rgba(139,92,246,0.12) 0%, transparent 50%), radial-gradient(ellipse 80% 60% at 0% 100%, rgba(217,70,239,0.08) 0%, transparent 45%), #0b0f1a';

/**
 * Subtle AI / network motif (inline SVG — no extra request).
 */
function NetworkLines({ className }) {
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
        d="M40 200 Q120 80 200 200 T360 200"
        stroke={`url(#${gid})`}
        strokeWidth="0.4"
        vectorEffect="non-scaling-stroke"
        opacity="0.35"
      />
      <path
        d="M0 280 Q160 120 320 240"
        stroke={`url(#${gid})`}
        strokeWidth="0.35"
        vectorEffect="non-scaling-stroke"
        opacity="0.22"
      />
      <path
        d="M80 360 Q200 200 340 100"
        stroke={`url(#${gid})`}
        strokeWidth="0.28"
        vectorEffect="non-scaling-stroke"
        opacity="0.18"
      />
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.12, duration: 0.45 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 28 },
  },
};

/**
 * Premium referral invitation — Web3 / exchange-grade first impression.
 *
 * @param {{
 *   refUser: string,
 *   onContinue: () => void,
 * }} props
 */
export default function OnboardingPremium({ refUser, onContinue }) {
  const reduceMotion = useReducedMotion();
  const [bgOk, setBgOk] = useState(true);
  const [particlesOk, setParticlesOk] = useState(true);
  const [glowOk, setGlowOk] = useState(true);

  const onBgError = useCallback(() => setBgOk(false), []);
  const onParticlesError = useCallback(() => setParticlesOk(false), []);
  const onGlowError = useCallback(() => setGlowOk(false), []);

  return (
    <section
      className="relative isolate flex min-h-[100dvh] w-full overflow-hidden font-display text-slate-100"
      style={{ backgroundColor: '#0b0f1a' }}
    >
      {/* Base + CSS fallback always present */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: BG_FALLBACK }}
        aria-hidden
      />

      {/* Photo / texture layer */}
      {bgOk ? (
        <motion.div
          className="pointer-events-none absolute inset-0 -z-10"
          initial={reduceMotion ? false : { scale: 1 }}
          animate={reduceMotion ? undefined : { scale: [1, 1.04, 1] }}
          transition={reduceMotion ? undefined : { duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        >
          <img
            src={ONBOARDING_ASSETS.bg}
            alt=""
            width={960}
            height={720}
            decoding="async"
            fetchPriority="high"
            loading="eager"
            onError={onBgError}
            className="h-full w-full object-cover opacity-[0.38]"
          />
        </motion.div>
      ) : null}

      {particlesOk ? (
        <div
          className="pointer-events-none absolute inset-0 -z-10 mix-blend-screen"
          aria-hidden
        >
          <img
            src={ONBOARDING_ASSETS.particles}
            alt=""
            width={400}
            height={400}
            decoding="async"
            loading="lazy"
            onError={onParticlesError}
            className="h-full w-full object-cover opacity-[0.18]"
          />
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#0b0f1a]/75 via-[#0b0f1a]/88 to-[#0b0f1a]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_40%_at_50%_18%,rgba(34,211,238,0.12),transparent_70%)]"
        aria-hidden
      />

      <NetworkLines className="pointer-events-none absolute -z-10 h-[min(140vw,720px)] w-full max-w-3xl left-1/2 top-[12%] -translate-x-1/2 opacity-90 sm:top-[8%]" />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-lg flex-1 flex-col items-center justify-between gap-8 px-5 py-10 sm:max-w-xl sm:gap-10 sm:px-8 sm:py-14"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants} className="flex flex-col items-center text-center pt-2">
          <div className="relative">
            {glowOk ? (
              <motion.div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                initial={false}
                animate={
                  reduceMotion
                    ? { opacity: 0.35 }
                    : {
                        opacity: [0.28, 0.5, 0.32],
                        scale: [1, 1.06, 1],
                      }
                }
                transition={
                  reduceMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
                }
                aria-hidden
              >
                <img
                  src={ONBOARDING_ASSETS.glow}
                  alt=""
                  width={320}
                  height={320}
                  decoding="async"
                  loading="lazy"
                  onError={onGlowError}
                  className="h-full w-full object-contain opacity-70 mix-blend-screen blur-md"
                />
              </motion.div>
            ) : (
              <motion.div
                className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/25 blur-3xl"
                animate={
                  reduceMotion ? undefined : { opacity: [0.35, 0.6, 0.4], scale: [1, 1.15, 1] }
                }
                transition={
                  reduceMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }
                }
                aria-hidden
              />
            )}

            <motion.div
              className="relative"
              animate={
                reduceMotion
                  ? undefined
                  : {
                      filter: [
                        'drop-shadow(0 0 20px rgba(34,211,238,0.35))',
                        'drop-shadow(0 0 32px rgba(139,92,246,0.45))',
                        'drop-shadow(0 0 20px rgba(34,211,238,0.35))',
                      ],
                    }
              }
              transition={reduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <BrandLogo size="hero" framed className="shadow-[0_0_40px_-10px_rgba(34,211,238,0.45)]" />
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="flex w-full flex-1 flex-col items-center justify-center gap-5 text-center sm:gap-6"
        >
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/85 sm:text-xs">
            Invitación exclusiva
          </p>

          <h1 className="text-balance text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl sm:leading-snug">
            <span className="bg-gradient-to-r from-cyan-200 via-white to-violet-200 bg-clip-text text-transparent">
              {refUser}
            </span>{' '}
            te ha invitado a formar parte de AiGenesis
          </h1>

          <p className="max-w-md text-balance text-sm leading-relaxed text-slate-300/95 sm:text-[15px]">
            Una comunidad global en crecimiento, donde la inteligencia, la tecnología y el valor convergen.
          </p>

          <p className="max-w-md text-balance text-sm font-medium leading-relaxed text-slate-400/95 sm:text-[15px]">
            No es solo una plataforma.
            <br />
            Es el inicio de un nuevo sistema.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="w-full max-w-sm pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <motion.button
            type="button"
            onClick={onContinue}
            className="group relative w-full overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/90 via-violet-500/90 to-fuchsia-500/85 px-8 py-4 text-center text-base font-semibold text-white shadow-[0_0_28px_-6px_rgba(34,211,238,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] transition-[box-shadow,transform] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f1a] sm:py-[1.05rem]"
            whileHover={reduceMotion ? undefined : { scale: 1.02, boxShadow: '0 0 40px -4px rgba(139,92,246,0.55)' }}
            whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          >
            <span
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.2) 45%, transparent 65%)',
              }}
              aria-hidden
            />
            <span className="relative">Acceder ahora</span>
          </motion.button>
        </motion.div>
      </motion.div>
    </section>
  );
}
