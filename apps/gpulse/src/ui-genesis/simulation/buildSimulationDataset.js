import { normalizeLedgerEvents } from '../ledger/normalize.js';
import { getAigPrice } from '../../utils/pricing.js';
import { ROLE_PRESETS } from '../lib/userPermissions.js';
import {
  createDeterministic01,
  fallbackDeterministicTxHex,
  isGpulseRealProviderExecution,
} from '../../utils/gpulseRngPolicy.js';

/** Base spec — binary volumes (points). */
const BINARY_LEFT = 10000;
const BINARY_RIGHT = 8000;

/** Wallet (USDT / AIG balance display). */
const WALLET_USD = 5200;
const WALLET_CLAIM = 340;
const WALLET_AIG = 12400;

/**
 * @param {number} n
 * @param {number} amplitude  e.g. 0.04 → ±2% typical swing
 */
export function simulationJitter(n, amplitude = 0.035) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  const t = isGpulseRealProviderExecution()
    ? createDeterministic01((Math.floor(x * 1000) ^ 0xabc) >>> 0)() * 2 - 1
    : Math.random() * 2 - 1;
  return x * (1 + t * amplitude);
}

/**
 * @param {number} amplitude
 * @returns {{
 *   wallet: Record<string, unknown>,
 *   network: { leftMonth: number, rightMonth: number, _simulation?: boolean },
 *   aigBalance: number,
 *   binaryMatch: number,
 *   binaryPending: number,
 *   stakingTotalUsdt: number,
 *   stakingDailyUsdt: number,
 *   ledgerRaw: Array<Record<string, unknown>>,
 * }}
 */
export function buildFullSimulationDataset(amplitude = 0.035) {
  const left = Math.round(simulationJitter(BINARY_LEFT, amplitude));
  const right = Math.round(simulationJitter(BINARY_RIGHT, amplitude));
  const match = Math.min(left, right);
  const pending = Math.max(0, Math.abs(left - right));

  const ledgerNet = Math.round(simulationJitter(WALLET_USD, amplitude) * 100) / 100;
  const directClaim = Math.round(simulationJitter(WALLET_CLAIM, amplitude) * 100) / 100;
  const aigBalance = Math.round(simulationJitter(WALLET_AIG, amplitude));

  const wallet = {
    _simulation: true,
    depositBalanceWei: '0',
    directClaimableUsdt: directClaim,
    ledgerNetUsdt: ledgerNet,
    sourceOfTruth: 'simulation',
    byCategory: {},
    /** Permisos demo en modo simulación (viewer: sin P2P ni acciones). */
    role: 'viewer',
    permissions: { ...ROLE_PRESETS.viewer },
  };

  const network = {
    leftMonth: left,
    rightMonth: right,
    _simulation: true,
  };

  const now = Date.now();
  let txSeq = 0;
  const tx = () =>
    `0x${
      isGpulseRealProviderExecution()
        ? fallbackDeterministicTxHex((now + txSeq++) >>> 0)
        : Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    }`;

  /** Direct bonus ladder (interpreted as USDT rows for stress-friendly UI). */
  const directAmounts = [
    simulationJitter(440, amplitude * 1.2),
    simulationJitter(110, amplitude * 1.2),
    simulationJitter(20, amplitude * 1.2),
  ];

  const ledgerRaw = [
    {
      id: `sim-net-${now}`,
      ts: now - 1800000,
      category: 'network',
      kind: 'BINARY_MATCH',
      title: 'Binary match earnings',
      summary: `Match ~${Math.round(match)} pts · pend. ~${Math.round(pending)} · variación sim`,
      amountUsdt: Math.round(simulationJitter(127.5, amplitude) * 100) / 100,
      txHash: tx(),
    },
    {
      id: `sim-net-2-${now}`,
      ts: now - 86400000 * 2,
      category: 'network',
      kind: 'BINARY_FLASH',
      title: 'Binary flash accrual',
      summary: 'Ciclo mensual · vista simulada',
      amountUsdt: Math.round(simulationJitter(58.2, amplitude) * 100) / 100,
      txHash: tx(),
    },
    ...directAmounts.map((amt, i) => ({
      id: `sim-direct-${i}-${now}`,
      ts: now - 3600000 * (4 + i * 3),
      category: 'overview',
      kind: 'DIRECT_BONUS',
      title: `Direct bonus · tramo ${i + 1}`,
      summary: 'Bono directo acumulado (sim)',
      amountUsdt: Math.round(amt * 100) / 100,
      txHash: tx(),
    })),
    {
      id: `sim-stake-${now}`,
      ts: now - 7200000,
      category: 'staking',
      kind: 'STAKING_REWARD',
      title: 'Staking rewards',
      summary: 'Recompensa diaria — motor sim',
      amountUsdt: Math.round(simulationJitter(45, amplitude) * 100) / 100,
      amountAig: (() => {
        const rewardUSD = 10;
        const rewardAIG = rewardUSD / getAigPrice();
        return Math.round(rewardAIG * 100) / 100;
      })(),
      txHash: tx(),
    },
    {
      id: `sim-stake-2-${now}`,
      ts: now - 86400000 * 5,
      category: 'staking',
      kind: 'STAKING_LOCK',
      title: 'Staking · posición activa',
      summary: `Total sim ~${Math.round(simulationJitter(12000, amplitude))} USDT`,
      amountUsdt: Math.round(simulationJitter(12000, amplitude * 0.5) * 100) / 100,
    },
    {
      id: `sim-with-${now}`,
      ts: now - 86400000 * 7,
      category: 'transaction',
      kind: 'WITHDRAWAL',
      title: 'Withdrawal',
      summary: 'Retiro USDT (sim)',
      amountUsdt: -Math.round(simulationJitter(250, amplitude) * 100) / 100,
      txHash: tx(),
    },
    {
      id: `sim-mine-${now}`,
      ts: now - 3600000 * 8,
      category: 'mining',
      kind: 'MINING_CLAIM',
      title: 'Mining rewards',
      summary: 'Claim minería (sim)',
      amountAig: (() => {
        /** USD notional for mining claim sim; AIG amount follows live `getAigPrice()`. */
        const miningRewardUsd = simulationJitter(4230, amplitude);
        return Math.round((miningRewardUsd / getAigPrice()) * 100) / 100;
      })(),
      txHash: tx(),
    },
  ];

  return {
    wallet,
    network,
    aigBalance,
    binaryMatch: match,
    binaryPending: pending,
    stakingTotalUsdt: Math.round(simulationJitter(12000, amplitude * 0.5)),
    stakingDailyUsdt: Math.round(simulationJitter(45, amplitude) * 100) / 100,
    ledgerRaw,
  };
}

/**
 * @param {number} [amplitude]
 * @returns {import('../ledger/ledgerModel.js').LedgerEvent[]}
 */
export function buildSimulationLedgerEvents(amplitude = 0.035) {
  const { ledgerRaw } = buildFullSimulationDataset(amplitude);
  return normalizeLedgerEvents(ledgerRaw);
}
