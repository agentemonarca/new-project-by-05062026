import React from 'react';
import { AnimatedMetric } from '../AnimatedMetric.jsx';
import { USDT_TO_AIG_DISPLAY } from '../../types/miningCore.js';
import { useCore } from '../../core/CoreContext.jsx';

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.06] py-2 last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="font-mono text-sm text-cyan-100/95 tabular-nums">{children}</div>
    </div>
  );
}

/** All metrics from CoreContext — no props. */
export function EnergyStats() {
  const {
    aigBalance,
    totalYieldAigPerSecond,
    rawTotalRatePerSecond,
    power,
    multiplier,
    networkBoost,
    energy,
  } = useCore();

  const rawAigPerSec = rawTotalRatePerSecond * USDT_TO_AIG_DISPLAY;

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/60 p-4 backdrop-blur-md">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Energy engine</p>
      <Row label="AIG balance (est.)">
        <AnimatedMetric
          value={aigBalance}
          format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} AIG`}
        />
      </Row>
      <Row label="AIG/s (engine)">
        <AnimatedMetric
          value={totalYieldAigPerSecond}
          format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 8 })}`}
        />
      </Row>
      <Row label="Raw rate (protocol)">
        <span className="text-xs text-slate-400">
          <AnimatedMetric
            value={rawAigPerSec}
            format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 8 })} AIG/s`}
          />
        </span>
      </Row>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
        <div className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-center">
          <p className="text-[9px] uppercase text-slate-500">Power</p>
          <p className="font-mono text-xs text-white">{power.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-center">
          <p className="text-[9px] uppercase text-slate-500">×Mult</p>
          <p className="font-mono text-xs text-white">{multiplier.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-center">
          <p className="text-[9px] uppercase text-slate-500">Net</p>
          <p className="font-mono text-xs text-white">{networkBoost.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-center">
          <p className="text-[9px] uppercase text-slate-500">Energy</p>
          <p className="font-mono text-xs text-white">{energy.toFixed(0)}</p>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-slate-600">
        Unified yield uses energy × staking participation on raw protocol power.
      </p>
    </div>
  );
}
