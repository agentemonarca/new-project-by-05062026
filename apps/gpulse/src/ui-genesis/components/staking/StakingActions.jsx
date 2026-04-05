import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * @param {{
 *   onStake: () => void,
 *   onClaimAll: () => void,
 *   claimDisabled: boolean,
 *   claiming: boolean,
 *   hideClaim?: boolean,
 *   onGoToWallet?: () => void,
 * }} props
 */
export function StakingActions({ onStake, onClaimAll, claimDisabled, claiming, hideClaim = false, onGoToWallet }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <motion.button
        type="button"
        onClick={onStake}
        className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-white shadow-[0_0_32px_-6px_rgba(37,99,235,0.55)] transition hover:shadow-[0_0_40px_-4px_rgba(14,165,233,0.55)]"
        whileHover={reduceMotion ? undefined : { scale: 1.02 }}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      >
        <span className="relative z-10">Hacer staking</span>
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-transparent to-white/10 opacity-40" />
      </motion.button>

      {hideClaim ? (
        <motion.button
          type="button"
          onClick={onGoToWallet}
          className="rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
          whileHover={reduceMotion ? undefined : { scale: 1.02 }}
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        >
          Reclamaciones en Wallet →
        </motion.button>
      ) : (
        <motion.button
          type="button"
          onClick={onClaimAll}
          disabled={claimDisabled}
          className="rounded-xl border border-cyan-400/45 bg-cyan-500/15 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-cyan-100 shadow-[0_0_24px_-8px_rgba(34,211,238,0.35)] transition hover:border-cyan-300/55 hover:bg-cyan-500/22 disabled:pointer-events-none disabled:opacity-45"
          whileHover={reduceMotion || claimDisabled ? undefined : { scale: 1.02 }}
          whileTap={reduceMotion || claimDisabled ? undefined : { scale: 0.98 }}
        >
          {claiming ? 'Reclamando…' : 'Reclamar AIG'}
        </motion.button>
      )}
    </div>
  );
}
