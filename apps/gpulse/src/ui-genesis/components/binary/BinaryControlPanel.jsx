import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Binary, Gauge, RefreshCw, Zap } from 'lucide-react';
import { GlassCard } from '../GlassCard.jsx';
import { GradientButton } from '../GradientButton.jsx';
import { fadeUpBlur } from '../../motion/variants.js';
import {
  BINARY_BONUS_RATE,
  binaryBonusFromMatch,
  binaryMatchVolume,
  flashRiskLevel,
} from '../../binary/binaryEngine.js';
import { useBinaryEngineStore } from '../../binary/binaryEngineStore.js';
import { RuleHint } from '../RuleHint.jsx';

/**
 * Compensation engine UI: leg volume, match, estimated 11% bonus, flash risk, ledger-backed history via LedgerProvider merge.
 * @param {{ hasSession?: boolean, apiLeft?: number, apiRight?: number }} props
 */
export function BinaryControlPanel({ hasSession = false, apiLeft = 0, apiRight = 0 }) {
  const leftPoints = useBinaryEngineStore((s) => s.leftPoints);
  const rightPoints = useBinaryEngineStore((s) => s.rightPoints);
  const resetLegsFromApi = useBinaryEngineStore((s) => s.resetLegsFromApi);
  const executeMatch = useBinaryEngineStore((s) => s.executeMatch);
  const tickMonthFlashIfNeeded = useBinaryEngineStore((s) => s.tickMonthFlashIfNeeded);
  const applyFlashForDemo = useBinaryEngineStore((s) => s.applyFlashForDemo);

  const [busy, setBusy] = useState(false);
  const [lastMsg, setLastMsg] = useState(null);

  useEffect(() => {
    if (!hasSession) return undefined;
    const id = window.setInterval(() => {
      tickMonthFlashIfNeeded();
    }, 60_000);
    tickMonthFlashIfNeeded();
    return () => window.clearInterval(id);
  }, [hasSession, tickMonthFlashIfNeeded]);

  const matchAvailable = useMemo(() => binaryMatchVolume(leftPoints, rightPoints), [leftPoints, rightPoints]);
  const estimatedEarnings = useMemo(() => binaryBonusFromMatch(matchAvailable), [matchAvailable]);
  const remainingVolume = useMemo(() => Math.max(0, leftPoints + rightPoints), [leftPoints, rightPoints]);
  const risk = useMemo(() => flashRiskLevel(leftPoints, rightPoints), [leftPoints, rightPoints]);
  const showFlashWarning = risk === 'high' || risk === 'medium';

  const onProcessMatch = useCallback(() => {
    setBusy(true);
    try {
      const out = executeMatch();
      if (out.ok) {
        setLastMsg(`Matched ${out.match} pts · Bonus ${out.earnings.toFixed(4)} (${BINARY_BONUS_RATE * 100}%)`);
      } else {
        setLastMsg('No match available (need volume on both legs).');
      }
    } finally {
      setBusy(false);
    }
  }, [executeMatch]);

  const onPullApi = useCallback(() => {
    resetLegsFromApi(apiLeft, apiRight);
    setLastMsg('Legs reset from live network totals.');
  }, [resetLegsFromApi, apiLeft, apiRight]);

  const onDemoFlash = useCallback(() => {
    setBusy(true);
    try {
      applyFlashForDemo();
      setLastMsg('Month-end flash applied (50% per leg) — demo.');
    } finally {
      setBusy(false);
    }
  }, [applyFlashForDemo]);

  return (
    <motion.section variants={fadeUpBlur}>
      <GlassCard
        className="border-violet-500/20 shadow-[0_0_40px_-12px_rgba(139,92,246,0.35)]"
        contentClassName="p-0"
      >
        <div className="border-b border-white/10 px-5 py-4 md:px-6 md:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Binary className="h-5 w-5 text-violet-400" strokeWidth={1.75} />
              <h3 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-violet-200/90">
                Binary control panel
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-slate-400">
              <Gauge className="h-3.5 w-3.5" />
              Flash risk:{' '}
              <span
                className={
                  risk === 'high'
                    ? 'text-rose-300'
                    : risk === 'medium'
                      ? 'text-amber-200'
                      : 'text-emerald-300/90'
                }
              >
                {risk}
              </span>
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Match = min(left, right) → both legs consume match → bonus {BINARY_BONUS_RATE * 100}% on matched volume. Month-end: each leg × 0.5.
          </p>
          <div className="mt-2">
            <RuleHint
              variant="tooltip"
              message="Se paga por el lado menor"
              linkText="Emparejamiento"
              modalTitle="Regla de match"
              icon="help"
              modalContent={
                <p>
                  El volumen emparejable en cada ciclo es el mínimo entre pierna izquierda y derecha. Ese match consume el mismo
                  volumen en ambas piernas; el bono referido se calcula sobre el volumen emparejado.
                </p>
              }
            />
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 md:gap-5 md:p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Left points</p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums text-white">{leftPoints.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Right points</p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums text-white">{rightPoints.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-500/80">Match available</p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums text-cyan-100">{matchAvailable.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/80">Est. earnings</p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums text-emerald-100">{estimatedEarnings.toFixed(4)}</p>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Remaining volume (both legs)</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">{remainingVolume.toFixed(2)}</p>
              <p className="mt-1 text-[11px] text-slate-500">API snapshot: {apiLeft} L · {apiRight} R — deltas add to the engine.</p>
            </div>

            {showFlashWarning ? (
              <div className="space-y-2">
                <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/95">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <p>
                    <span className="font-semibold text-amber-50">You are at risk of losing volume due to monthly flash.</span>{' '}
                    Each leg is multiplied by 0.5 at the calendar boundary — process matches regularly or plan leg balance before
                    month-end.
                  </p>
                </div>
                <RuleHint
                  variant="inline"
                  message="Parte de tu volumen será reducida en el cambio de mes por la regla de flash (cada pierna por separado)."
                  linkText="Calendario y flash"
                  modalTitle="Flash mensual"
                  modalContent={
                    <p>
                      En el límite de mes puede aplicarse un factor de reducción (p. ej. 0,5) al volumen remanente en cada pierna,
                      de forma independiente. Consulta el historial operativo para eventos BINARY_FLASH.
                    </p>
                  }
                  className="text-[10px] text-amber-200/75"
                />
              </div>
            ) : null}

            {lastMsg ? <p className="text-[11px] text-slate-400">{lastMsg}</p> : null}

            <div className="flex flex-wrap gap-2">
              <GradientButton
                type="button"
                className="!px-4 !py-2 !text-xs"
                disabled={!hasSession || busy || matchAvailable <= 0}
                onClick={onProcessMatch}
              >
                <Zap className="mr-1.5 inline h-3.5 w-3.5" />
                Process match cycle
              </GradientButton>
              <button
                type="button"
                disabled={!hasSession || busy}
                onClick={onPullApi}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.08] disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Sync legs from API
              </button>
              {import.meta.env.DEV ? (
                <button
                  type="button"
                  disabled={!hasSession || busy}
                  onClick={onDemoFlash}
                  className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] font-medium text-rose-200/90 hover:bg-rose-500/15 disabled:opacity-40"
                >
                  Demo month flash
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.section>
  );
}
