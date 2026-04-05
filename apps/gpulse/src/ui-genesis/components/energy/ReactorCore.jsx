import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useCore } from '../../core/CoreContext.jsx';
import { getEfficiency } from '../../core/nextActionEngine.js';
import { ReactorVisual } from './ReactorVisual.jsx';

/** Same threshold as next-action engine (energy index 0–1). */
const EFFICIENCY_WARN = 0.7;

function ReactorBreakdownModal({ open, onClose, power, multiplier, networkBoost, stakingYield, energy }) {
  const reduceMotion = useReducedMotion();

  const rows = [
    { label: 'Power', value: Number(power).toFixed(4), hint: 'mining engines (0–1)' },
    { label: 'Multiplier', value: Number(multiplier).toFixed(3), hint: 'booster curve' },
    { label: 'Network boost', value: `${Math.round(Number(networkBoost) * 100)}%`, hint: 'binary balance' },
    { label: 'Staking yield', value: `${Math.round(Number(stakingYield) * 100)}%`, hint: 'participation' },
    { label: 'Energy index', value: `${Math.round(Number(energy))} / 100`, hint: 'unified score' },
  ];

  return (
    <AnimatePresence mode="wait">
      {open ? (
        <motion.div
          key="reactor-breakdown"
          className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reactor-breakdown-title"
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-950/95 shadow-[0_24px_80px_-20px_rgba(34,211,238,0.35)]"
            initial={reduceMotion ? false : { y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 id="reactor-breakdown-title" className="font-display text-lg font-semibold text-white">
                Reactor breakdown
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-[min(70vh,520px)] space-y-3 overflow-y-auto px-5 py-4">
              {rows.map(({ label, value, hint }) => (
                <li
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{label}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-cyan-200">{value}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-white/10 px-5 py-3 text-[10px] text-slate-500">
              Values mirror CoreContext — single source of truth for the energy layer.
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Container: CoreContext → feedback edges → {@link ReactorVisual}.
 * Optional audio (hum / pulse) can be wired later behind a user gesture + preference flag — omitted to avoid autoplay policy issues.
 *
 * @param {{ className?: string }} props
 */
export function ReactorCore({ className = '' }) {
  if (import.meta.env.DEV) console.count('Reactor render');
  const core = useCore();
  const {
    energy,
    reactorState,
    totalYieldAigPerSecond,
    totalYield,
    power,
    multiplier,
    networkBoost,
    stakingYield,
    claimUi,
  } = core;

  const showEfficiencyWarning = getEfficiency(core) < EFFICIENCY_WARN;

  const [detailOpen, setDetailOpen] = useState(false);
  const [feedback, setFeedback] = useState({ energy: 0, mult: 0, claim: 0 });

  const prevEnergy = useRef(energy);
  const prevMult = useRef(multiplier);
  const prevClaimBusy = useRef(claimUi?.claimAllBusy);

  useEffect(() => {
    if (energy > prevEnergy.current + 0.25) {
      setFeedback((f) => ({ ...f, energy: f.energy + 1 }));
    }
    prevEnergy.current = energy;
  }, [energy]);

  useEffect(() => {
    if (multiplier > prevMult.current + 0.008) {
      setFeedback((f) => ({ ...f, mult: f.mult + 1 }));
    }
    prevMult.current = multiplier;
  }, [multiplier]);

  useEffect(() => {
    const busy = claimUi?.claimAllBusy;
    if (prevClaimBusy.current === true && busy === false) {
      setFeedback((f) => ({ ...f, claim: f.claim + 1 }));
    }
    prevClaimBusy.current = busy;
  }, [claimUi?.claimAllBusy]);

  const openDetail = useCallback(() => setDetailOpen(true), []);
  const closeDetail = useCallback(() => setDetailOpen(false), []);

  useEffect(() => {
    if (!detailOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailOpen, closeDetail]);

  return (
    <>
      <ReactorVisual
        className={className}
        state={reactorState}
        energy={energy}
        aigPerSecond={totalYieldAigPerSecond}
        yieldMultiplier={totalYield}
        showEfficiencyWarning={showEfficiencyWarning}
        energyPulseTick={feedback.energy}
        multiplierFlashTick={feedback.mult}
        claimBurstTick={feedback.claim}
        onClick={openDetail}
      />
      <ReactorBreakdownModal
        open={detailOpen}
        onClose={closeDetail}
        power={power}
        multiplier={multiplier}
        networkBoost={networkBoost}
        stakingYield={stakingYield}
        energy={energy}
      />
    </>
  );
}
