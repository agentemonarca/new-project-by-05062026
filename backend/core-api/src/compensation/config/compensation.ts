/**
 * Single source of truth for compensation percentages and caps.
 * Tune via env in loadCompensationRules() for deployments without code edits.
 */
export type CompensationRules = {
  directBonus: number;
  binaryBonus: number;
  roiMonthly: number;
  roiCap: number;
  minWithdraw: number;
  /** Seconds in one ROI accrual month (legacy system used 2_592_000 ≈ 30 days). */
  secondsPerRoiMonth: number;
};

const DEFAULT_RULES: CompensationRules = {
  directBonus: 0.11,
  binaryBonus: 0.11,
  roiMonthly: 0.11,
  roiCap: 2.5,
  minWithdraw: 50,
  secondsPerRoiMonth: 2_592_000,
};

function numEnv(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function loadCompensationRules(): CompensationRules {
  return {
    directBonus: numEnv('COMP_DIRECT_BONUS', DEFAULT_RULES.directBonus),
    binaryBonus: numEnv('COMP_BINARY_BONUS', DEFAULT_RULES.binaryBonus),
    roiMonthly: numEnv('COMP_ROI_MONTHLY', DEFAULT_RULES.roiMonthly),
    roiCap: numEnv('COMP_ROI_CAP', DEFAULT_RULES.roiCap),
    minWithdraw: numEnv('COMP_MIN_WITHDRAW', DEFAULT_RULES.minWithdraw),
    secondsPerRoiMonth: numEnv('COMP_SECONDS_PER_ROI_MONTH', DEFAULT_RULES.secondsPerRoiMonth),
  };
}

export const COMPENSATION_RULES_SNAPSHOT = DEFAULT_RULES;
