import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MOCK_MINING_CORES } from '../data/mockMiningCores.js';
import { coreProgress01, coreRemainingUsdt, coreTypeToClaimChannel } from '../types/miningCore.js';

function cloneCores(list) {
  return list.map((c) => ({ ...c }));
}

/** Only commit React state when display-relevant fields meaningfully change (avoids ~8Hz context invalidation from float noise). */
function coresCommittedEqual(prev, next) {
  if (prev === next || prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a.id !== b.id) return false;
    if (a.totalGenerated !== b.totalGenerated || a.maxGeneration !== b.maxGeneration) return false;
    if (Math.round(a.accumulated * 1e3) !== Math.round(b.accumulated * 1e3)) return false;
    if (Math.round(a.progress * 1e4) !== Math.round(b.progress * 1e4)) return false;
  }
  return true;
}

/**
 * Local simulation + claim integration. Each core accrues `accumulated` toward `maxGeneration`.
 * @param {{ claim: (type: 'direct'|'mining'|'binary') => Promise<unknown>, hasSession: boolean }} opts
 */
export function useMiningCores({ claim, hasSession }) {
  const [cores, setCores] = useState(() => cloneCores(MOCK_MINING_CORES));
  const [claimingId, setClaimingId] = useState(null);
  const lastRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());

  const step = useCallback(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = Math.min(0.35, Math.max(0, (now - lastRef.current) / 1000));
    lastRef.current = now;
    if (dt <= 0) return;

    setCores((prev) => {
      const next = prev.map((core) => {
        const headroom = Math.max(0, core.maxGeneration - core.totalGenerated);
        if (headroom <= 0) {
          return { ...core, accumulated: 0, progress: 1 };
        }
        const nextAcc = Math.min(core.accumulated + core.ratePerSecond * dt, headroom);
        const row = { ...core, accumulated: nextAcc };
        row.progress = coreProgress01(row);
        return row;
      });
      if (coresCommittedEqual(prev, next)) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(step, 120);
    return () => window.clearInterval(id);
  }, [step]);

  const summary = useMemo(() => {
    let totalAccumulated = 0;
    let totalGeneration = 0;
    let totalRatePerSecond = 0;
    for (const c of cores) {
      totalAccumulated += c.accumulated;
      totalGeneration += c.totalGenerated + c.accumulated;
      const headroom = Math.max(0, c.maxGeneration - c.totalGenerated);
      if (headroom > 0) totalRatePerSecond += c.ratePerSecond;
    }
    return { totalAccumulated, totalGeneration, totalRatePerSecond };
  }, [cores]);

  const applyProductActivation = useCallback(({ product, totalUsdtEq }) => {
    const add = Math.max(0, Number(totalUsdtEq) || 0);
    if (add <= 0 || product === 'gpulse') return;

    setCores((prev) =>
      prev.map((c) => {
        if (product === 'staking' && c.type === 'staking' && c.id === 'core-staking-1') {
          const next = {
            ...c,
            contribution: c.contribution + add * 0.22,
            lockedAig: (c.lockedAig ?? 0) + add * 0.15,
            maxGeneration: c.maxGeneration + add * 1.8,
            ratePerSecond: c.ratePerSecond + add * 4e-6,
          };
          next.progress = coreProgress01(next);
          return next;
        }
        if (product === 'mining' && c.type === 'mining' && c.id === 'core-mining-1') {
          const next = {
            ...c,
            contribution: c.contribution + add * 0.28,
            maxGeneration: c.maxGeneration + add * 2.2,
            ratePerSecond: c.ratePerSecond + add * 6e-6,
          };
          next.progress = coreProgress01(next);
          return next;
        }
        if (product === 'booster' && c.type === 'booster' && c.id === 'core-booster-1') {
          const next = {
            ...c,
            contribution: c.contribution + add * 0.32,
            maxGeneration: c.maxGeneration + add * 2.6,
            ratePerSecond: c.ratePerSecond + add * 5e-6,
          };
          next.progress = coreProgress01(next);
          return next;
        }
        return c;
      }),
    );
  }, []);

  const claimCore = useCallback(
    async (core) => {
      if (!hasSession || core.accumulated <= 0) return;
      const channel = coreTypeToClaimChannel(core.type);
      setClaimingId(core.id);
      try {
        await claim(channel, { coreId: core.id });
        setCores((prev) =>
          prev.map((c) => {
            if (c.id !== core.id) return c;
            const claimed = c.accumulated;
            const next = {
              ...c,
              totalGenerated: c.totalGenerated + claimed,
              accumulated: 0,
            };
            next.progress = coreProgress01(next);
            return next;
          }),
        );
      } finally {
        setClaimingId(null);
      }
    },
    [claim, hasSession],
  );

  return { cores, summary, claimCore, claimingId, coreRemainingUsdt, applyProductActivation };
}
