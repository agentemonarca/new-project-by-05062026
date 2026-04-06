/**
 * Almacén en memoria — producción debe usar MongoGenesisStore con los mismos métodos.
 * Thread-safe enough para un solo proceso Node.
 */

const PROJECT_DEFAULT = 'genesis';

function now() {
  return Date.now();
}

function id(prefix) {
  return `${prefix}-${now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function round8(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 1e8) / 1e8;
}

/** @typedef {{ usd: number, aig: number }} Balances */
/** @typedef {{ direct: number, binary: number, mining: number }} RewardsPending */

export class MemoryGenesisStore {
  constructor() {
    /** @type {Map<string, object>} */
    this.users = new Map();
    /** @type {Map<string, object>} */
    this.orders = new Map();
    /** @type {Array<object>} */
    this.ledger = [];
    /** @type {Array<object>} */
    this.rewardsLedger = [];
    /** @type {Map<string, object>} */
    this.projectConfig = new Map();
    /** @type {Map<string, { transactionId: string, type: string, amount: number }>} */
    this._rewardBonusIdem = new Map();
    /** @type {Map<string, object>} */
    this._rewardClaimIdem = new Map();
    this._seedDefaults();
  }

  /**
   * Paridad con MongoGenesisStore: sin transacción, ejecuta fn(null).
   * @param {(session: null) => Promise<unknown>} fn
   */
  async runMongoTransaction(fn) {
    return fn(null);
  }

  async listAllUserIds() {
    return [...this.users.keys()];
  }

  /**
   * @param {{ userId?: string | null, limit?: number, sinceTs?: number }} [opts]
   */
  async exportLedgerEntries({ userId = null, limit = 50_000, sinceTs = 0 } = {}) {
    const lim = Math.max(1, Math.min(100_000, Number(limit) || 50_000));
    let rows = this.ledger.slice();
    const uid = userId ? String(userId).toLowerCase() : null;
    if (uid) rows = rows.filter((e) => e.userId === uid);
    if (sinceTs > 0) rows = rows.filter((e) => (Number(e.ts) || 0) >= sinceTs);
    rows.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
    return rows.slice(0, lim).map((e) => ({
      id: e.id,
      userId: e.userId,
      ts: e.ts,
      direction: e.direction,
      category: e.category,
      amount: e.amount,
      currency: e.currency,
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      metadata: e.metadata || {},
    }));
  }

  _seedDefaults() {
    this.projectConfig.set(PROJECT_DEFAULT, {
      projectId: PROJECT_DEFAULT,
      price: { basePrice: 23, minPrice: 22, maxPrice: 25 },
      p2pFeeBps: 35,
      minOrderUsd: 10,
      maxOrderUsd: 1_000_000,
      marketPaused: false,
    });
  }

  /** @param {unknown} [_session] ignorado */
  async ensureUser(address, _session = null) {
    const key = String(address).toLowerCase();
    if (!this.users.has(key)) {
      this.users.set(key, {
        address: key,
        projectId: PROJECT_DEFAULT,
        balances: { usd: 0, aig: 0 },
        frozen: { usd: 0, aig: 0 },
        rewardsPending: { direct: 0, binary: 0, mining: 0 },
        rewardsPendingUsd: 0,
        rewardsClaimedUsd: 0,
        network: { leftMonth: 0, rightMonth: 0 },
        role: 'member',
        permissions: null,
        miningActive: false,
        updatedAt: now(),
      });
    }
    const u = this.users.get(key);
    if (u.miningActive === undefined) u.miningActive = false;
    if (u.rewardsPendingUsd === undefined) u.rewardsPendingUsd = 0;
    if (u.rewardsClaimedUsd === undefined) u.rewardsClaimedUsd = 0;
    return u;
  }

  /** @param {unknown} [_session] ignorado */
  async getUser(address, _session = null) {
    const key = String(address).toLowerCase();
    return this.users.get(key) || null;
  }

  /** @param {unknown} [_session] ignorado */
  async updateUser(address, patch, _session = null) {
    const u = await this.ensureUser(address);
    const p = patch && typeof patch === 'object' ? patch : {};
    if (p.balances && typeof p.balances === 'object') {
      u.balances = { ...u.balances, ...p.balances };
    }
    if (p.frozen && typeof p.frozen === 'object') {
      u.frozen = { ...u.frozen, ...p.frozen };
    }
    if (p.rewardsPending && typeof p.rewardsPending === 'object') {
      u.rewardsPending = { ...u.rewardsPending, ...p.rewardsPending };
    }
    if (p.rewardsPendingUsd !== undefined) u.rewardsPendingUsd = round8(p.rewardsPendingUsd);
    if (p.rewardsClaimedUsd !== undefined) u.rewardsClaimedUsd = round8(p.rewardsClaimedUsd);
    if (p.network && typeof p.network === 'object') {
      u.network = { ...u.network, ...p.network };
    }
    for (const k of ['role', 'permissions', 'miningActive', 'projectId']) {
      if (p[k] !== undefined) u[k] = p[k];
    }
    u.updatedAt = now();
    return u;
  }

  async setBalances(address, balances) {
    const u = await this.ensureUser(address);
    u.balances = { ...u.balances, ...balances };
    u.updatedAt = now();
    return u;
  }

  /** @param {unknown} [_session] ignorado */
  async adjustFrozen(address, deltaUsd = 0, deltaAig = 0, _session = null) {
    const u = await this.ensureUser(address);
    u.frozen.usd = Math.max(0, u.frozen.usd + deltaUsd);
    u.frozen.aig = Math.max(0, u.frozen.aig + deltaAig);
    u.updatedAt = now();
    return u;
  }

  /**
   * @param {string} address
   * @param {object} row
   */
  /** @param {unknown} [_session] ignorado */
  async appendLedger(address, row, _session = null) {
    const entry = {
      id: row.id || id('LED'),
      userId: String(address).toLowerCase(),
      ts: row.ts || now(),
      ...row,
    };
    this.ledger.push(entry);
    return entry;
  }

  async listLedger(address, limit = 100) {
    const key = String(address).toLowerCase();
    return this.ledger
      .filter((e) => e.userId === key)
      .slice(-limit)
      .reverse();
  }

  /**
   * @param {string} userId
   * @param {'direct' | 'binary'} type
   * @param {number} amountNumber
   * @param {string | null | undefined} [idempotencyKey]
   * @returns {Promise<{ transactionId: string, idempotentReplay?: boolean }>}
   */
  async grantRewardsBonus(userId, type, amountNumber, idempotencyKey = null) {
    const key = String(userId).toLowerCase();
    const u = await this.ensureUser(key);
    const amt = round8(amountNumber);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw Object.assign(new Error('invalid_reward_amount'), { code: 'invalid_reward_amount' });
    }
    if (type !== 'direct' && type !== 'binary') {
      throw Object.assign(new Error('invalid_reward_type'), { code: 'invalid_reward_type' });
    }
    const idem = idempotencyKey ? String(idempotencyKey).trim() : '';
    const idemSlot = idem ? `${key}:${idem}` : '';
    if (idem) {
      const prev = this._rewardBonusIdem.get(idemSlot);
      if (prev) {
        if (prev.type !== type || round8(prev.amount) !== amt) {
          throw Object.assign(new Error('idempotency_conflict'), { code: 'idempotency_conflict' });
        }
        return { transactionId: prev.transactionId, idempotentReplay: true };
      }
    }

    const txId = id('RW');
    const t = now();
    this.rewardsLedger.push({
      id: txId,
      userId: key,
      type,
      amount: amt,
      status: 'pending',
      createdAt: t,
      claimedAt: null,
      ...(idem ? { idempotencyKey: idem } : {}),
    });
    u.rewardsPendingUsd = round8((u.rewardsPendingUsd || 0) + amt);
    if (type === 'direct') u.rewardsPending.direct = round8(u.rewardsPending.direct + amt);
    else u.rewardsPending.binary = round8(u.rewardsPending.binary + amt);
    u.updatedAt = t;
    if (idem) this._rewardBonusIdem.set(idemSlot, { transactionId: txId, type, amount: amt });
    return { transactionId: txId, idempotentReplay: false };
  }

  /**
   * @returns {Promise<{ ok: true, amount: number } | { ok: false, error: string }>}
   */
  /** @param {unknown} [_session] ignorado */
  async claimRewardsPendingUsd(address, _session = null) {
    const key = String(address).toLowerCase();
    const u = await this.ensureUser(key);
    const pending = round8(u.rewardsPendingUsd || 0);
    if (pending <= 0) {
      return { ok: false, error: 'nothing_to_claim' };
    }
    u.balances.usd = round8(u.balances.usd + pending);
    u.rewardsClaimedUsd = round8((u.rewardsClaimedUsd || 0) + pending);
    u.rewardsPendingUsd = 0;
    u.rewardsPending.direct = 0;
    u.rewardsPending.binary = 0;
    const ts = now();
    u.updatedAt = ts;
    for (const row of this.rewardsLedger) {
      if (row.userId === key && row.status === 'pending' && (row.type === 'direct' || row.type === 'binary')) {
        row.status = 'claimed';
        row.claimedAt = ts;
      }
    }
    return { ok: true, amount: pending };
  }

  /**
   * @param {string} address
   * @param {number} limit
   */
  async listRewardsTransactions(address, limit = 100) {
    const key = String(address).toLowerCase();
    const lim = Math.max(1, Math.min(500, limit));
    return this.rewardsLedger
      .filter((r) => r.userId === key)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, lim)
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        type: r.type,
        amount: r.amount,
        status: r.status,
        createdAt: r.createdAt,
        claimedAt: r.claimedAt ?? null,
        idempotencyKey: r.idempotencyKey ?? null,
      }));
  }

  /**
   * @param {string} userId
   * @param {string} clientKey
   */
  async getRewardClaimIdempotency(userId, clientKey) {
    const k = `${String(userId).toLowerCase()}:${String(clientKey).trim()}`;
    const v = this._rewardClaimIdem.get(k);
    return v && typeof v === 'object' ? v : null;
  }

  /**
   * @param {string} userId
   * @param {string} clientKey
   * @param {object} response
   */
  async setRewardClaimIdempotency(userId, clientKey, response) {
    const k = `${String(userId).toLowerCase()}:${String(clientKey).trim()}`;
    if (this._rewardClaimIdem.has(k)) {
      return { stored: false, existingResponse: this._rewardClaimIdem.get(k) };
    }
    this._rewardClaimIdem.set(k, response);
    return { stored: true };
  }

  /** @param {number} limit */
  async tailLedger(limit) {
    return this.ledger.slice(-Math.max(1, limit));
  }

  async getOrder(orderId) {
    return this.orders.get(orderId) || null;
  }

  /** @param {unknown} [_session] ignorado */
  async saveOrder(order, _session = null) {
    this.orders.set(order.id, { ...order, updatedAt: now() });
    return order;
  }

  async deleteOrder(orderId) {
    this.orders.delete(orderId);
  }

  async listOrdersForProject(projectId, { status, side } = {}) {
    const out = [];
    for (const o of this.orders.values()) {
      if (o.projectId !== projectId) continue;
      if (status && o.status !== status) continue;
      if (side && o.side !== side) continue;
      out.push(o);
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }

  async listOpenOrdersBook(projectId, side) {
    const out = [];
    for (const o of this.orders.values()) {
      if (o.projectId !== projectId || o.side !== side) continue;
      if (!['open', 'partial'].includes(o.status)) continue;
      out.push(o);
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }

  async getProjectConfig(projectId) {
    return this.projectConfig.get(projectId) || this.projectConfig.get(PROJECT_DEFAULT);
  }

  async setProjectConfig(projectId, patch) {
    const prev = (await this.getProjectConfig(projectId)) || {};
    const next = { ...prev, ...patch, projectId };
    this.projectConfig.set(projectId, next);
    return next;
  }
}
