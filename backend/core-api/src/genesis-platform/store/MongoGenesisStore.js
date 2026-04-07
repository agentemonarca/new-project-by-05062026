/**
 * Capa de persistencia MongoDB para Genesis + P2P — paridad con MemoryGenesisStore.
 */

import { getOrCreateModels } from '../db/p2pSchemas.js';

function now() {
  return Date.now();
}

function lid(prefix) {
  return `${prefix}-${now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function round8(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 1e8) / 1e8;
}

function defaultProjectDoc(projectId) {
  return {
    projectId,
    price: { basePrice: 23, minPrice: 22, maxPrice: 25 },
    p2pFeeBps: 35,
    minOrderUsd: 10,
    maxOrderUsd: 1_000_000,
    marketPaused: false,
  };
}

function userToApi(doc) {
  if (!doc) return null;
  return {
    address: doc.address,
    projectId: doc.projectId || 'genesis',
    balances: { usd: Number(doc.balances?.usd) || 0, aig: Number(doc.balances?.aig) || 0 },
    frozen: { usd: Number(doc.frozen?.usd) || 0, aig: Number(doc.frozen?.aig) || 0 },
    rewardsPending: {
      direct: Number(doc.rewardsPending?.direct) || 0,
      binary: Number(doc.rewardsPending?.binary) || 0,
      mining: Number(doc.rewardsPending?.mining) || 0,
    },
    rewardsPendingUsd: round8(doc.rewardsPendingUsd ?? 0),
    rewardsClaimedUsd: round8(doc.rewardsClaimedUsd ?? 0),
    network: {
      leftMonth: Number(doc.network?.leftMonth) || 0,
      rightMonth: Number(doc.network?.rightMonth) || 0,
    },
    miningActive: Boolean(doc.miningActive),
    role: doc.role || 'member',
    permissions: doc.permissions ?? null,
    updatedAt: doc.updatedAt || now(),
  };
}

function orderToApi(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    projectId: doc.projectId,
    userId: doc.userId,
    side: doc.side,
    amount: doc.amount,
    amountOriginal: doc.amountOriginal,
    amountRemaining: doc.amountRemaining,
    price: doc.price,
    status: doc.status,
    escrowUsd: doc.escrowUsd ?? 0,
    escrowAig: doc.escrowAig ?? 0,
    counterpartyId: doc.counterpartyId ?? null,
    meta: doc.meta && typeof doc.meta === 'object' ? doc.meta : {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoGenesisStore {
  /**
   * @param {object} [logger]
   * @param {import('mongoose').Connection} conn genesis pool (`getDbConnection('genesis')`)
   */
  constructor(logger, conn) {
    this.logger = logger;
    this._conn = conn;
    const m = getOrCreateModels(conn);
    this.GenesisUser = m.GenesisUser;
    this.P2pOrder = m.P2pOrder;
    this.P2pTransaction = m.P2pTransaction;
    this.RewardsTransaction = m.RewardsTransaction;
    this.GenesisIdempotency = m.GenesisIdempotency;
    this.GenesisProjectConfig = m.GenesisProjectConfig;
  }

  /**
   * Ejecuta fn(session|null) en transacción multi-documento cuando el cluster lo permite.
   * Si falla (standalone / sin réplicas) o GENESIS_DISABLE_MONGO_TRANSACTIONS=1, ejecuta fn(null).
   * @param {(session: import('mongoose').ClientSession | null) => Promise<unknown>} fn
   */
  async runMongoTransaction(fn) {
    if (String(process.env.GENESIS_DISABLE_MONGO_TRANSACTIONS || '').trim() === '1') {
      return fn(null);
    }
    const session = await this._conn.startSession();
    try {
      let out;
      await session.withTransaction(async (s) => {
        out = await fn(s);
      });
      return out;
    } catch (e) {
      const msg = String(e?.message || e || '');
      if (
        /required a replica set|Transaction numbers|Transactions are not supported|not supported.*transaction/i.test(
          msg,
        )
      ) {
        this.logger?.warn?.('mongo_transaction_fallback', { message: msg });
        return fn(null);
      }
      throw e;
    } finally {
      await session.endSession();
    }
  }

  /** @returns {Promise<string[]>} */
  async listAllUserIds() {
    const rows = await this.GenesisUser.distinct('address');
    return rows.map((a) => String(a).toLowerCase());
  }

  /**
   * Export masivo de p2p_transactions (ledger operativo).
   * @param {{ userId?: string | null, limit?: number, sinceTs?: number }} [opts]
   */
  async exportLedgerEntries({ userId = null, limit = 50_000, sinceTs = 0 } = {}) {
    const lim = Math.max(1, Math.min(100_000, Number(limit) || 50_000));
    /** @type {Record<string, unknown>} */
    const q = {};
    if (userId) q.userId = String(userId).toLowerCase();
    if (sinceTs > 0) q.ts = { $gte: sinceTs };
    const rows = await this.P2pTransaction.find(q).sort({ ts: -1 }).limit(lim).lean();
    return rows.map((e) => ({
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

  async _ensureProjectConfig(projectId) {
    const pid = String(projectId || 'genesis').trim() || 'genesis';
    let doc = await this.GenesisProjectConfig.findOne({ projectId: pid }).lean();
    if (!doc) {
      try {
        await this.GenesisProjectConfig.create(defaultProjectDoc(pid));
      } catch (e) {
        if (e?.code !== 11000) throw e;
      }
      doc = await this.GenesisProjectConfig.findOne({ projectId: pid }).lean();
    }
    return doc;
  }

  /**
   * @param {string} address
   * @param {import('mongoose').ClientSession | null} [session]
   */
  async ensureUser(address, session = null) {
    const key = String(address).toLowerCase();
    const t = now();
    let q = this.GenesisUser.findOneAndUpdate(
      { address: key },
      {
        $setOnInsert: {
          address: key,
          projectId: 'genesis',
          balances: { usd: 0, aig: 0 },
          frozen: { usd: 0, aig: 0 },
          rewardsPending: { direct: 0, binary: 0, mining: 0 },
          rewardsPendingUsd: 0,
          rewardsClaimedUsd: 0,
          network: { leftMonth: 0, rightMonth: 0 },
          miningActive: false,
          role: 'member',
          permissions: null,
          updatedAt: t,
        },
      },
      { upsert: true, new: true },
    );
    if (session) q = q.session(session);
    await q.lean();
    return this.getUser(key, session);
  }

  /**
   * @param {string} address
   * @param {import('mongoose').ClientSession | null} [session]
   */
  async getUser(address, session = null) {
    const key = String(address).toLowerCase();
    let q = this.GenesisUser.findOne({ address: key });
    if (session) q = q.session(session);
    const u = await q.lean();
    return userToApi(u);
  }

  /**
   * @param {string} address
   * @param {object} patch
   * @param {import('mongoose').ClientSession | null} [session]
   */
  async updateUser(address, patch, session = null) {
    const key = String(address).toLowerCase();
    await this.ensureUser(key, session);
    let q = this.GenesisUser.findOne({ address: key });
    if (session) q = q.session(session);
    const cur = await q.lean();
    const u = userToApi(cur);
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
    let upd = this.GenesisUser.updateOne(
      { address: key },
      {
        $set: {
          balances: u.balances,
          frozen: u.frozen,
          rewardsPending: u.rewardsPending,
          rewardsPendingUsd: u.rewardsPendingUsd,
          rewardsClaimedUsd: u.rewardsClaimedUsd,
          network: u.network,
          role: u.role,
          permissions: u.permissions,
          miningActive: u.miningActive,
          projectId: u.projectId,
          updatedAt: u.updatedAt,
        },
      },
    );
    if (session) upd = upd.session(session);
    await upd;
    return u;
  }

  async setBalances(address, balances) {
    const key = String(address).toLowerCase();
    await this.ensureUser(key);
    const u = await this.GenesisUser.findOneAndUpdate(
      { address: key },
      {
        $set: {
          balances: {
            usd: Number(balances.usd) || 0,
            aig: Number(balances.aig) || 0,
          },
          updatedAt: now(),
        },
      },
      { new: true },
    ).lean();
    return userToApi(u);
  }

  /**
   * @param {import('mongoose').ClientSession | null} [session]
   */
  async adjustFrozen(address, deltaUsd = 0, deltaAig = 0, session = null) {
    const key = String(address).toLowerCase();
    await this.ensureUser(key, session);
    let q0 = this.GenesisUser.findOne({ address: key });
    if (session) q0 = q0.session(session);
    const u0 = await q0.lean();
    const frozen = {
      usd: Math.max(0, (u0?.frozen?.usd || 0) + deltaUsd),
      aig: Math.max(0, (u0?.frozen?.aig || 0) + deltaAig),
    };
    let qu = this.GenesisUser.findOneAndUpdate(
      { address: key },
      { $set: { frozen, updatedAt: now() } },
      { new: true },
    );
    if (session) qu = qu.session(session);
    const u = await qu.lean();
    return userToApi(u);
  }

  /**
   * @param {import('mongoose').ClientSession | null} [session]
   */
  async appendLedger(address, row, session = null) {
    const entry = {
      id: row.id || lid('LED'),
      userId: String(address).toLowerCase(),
      ts: row.ts || now(),
      direction: row.direction || 'CREDIT',
      category: row.category || row.type || 'misc',
      amount: Number(row.amount) || 0,
      currency: row.currency || 'USDT',
      referenceType: row.referenceType || 'p2p',
      referenceId: String(row.referenceId || row.id || ''),
      metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    };
    if (session) await this.P2pTransaction.create([entry], { session });
    else await this.P2pTransaction.create(entry);
    return entry;
  }

  async listLedger(address, limit = 100) {
    const key = String(address).toLowerCase();
    const lim = Math.max(1, Math.min(1000, limit));
    const rows = await this.P2pTransaction.find({ userId: key }).sort({ ts: -1 }).limit(lim).lean();
    return rows.map((e) => ({
      id: e.id,
      userId: e.userId,
      ts: e.ts,
      direction: e.direction,
      category: e.category,
      type: e.category,
      amount: e.amount,
      currency: e.currency,
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      metadata: e.metadata || {},
    }));
  }

  async tailLedger(limit) {
    const lim = Math.max(1, Math.min(10_000, limit));
    const rows = await this.P2pTransaction.find({}).sort({ ts: -1 }).limit(lim).lean();
    return rows.reverse();
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
    await this.ensureUser(key);
    const amt = round8(amountNumber);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw Object.assign(new Error('invalid_reward_amount'), { code: 'invalid_reward_amount' });
    }
    if (type !== 'direct' && type !== 'binary') {
      throw Object.assign(new Error('invalid_reward_type'), { code: 'invalid_reward_type' });
    }

    const idem = idempotencyKey ? String(idempotencyKey).trim() : '';
    if (idem) {
      const prior = await this.RewardsTransaction.findOne({ userId: key, idempotencyKey: idem }).lean();
      if (prior) {
        if (prior.type !== type || round8(prior.amount) !== amt) {
          throw Object.assign(new Error('idempotency_conflict'), { code: 'idempotency_conflict' });
        }
        return { transactionId: prior.id, idempotentReplay: true };
      }
    }

    const txId = lid('RW');
    const t = now();
    const inc = { rewardsPendingUsd: amt };
    if (type === 'direct') inc['rewardsPending.direct'] = amt;
    else inc['rewardsPending.binary'] = amt;

    try {
      await this.RewardsTransaction.create({
        id: txId,
        userId: key,
        type,
        amount: amt,
        status: 'pending',
        createdAt: t,
        claimedAt: null,
        ...(idem ? { idempotencyKey: idem } : {}),
      });
    } catch (e) {
      if (e?.code === 11000 && idem) {
        const dup = await this.RewardsTransaction.findOne({ userId: key, idempotencyKey: idem }).lean();
        if (dup) {
          if (dup.type !== type || round8(dup.amount) !== amt) {
            throw Object.assign(new Error('idempotency_conflict'), { code: 'idempotency_conflict' });
          }
          return { transactionId: dup.id, idempotentReplay: true };
        }
      }
      throw e;
    }
    try {
      await this.GenesisUser.updateOne({ address: key }, { $inc: inc, $set: { updatedAt: t } });
    } catch (e) {
      await this.RewardsTransaction.deleteOne({ id: txId }).catch(() => {});
      throw e;
    }
    return { transactionId: txId, idempotentReplay: false };
  }

  /**
   * Mueve rewardsPendingUsd → balances.usd; deja mining pending intacto.
   * @returns {Promise<{ ok: true, amount: number } | { ok: false, error: string }>}
   */
  /**
   * @param {import('mongoose').ClientSession | null} [session]
   */
  async claimRewardsPendingUsd(address, session = null) {
    const key = String(address).toLowerCase();
    await this.ensureUser(key, session);

    const claimPipeline = [
      {
        $set: {
          balances: {
            usd: {
              $add: [
                { $toDouble: { $ifNull: ['$balances.usd', 0] } },
                { $toDouble: { $ifNull: ['$rewardsPendingUsd', 0] } },
              ],
            },
            aig: { $toDouble: { $ifNull: ['$balances.aig', 0] } },
          },
          rewardsClaimedUsd: {
            $add: [
              { $toDouble: { $ifNull: ['$rewardsClaimedUsd', 0] } },
              { $toDouble: { $ifNull: ['$rewardsPendingUsd', 0] } },
            ],
          },
          rewardsPendingUsd: 0,
          rewardsPending: {
            direct: 0,
            binary: 0,
            mining: { $toDouble: { $ifNull: ['$rewardsPending.mining', 0] } },
          },
          updatedAt: now(),
        },
      },
    ];

    let fq = this.GenesisUser.findOneAndUpdate(
      { address: key, rewardsPendingUsd: { $gt: 0 } },
      claimPipeline,
      { new: false },
    );
    if (session) fq = fq.session(session);
    const old = await fq.lean();

    if (!old) {
      return { ok: false, error: 'nothing_to_claim' };
    }

    const claimed = round8(Number(old.rewardsPendingUsd) || 0);
    if (claimed <= 0) {
      return { ok: false, error: 'nothing_to_claim' };
    }

    const ts = now();
    let um = this.RewardsTransaction.updateMany(
      { userId: key, status: 'pending', type: { $in: ['direct', 'binary'] } },
      { $set: { status: 'claimed', claimedAt: ts } },
    );
    if (session) um = um.session(session);
    await um;

    return { ok: true, amount: claimed };
  }

  /**
   * @param {string} address
   * @param {number} limit
   */
  async listRewardsTransactions(address, limit = 100) {
    const key = String(address).toLowerCase();
    const lim = Math.max(1, Math.min(500, limit));
    const rows = await this.RewardsTransaction.find({ userId: key })
      .sort({ createdAt: -1 })
      .limit(lim)
      .lean();
    return rows.map((r) => ({
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
   * @returns {Promise<object | null>}
   */
  async getRewardClaimIdempotency(userId, clientKey) {
    const key = String(userId).toLowerCase();
    const ck = String(clientKey).trim();
    const doc = await this.GenesisIdempotency.findOne({
      scope: 'reward_claim',
      userId: key,
      clientKey: ck,
    }).lean();
    return doc?.response && typeof doc.response === 'object' ? doc.response : null;
  }

  /**
   * @param {string} userId
   * @param {string} clientKey
   * @param {object} response
   * @returns {Promise<{ stored: true } | { stored: false, existingResponse: object }>}
   */
  async setRewardClaimIdempotency(userId, clientKey, response) {
    const k = String(userId).toLowerCase();
    const ck = String(clientKey).trim();
    const t = now();
    try {
      await this.GenesisIdempotency.create({
        scope: 'reward_claim',
        userId: k,
        clientKey: ck,
        response,
        createdAt: t,
      });
      return { stored: true };
    } catch (e) {
      if (e?.code === 11000) {
        const doc = await this.GenesisIdempotency.findOne({
          scope: 'reward_claim',
          userId: k,
          clientKey: ck,
        }).lean();
        const er = doc?.response && typeof doc.response === 'object' ? doc.response : {};
        return { stored: false, existingResponse: er };
      }
      throw e;
    }
  }

  async getOrder(orderId) {
    const doc = await this.P2pOrder.findOne({ id: orderId }).lean();
    return orderToApi(doc);
  }

  /**
   * @param {import('mongoose').ClientSession | null} [session]
   */
  async saveOrder(order, session = null) {
    const o = orderToApi(order);
    o.updatedAt = now();
    let op = this.P2pOrder.updateOne({ id: o.id }, { $set: o }, { upsert: true });
    if (session) op = op.session(session);
    await op;
    return order;
  }

  async deleteOrder(orderId) {
    await this.P2pOrder.deleteOne({ id: orderId });
  }

  async listOrdersForProject(projectId, { status, side } = {}) {
    const q = { projectId: String(projectId || 'genesis') };
    if (status) q.status = status;
    if (side) q.side = side;
    const rows = await this.P2pOrder.find(q).sort({ createdAt: -1 }).lean();
    return rows.map(orderToApi);
  }

  async listOpenOrdersBook(projectId, side) {
    const rows = await this.P2pOrder.find({
      projectId: String(projectId || 'genesis'),
      side: String(side),
      status: { $in: ['open', 'partial'] },
    })
      .sort({ createdAt: -1 })
      .lean();
    return rows.map(orderToApi);
  }

  async getProjectConfig(projectId) {
    const pid = String(projectId || 'genesis').trim() || 'genesis';
    const doc = await this._ensureProjectConfig(pid);
    return {
      projectId: doc.projectId,
      price: { ...doc.price },
      p2pFeeBps: doc.p2pFeeBps,
      minOrderUsd: doc.minOrderUsd,
      maxOrderUsd: doc.maxOrderUsd,
      marketPaused: doc.marketPaused,
    };
  }

  async setProjectConfig(projectId, patch) {
    const pid = String(projectId || 'genesis').trim() || 'genesis';
    await this._ensureProjectConfig(pid);
    const prev = await this.GenesisProjectConfig.findOne({ projectId: pid }).lean();
    const base = defaultProjectDoc(pid);
    const merged = {
      projectId: pid,
      price: {
        ...base.price,
        ...(prev?.price && typeof prev.price === 'object' ? prev.price : {}),
        ...(patch.price && typeof patch.price === 'object' ? patch.price : {}),
      },
      p2pFeeBps: patch.p2pFeeBps ?? prev?.p2pFeeBps ?? base.p2pFeeBps,
      minOrderUsd: patch.minOrderUsd ?? prev?.minOrderUsd ?? base.minOrderUsd,
      maxOrderUsd: patch.maxOrderUsd ?? prev?.maxOrderUsd ?? base.maxOrderUsd,
      marketPaused:
        typeof patch.marketPaused === 'boolean' ? patch.marketPaused : (prev?.marketPaused ?? base.marketPaused),
    };
    await this.GenesisProjectConfig.updateOne({ projectId: pid }, { $set: merged }, { upsert: true });
    return this.getProjectConfig(pid);
  }
}
