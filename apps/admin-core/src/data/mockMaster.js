import { normalizeUserAccess } from '../lib/userPermissions.js';

/** IDs de proyecto — todo el Admin Global se ancla aquí. */
export const PROJECT_IDS = {
  genesis: 'genesis',
  gpulse: 'gpulse',
  future: 'future_lab',
};

export const PROJECT_LIST = [
  { id: PROJECT_IDS.genesis, label: 'Genesis', code: 'GNS' },
  { id: PROJECT_IDS.gpulse, label: 'Gpulse', code: 'GPT' },
  { id: PROJECT_IDS.future, label: 'Future Lab', code: 'FLB' },
];

const DEMO_NETWORK = () => ({ leg: 'L', volumeLeft: 4200, volumeRight: 3800 });
const DEMO_REWARDS = () => ({ directPct: 11, binaryPct: 10, pendingPayout: 50 });
const DEMO_HISTORY = () => [
  { ts: '2026-03-28 10:00', action: 'account.created', detail: 'seed' },
  { ts: '2026-04-01 14:22', action: 'kyc.submitted', detail: 'tier1' },
];

/** Buckets vacíos garantizados para cada proyecto conocido. */
export function createEmptyBuckets() {
  const o = {};
  for (const id of Object.values(PROJECT_IDS)) {
    o[id] = [];
  }
  return o;
}

export function createEmptySecurityBuckets() {
  const o = {};
  for (const id of Object.values(PROJECT_IDS)) {
    o[id] = { blockedIps: [], securityLogs: [] };
  }
  return o;
}

/**
 * @template T
 * @param {T[]} items
 * @param {keyof T | 'project'} projectKey
 */
export function nestByProject(items, projectKey = 'project') {
  const buckets = createEmptyBuckets();
  for (const item of items) {
    const p = /** @type {string} */ (item[projectKey]);
    if (buckets[p]) {
      buckets[p].push(structuredClone(item));
    }
  }
  return buckets;
}

/** Valores por defecto del módulo P2P (mercado · escrow · comisiones). */
export const P2P_CONFIG_DEFAULTS = {
  escrowTimeoutMinutes: 45,
  disputeWindowHours: 72,
  takerFeeBps: 35,
  makerFeeBps: 15,
  minNotionalUsd: 25,
  maxOpenOrdersPerUser: 10,
  requireKycForSell: false,
};

/** Configuración anidada alineada con el admin legacy (globalConfig). */
export function createDefaultGlobalConfig(overrides = {}) {
  const base = {
    price: { basePrice: 23, minPrice: 22, maxPrice: 25 },
    order: { minOrderAmount: 50, maxOrderAmount: 500000 },
    p2p: { ...P2P_CONFIG_DEFAULTS },
    limits: {
      maxOrdersPerUser: 10,
      maxDailyOrders: 100,
      maxWeeklyOrders: 500,
      maxMonthlyOrders: 2000,
      maxOrderPerUser: 10,
    },
    volume: { maxBuyPerDay: 250000, maxSellPerDay: 250000, dailyCapUsd: 1000000 },
    rules: {
      p2pEnabled: true,
      rewardsEnabled: true,
      requireMiningToSell: false,
      requireProfile: true,
    },
    flags: {
      p2pEnabled: true,
      maintenance: false,
      marketPaused: false,
    },
    /** Umbrales monitoreo tesorería (alertas inteligentes) — editable en configuración global. */
    walletMonitoring: {
      enabled: true,
      highAmountUsd: 5000,
      highAmountAig: 30000,
      rapidActivityHours: 24,
      rapidActivityMinMoves: 3,
      userRejectedWithdrawalsMin: 2,
    },
  };
  const merged = JSON.parse(JSON.stringify(base));
  for (const [k, v] of Object.entries(overrides)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && merged[k] && typeof merged[k] === 'object') {
      merged[k] = { ...merged[k], ...v };
    } else {
      merged[k] = v;
    }
  }
  return merged;
}

export function getDefaultProjectConfig(project) {
  if (project === PROJECT_IDS.genesis) {
    return createDefaultGlobalConfig({
      price: { basePrice: 1, minPrice: 0.95, maxPrice: 1.05 },
      order: { minOrderAmount: 10, maxOrderAmount: 100000 },
    });
  }
  if (project === PROJECT_IDS.future) {
    return createDefaultGlobalConfig({
      price: { basePrice: 10, minPrice: 8, maxPrice: 12 },
      rules: { p2pEnabled: false, rewardsEnabled: false },
      flags: { p2pEnabled: false, marketPaused: true, maintenance: false },
    });
  }
  return createDefaultGlobalConfig({
    price: { basePrice: 23, minPrice: 22, maxPrice: 25 },
  });
}

const ALL_USERS_RAW = [
  {
    id: 'U-G-001',
    project: PROJECT_IDS.genesis,
    email: 'ceo@genesis.demo',
    username: 'genesis_root',
    wallet: '0xG111aaaabbbbccccddddeeeeffff0001',
    status: 'active',
    accountEnabled: true,
    referrerId: 'ROOT',
    balances: { usd: 240000, aig: 50000 },
    p2pBlocked: false,
    fundsFrozen: false,
    network: DEMO_NETWORK(),
    rewards: DEMO_REWARDS(),
    history: DEMO_HISTORY(),
  },
  {
    id: 'U-G-002',
    project: PROJECT_IDS.genesis,
    email: 'node@genesis.demo',
    username: 'genesis_node_a',
    wallet: '0xG222bbbccccddddeeeeffff00000002',
    status: 'active',
    accountEnabled: true,
    referrerId: 'U-G-001',
    balances: { usd: 8200, aig: 1200 },
    p2pBlocked: false,
    fundsFrozen: false,
    network: { leg: 'R', volumeLeft: 2100, volumeRight: 8900 },
    rewards: { directPct: 9, binaryPct: 8, pendingPayout: 12 },
    history: [{ ts: '2026-04-02 08:00', action: 'deposit', detail: '+5000 USDT' }],
  },
  {
    id: 'U-G-003',
    project: PROJECT_IDS.genesis,
    email: 'risk@genesis.demo',
    username: 'genesis_risk',
    wallet: '0xG333cccdddeeeeffff000000000003',
    status: 'blocked',
    accountEnabled: false,
    referrerId: 'U-G-001',
    balances: { usd: 0, aig: 0 },
    p2pBlocked: true,
    fundsFrozen: true,
    network: DEMO_NETWORK(),
    rewards: DEMO_REWARDS(),
    history: [{ ts: '2026-04-01 16:00', action: 'admin.block', detail: 'compliance' }],
  },
  {
    id: 'U-P-001',
    project: PROJECT_IDS.gpulse,
    email: 'alpha@gpulse.demo',
    username: 'gpulse_alpha',
    wallet: '0xP111aaaabbbbccccddddeeeeffff001',
    status: 'active',
    accountEnabled: true,
    referrerId: 'U-P-002',
    balances: { usd: 15200.5, aig: 8800 },
    p2pBlocked: false,
    fundsFrozen: false,
    network: DEMO_NETWORK(),
    rewards: DEMO_REWARDS(),
    history: DEMO_HISTORY(),
  },
  {
    id: 'U-P-002',
    project: PROJECT_IDS.gpulse,
    email: 'flow@gpulse.demo',
    username: 'gpulse_flow',
    wallet: '0xP222bbbccccddddeeeeffff000002',
    status: 'active',
    accountEnabled: true,
    referrerId: 'SPONSOR-ROOT',
    balances: { usd: 3100, aig: 2100 },
    p2pBlocked: false,
    fundsFrozen: false,
    network: { leg: 'L', volumeLeft: 500, volumeRight: 1200 },
    rewards: { directPct: 10, binaryPct: 10, pendingPayout: 0 },
    history: [],
  },
  {
    id: 'U-P-003',
    project: PROJECT_IDS.gpulse,
    email: 'hold@gpulse.demo',
    username: 'gpulse_hold',
    wallet: '0xP333cccdddeeeeffff00000000003',
    status: 'review',
    accountEnabled: true,
    referrerId: 'U-P-001',
    balances: { usd: 450, aig: 200 },
    p2pBlocked: false,
    fundsFrozen: false,
    network: DEMO_NETWORK(),
    rewards: DEMO_REWARDS(),
    history: [{ ts: '2026-04-02 11:00', action: 'flag.review', detail: 'velocity' }],
  },
  {
    id: 'U-F-001',
    project: PROJECT_IDS.future,
    email: 'pilot@future.demo',
    username: 'future_pilot',
    wallet: '0xF111aaaabbbbccccddddeeeeffff01',
    status: 'active',
    accountEnabled: true,
    referrerId: 'LAB',
    balances: { usd: 5000, aig: 1000 },
    p2pBlocked: false,
    fundsFrozen: false,
    network: DEMO_NETWORK(),
    rewards: { directPct: 5, binaryPct: 5, pendingPayout: 10 },
    history: [],
  },
  {
    id: 'U-F-002',
    project: PROJECT_IDS.future,
    email: 'lab@future.demo',
    username: 'future_lab_ops',
    wallet: '0xF222bbbccccddddeeeeffff000002',
    status: 'active',
    accountEnabled: true,
    referrerId: 'U-F-001',
    balances: { usd: 1200, aig: 400 },
    p2pBlocked: false,
    fundsFrozen: false,
    network: DEMO_NETWORK(),
    rewards: DEMO_REWARDS(),
    history: [],
  },
];

/** Roles demo — el resto hereda `member` normalizado en el mapa. */
const USER_ACCESS_OVERRIDES = {
  'U-G-001': { role: 'super_admin' },
  'U-G-002': { role: 'operator' },
  'U-G-003': { role: 'restricted' },
  'U-P-003': { role: 'viewer' },
};

export const ALL_USERS = ALL_USERS_RAW.map((u) => {
  const ov = USER_ACCESS_OVERRIDES[u.id];
  const { role, permissions } = normalizeUserAccess({
    role: ov?.role ?? u.role,
    permissions: u.permissions,
  });
  return { ...u, role, permissions };
});

/** Ledger tesorería — mismas filas que exponía `transactions` + campos tabla premium. */
export const ALL_WALLET_LEDGER = [
  {
    id: 'TX-G-100',
    project: PROJECT_IDS.genesis,
    userId: 'U-G-001',
    type: 'deposit',
    asset: 'USDT',
    amount: 10000,
    status: 'approved',
    createdAt: '2026-04-01T08:00:00Z',
  },
  {
    id: 'TX-G-101',
    project: PROJECT_IDS.genesis,
    userId: 'U-G-002',
    type: 'withdrawal',
    asset: 'USDT',
    amount: 1200,
    status: 'pending',
    createdAt: '2026-04-02T10:00:00Z',
  },
  {
    id: 'TX-P-200',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-001',
    type: 'withdrawal',
    asset: 'USDT',
    amount: 800,
    status: 'pending',
    createdAt: '2026-04-02T15:00:00Z',
  },
  {
    id: 'TX-P-201',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-002',
    type: 'bonus',
    asset: 'AIG',
    amount: 44,
    status: 'approved',
    createdAt: '2026-04-02T09:00:00Z',
  },
  {
    id: 'TX-P-202',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-003',
    type: 'adjustment',
    asset: 'USDT',
    amount: 50,
    status: 'pending',
    createdAt: '2026-04-02T11:45:00Z',
  },
  {
    id: 'TX-P-203',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-001',
    type: 'withdrawal',
    asset: 'USDT',
    amount: 6200,
    status: 'pending',
    createdAt: '2026-04-02T14:02:00Z',
  },
  {
    id: 'TX-P-204',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-001',
    type: 'withdrawal',
    asset: 'USDT',
    amount: 120,
    status: 'pending',
    createdAt: '2026-04-02T14:07:00Z',
  },
  {
    id: 'TX-P-205',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-001',
    type: 'deposit',
    asset: 'USDT',
    amount: 90,
    status: 'approved',
    createdAt: '2026-04-02T14:12:00Z',
  },
  {
    id: 'TX-P-206',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-003',
    type: 'withdrawal',
    asset: 'USDT',
    amount: 200,
    status: 'rejected',
    createdAt: '2026-04-01T09:00:00Z',
  },
  {
    id: 'TX-P-207',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-003',
    type: 'withdrawal',
    asset: 'USDT',
    amount: 180,
    status: 'rejected',
    createdAt: '2026-04-01T16:30:00Z',
  },
  {
    id: 'TX-P-208',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-003',
    type: 'withdrawal',
    asset: 'USDT',
    amount: 75,
    status: 'pending',
    createdAt: '2026-04-02T12:00:00Z',
  },
  {
    id: 'TX-F-300',
    project: PROJECT_IDS.future,
    userId: 'U-F-001',
    type: 'deposit',
    asset: 'USDT',
    amount: 2000,
    status: 'approved',
    createdAt: '2026-03-30T12:00:00Z',
  },
  {
    id: 'TX-F-301',
    project: PROJECT_IDS.future,
    userId: 'U-F-002',
    type: 'withdrawal',
    asset: 'USDT',
    amount: 150,
    status: 'pending',
    createdAt: '2026-04-02T09:15:00Z',
  },
];

export const ALL_ORDERS = [
  {
    id: 'O-G-5001',
    project: PROJECT_IDS.genesis,
    userId: 'U-G-002',
    side: 'buy',
    amount: 400,
    price: 1.02,
    status: 'open',
    createdAt: '2026-04-02T11:20:00Z',
  },
  {
    id: 'O-P-6001',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-001',
    side: 'sell',
    amount: 1200,
    price: 23.4,
    status: 'open',
    createdAt: '2026-04-02T12:05:00Z',
  },
  {
    id: 'O-P-6002',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-002',
    side: 'buy',
    amount: 300,
    price: 23.1,
    status: 'open',
    createdAt: '2026-04-02T13:00:00Z',
  },
  {
    id: 'O-P-6003',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-001',
    side: 'buy',
    amount: 50,
    price: 23.0,
    status: 'open',
    createdAt: '2026-04-02T14:00:00Z',
  },
  {
    id: 'O-P-6004',
    project: PROJECT_IDS.gpulse,
    userId: 'U-P-003',
    side: 'sell',
    amount: 200,
    price: 22.9,
    status: 'disputed',
    createdAt: '2026-04-02T10:00:00Z',
    disputedAt: '2026-04-02T16:20:00Z',
    disputeNote: 'Comprobante no coincide · revisión operador',
  },
  {
    id: 'O-F-7001',
    project: PROJECT_IDS.future,
    userId: 'U-F-001',
    side: 'buy',
    amount: 100,
    price: 10,
    status: 'filled',
    createdAt: '2026-04-01T09:00:00Z',
  },
];

function buildConfigByProject() {
  const o = {};
  for (const id of Object.values(PROJECT_IDS)) {
    o[id] = getDefaultProjectConfig(id);
  }
  o[PROJECT_IDS.genesis].flags.marketPaused = false;
  o[PROJECT_IDS.gpulse].flags.marketPaused = false;
  o[PROJECT_IDS.future].flags.marketPaused = true;
  return o;
}

const SEED_LEGACY = [
  { id: 'L-1', project: PROJECT_IDS.genesis, actor: 'operator', action: 'config.save', ts: '2026-04-02 10:00', risk: 'low' },
  { id: 'L-2', project: PROJECT_IDS.gpulse, actor: 'operator', action: 'user.block', ts: '2026-04-02 09:12', risk: 'medium' },
  { id: 'L-3', project: PROJECT_IDS.gpulse, actor: 'system', action: 'ledger.snapshot', ts: '2026-04-02 08:30', risk: 'info' },
  { id: 'L-4', project: PROJECT_IDS.future, actor: 'operator', action: 'p2p.pause', ts: '2026-04-01 18:00', risk: 'high' },
];

/** Normaliza logs de auditoría (enterprise). */
function seedAuditLogs() {
  const now = Date.now();
  return SEED_LEGACY.map((l, i) => ({
    id: l.id,
    action: l.action,
    project: l.project,
    admin: l.actor === 'system' ? 'system@aigenesis.internal' : 'operator@aigenesis.internal',
    targetId: null,
    meta: { risk: l.risk, label: l.ts, seed: true },
    timestamp: now - (SEED_LEGACY.length - i) * 120000,
  }));
}

function seedSecurityByProject() {
  const base = createEmptySecurityBuckets();
  base[PROJECT_IDS.gpulse].blockedIps = ['10.0.0.99'];
  base[PROJECT_IDS.gpulse].securityLogs = [
    { id: 'SEC-P-1', actor: 'operator', action: 'ip.block', ts: '2026-04-02 07:00' },
    { id: 'SEC-P-2', actor: 'system', action: 'session.revoke', ts: '2026-04-02 06:30' },
  ];
  return base;
}

export function buildInitialState() {
  return {
    currentProject: PROJECT_IDS.gpulse,
    usersByProject: nestByProject(ALL_USERS),
    walletLedgerByProject: nestByProject(ALL_WALLET_LEDGER),
    ordersByProject: nestByProject(ALL_ORDERS),
    configByProject: buildConfigByProject(),
    rewardsByProject: {
      [PROJECT_IDS.genesis]: { poolUsd: 120000, distributedToday: 4200 },
      [PROJECT_IDS.gpulse]: { poolUsd: 89000, distributedToday: 9100 },
      [PROJECT_IDS.future]: { poolUsd: 5000, distributedToday: 120 },
    },
    rewardSystemByProject: {
      [PROJECT_IDS.genesis]: true,
      [PROJECT_IDS.gpulse]: true,
      [PROJECT_IDS.future]: false,
    },
    securityByProject: seedSecurityByProject(),
    logs: seedAuditLogs(),
    ui: {
      toast: null,
      loading: false,
      loadingByKey: {},
      isSwitchingProject: false,
    },
  };
}
