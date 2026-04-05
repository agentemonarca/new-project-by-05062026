import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GradientButton } from '../GradientButton.jsx';

/**
 * @param {{
 *   onInject: () => void,
 *   onClaimAig: () => void | Promise<void>,
 *   claimDisabled: boolean,
 *   claiming: boolean,
 *   hideClaim?: boolean,
 *   onGoToWallet?: () => void,
 * }} props
 */
export function BoosterActions({ onInject, onClaimAig, claimDisabled, claiming, hideClaim = false, onGoToWallet }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <motion.div whileHover={reduceMotion ? undefined : { scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <GradientButton
          type="button"
          className="!rounded-2xl !px-8 !py-3.5 !text-sm font-bold shadow-[0_0_36px_rgba(139,92,246,0.45)]"
          onClick={onInject}
        >
          Inyectar booster
        </GradientButton>
      </motion.div>
      {hideClaim ? (
        <motion.button
          type="button"
          onClick={onGoToWallet}
          className="w-full rounded-2xl border border-white/20 bg-white/5 px-8 py-3.5 text-sm font-bold text-slate-200 transition hover:bg-white/10 sm:w-auto"
          whileHover={reduceMotion ? undefined : { scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Reclamaciones en Wallet →
        </motion.button>
      ) : (
        <motion.div whileHover={reduceMotion ? undefined : { scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <button
            type="button"
            disabled={claimDisabled || claiming}
            onClick={() => void onClaimAig()}
            className="w-full rounded-2xl border border-cyan-400/40 bg-gradient-to-r from-cyan-500/20 to-cyan-400/10 px-8 py-3.5 text-sm font-bold text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.25)] transition hover:border-cyan-300/60 hover:shadow-[0_0_40px_rgba(34,211,238,0.35)] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {claiming ? 'Reclamando…' : 'Reclamar recompensas'}
          </button>
        </motion.div>
      )}
    </div>
  );
}
