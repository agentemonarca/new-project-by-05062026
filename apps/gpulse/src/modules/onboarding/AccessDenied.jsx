import React, { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Invitation-only barrier — no referral persisted → no access.
 */
function AccessDeniedInner() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-6 py-12 font-display"
      style={{ backgroundColor: '#0b0f1a' }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,240,255,0.08),transparent_55%),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(168,85,247,0.1),transparent_50%)]"
        aria-hidden
      />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md rounded-[20px] border border-[rgba(0,240,255,0.18)] bg-white/[0.03] px-8 py-10 text-center shadow-[0_0_48px_-12px_rgba(0,240,255,0.15)] backdrop-blur-[20px]"
      >
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-[#00f0ff]/85">
          Acceso restringido
        </p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          AiGenesis es solo por invitación
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Necesitas un enlace válido con referido para continuar. Si tienes invitación, abre el enlace que te
          compartieron o pide a tu sponsor la URL con{' '}
          <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-cyan-200/90">?ref=</code>.
        </p>
      </motion.div>
    </div>
  );
}

export const AccessDenied = memo(AccessDeniedInner);
AccessDenied.displayName = 'AccessDenied';
