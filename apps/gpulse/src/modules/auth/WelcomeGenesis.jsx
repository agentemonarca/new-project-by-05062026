import React, { memo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BrandLogo } from '@/branding/BrandLogo.jsx';
import { BRAND } from '@/branding/brand.js';

const REDIRECT_MS = 2600;

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

function FloatingDust({ reduceMotion }) {
  if (reduceMotion) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-cyan-400/15"
          style={{
            width: 2 + (i % 2),
            height: 2 + (i % 2),
            left: `${15 + i * 16}%`,
            top: `${20 + (i * 13) % 50}%`,
          }}
          animate={{ y: [0, -12, 0], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
        />
      ))}
    </div>
  );
}

function WelcomeGenesisInner() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const redirected = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem('aig_access_verified', '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (redirected.current) return;
      redirected.current = true;
      try {
        navigate('/dashboard', { replace: true });
      } catch {
        window.location.href = '/dashboard';
      }
    }, REDIRECT_MS);
    return () => window.clearTimeout(t);
  }, [navigate]);

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-5 py-12 font-display"
      style={{ backgroundColor: '#0b0f1a' }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,rgba(0,240,255,0.14),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_100%,rgba(236,72,153,0.1),transparent_50%)]"
        aria-hidden
      />
      <FloatingDust reduceMotion={reduceMotion} />

      <motion.div
        className="relative z-10 w-full max-w-lg rounded-[20px] border border-[rgba(0,240,255,0.2)] bg-white/[0.03] px-8 py-10 text-center shadow-[0_0_56px_-12px_rgba(0,240,255,0.2)] backdrop-blur-[20px] sm:px-12 sm:py-12"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="mb-8 flex justify-center"
          animate={
            reduceMotion
              ? undefined
              : {
                  filter: [
                    'drop-shadow(0 0 24px rgba(0,240,255,0.4))',
                    'drop-shadow(0 0 36px rgba(236,72,153,0.35))',
                    'drop-shadow(0 0 24px rgba(0,240,255,0.4))',
                  ],
                }
          }
          transition={reduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BrandLogo size="hero" framed />
        </motion.div>

        <motion.div variants={container} initial="hidden" animate="show">
          <motion.h1 variants={item} className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Bienvenido a {BRAND.name}
          </motion.h1>
          <motion.p variants={item} className="mt-4 text-base text-cyan-200/90 sm:text-lg">
            Tu acceso ha sido confirmado
          </motion.p>
          <motion.p variants={item} className="mt-5 text-sm leading-relaxed text-slate-300/95 sm:text-[15px]">
            Ahora formas parte de un ecosistema elite
            <br />
            en expansión global
          </motion.p>
          <motion.p variants={item} className="mt-5 text-sm font-medium text-slate-400">
            Has cruzado el umbral
          </motion.p>
          <motion.p
            variants={item}
            className="mt-8 font-display text-2xl font-semibold italic text-transparent sm:text-3xl"
            style={{
              background: 'linear-gradient(105deg, #22d3ee, #e879f9, #f472b6)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            Felicidades
          </motion.p>
        </motion.div>

        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Redirigiendo al dashboard…
        </p>
      </motion.div>
    </div>
  );
}

export const WelcomeGenesis = memo(WelcomeGenesisInner);
WelcomeGenesis.displayName = 'WelcomeGenesis';
