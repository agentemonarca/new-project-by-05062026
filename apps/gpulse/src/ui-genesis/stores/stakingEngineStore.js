import { create } from 'zustand';
import { isGpulseRealProviderExecution } from '../../utils/gpulseRngPolicy.js';

/** Premium programs — monthly ROI % and lock days. */
export const STAKING_PLANS = [
  { id: 'm1', name: 'Starter', months: 1, monthlyRoiPct: 7, lockDays: 30 },
  { id: 'm3', name: 'Growth', months: 3, monthlyRoiPct: 8, lockDays: 90 },
  { id: 'm6', name: 'Pro', months: 6, monthlyRoiPct: 10, lockDays: 180 },
  { id: 'm9', name: 'Elite', months: 9, monthlyRoiPct: 11, lockDays: 270 },
  { id: 'm12', name: 'Genesis', months: 12, monthlyRoiPct: 20, lockDays: 365 },
];

const BONUS_PCT = 11;

function seedTeamFlat() {
  return [
    { id: 'u1', username: '@NodeAlpha', plan: '6m', amount: 4200, remainingSec: 45 * 86400, active: true, volume: 128000, bonusYou: 924 },
    { id: 'u2', username: '@BinaryQueen', plan: '12m', amount: 12000, remainingSec: 220 * 86400, active: true, volume: 340000, bonusYou: 3740 },
    { id: 'u3', username: '@SilentCap', plan: '—', amount: 0, remainingSec: 0, active: false, volume: 12000, bonusYou: 0 },
    { id: 'u4', username: '@WaveRunner', plan: '3m', amount: 1800, remainingSec: 12 * 86400, active: true, volume: 89000, bonusYou: 418 },
    { id: 'u5', username: '@OffGrid', plan: '1m', amount: 900, remainingSec: 5 * 86400, active: true, volume: 41000, bonusYou: 210 },
    { id: 'u6', username: '@NoStakeYet', plan: '—', amount: 0, remainingSec: 0, active: false, volume: 6700, bonusYou: 0 },
    { id: 'u7', username: '@TopVolume', plan: '9m', amount: 8500, remainingSec: 180 * 86400, active: true, volume: 512000, bonusYou: 5632 },
  ];
}

let engineId = 0;

/**
 * Staking “economic engine” — plans, mock active locks, team visibility, live tick.
 */
export const useStakingEngineStore = create((set, get) => ({
  /** Simulated floating earnings (USD) — ticks upward for live feel */
  liveAccumulatedUsdt: 1284.37,

  /** Mock on-chain engine positions (separate from mining cores UI) */
  activeEngineStakings: [],

  teamFlat: seedTeamFlat(),

  tableFilter: 'all',

  setTableFilter: (tableFilter) => set({ tableFilter }),

  tickLiveEarnings: () =>
    set((s) => {
      const bump = isGpulseRealProviderExecution() ? 0.05 : 0.02 + Math.random() * 0.06;
      return { liveAccumulatedUsdt: s.liveAccumulatedUsdt + bump };
    }),

  accrueEngineRewards: () => {
    const now = Date.now();
    set((s) => ({
      activeEngineStakings: s.activeEngineStakings.map((row) => {
        if (row.claimed || now >= row.endsAt) return row;
        const plan = STAKING_PLANS.find((p) => p.id === row.planId);
        if (!plan) return row;
        const perSecond = (plan.monthlyRoiPct / 100 / (30 * 86400)) * row.investedUsdt;
        return { ...row, rewardsUsdt: row.rewardsUsdt + perSecond };
      }),
    }));
  },

  activatePlan: (planId) => {
    const plan = STAKING_PLANS.find((p) => p.id === planId);
    if (!plan) return;
    engineId += 1;
    const id = `engine-${engineId}`;
    const investedUsdt = 2500;
    const endsAt = Date.now() + plan.lockDays * 86400000;
    set((s) => ({
      activeEngineStakings: [
        ...s.activeEngineStakings,
        {
          id,
          planId: plan.id,
          planLabel: `${plan.months} mes${plan.months > 1 ? 'es' : ''}`,
          investedUsdt,
          rewardsUsdt: 0,
          endsAt,
          claimed: false,
        },
      ],
    }));
  },

  claimEngineStaking: (id) => {
    const now = Date.now();
    set((s) => ({
      activeEngineStakings: s.activeEngineStakings.map((row) =>
        row.id === id && row.endsAt <= now && !row.claimed ? { ...row, claimed: true, rewardsUsdt: 0 } : row,
      ),
    }));
  },

  binaryBonusPct: BONUS_PCT,

  /** Team staking volume (USD) for binary section */
  getTeamStakingVolume: () => {
    const flat = get()?.teamFlat;
    if (!Array.isArray(flat)) return 0;
    return flat.reduce((s, u) => s + (u?.active ? (Number(u?.volume) || 0) : 0), 0);
  },

  getFilteredTeam: () => {
    const { teamFlat, tableFilter } = get();
    let rows = [...(Array.isArray(teamFlat) ? teamFlat : [])];
    if (tableFilter === 'active') rows = rows.filter((u) => u.active);
    else if (tableFilter === 'inactive') rows = rows.filter((u) => !u.active);
    else if (tableFilter === 'top') rows.sort((a, b) => b.volume - a.volume);
    else if (tableFilter === 'expiring') {
      rows = rows
        .filter((u) => u.active && u.remainingSec > 0)
        .sort((a, b) => a.remainingSec - b.remainingSec);
    }
    return rows;
  },
}));
