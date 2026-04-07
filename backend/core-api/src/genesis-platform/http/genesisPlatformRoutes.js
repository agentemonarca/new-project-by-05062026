import { Router } from 'express';
import { createRateLimiter } from '../../middlewares/rateLimitMiddleware.js';
import { isGenesisMongoReady } from '../../db/connectBridge.js';
import { getGenesisPlatformContext } from '../genesisPlatformSingleton.js';
import { MongoGenesisStore } from '../store/MongoGenesisStore.js';
import {
  getGenesisObservabilitySnapshot,
  recordAuditRunSummary,
  recordGenesisDomainError,
  renderGenesisPrometheusMetrics,
} from '../services/genesisObservability.js';
import {
  accrueRewards,
  buildWalletView,
  claimBinary,
  claimDirect,
  claimMining,
  listEarningsApi,
  transferInternal,
  withdrawRequest,
} from '../services/genesisFinance.js';
import {
  claimRewardsToWallet,
  generateBinaryBonus,
  generateDirectBonus,
  getRewardsApiView,
  listRewardsHistoryApi,
} from '../services/genesisRewards.js';
import { listUnifiedLedgerEvents, reconcileUnifiedWalletVsLedger, reconcileUsdWalletVsLedger } from '../services/genesisLedger.js';
import { runGenesisLedgerAudit } from '../services/genesisAuditService.js';
import { commitWalletMutation, formatUnifiedWalletSnapshot } from '../services/genesisUnifiedWallet.js';

function getUserId(req, authService) {
  const sess = req.session?.address;
  if (sess) return String(sess).toLowerCase();
  const raw = String(req.headers.authorization || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (raw) {
    const s = authService.getSession(raw);
    if (s?.address) return String(s.address).toLowerCase();
  }
  return null;
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function adminKeyOk(req) {
  const expected = String(process.env.GENESIS_ADMIN_API_KEY || '').trim();
  if (!expected) return false;
  const got = String(req.headers['x-admin-api-key'] || '').trim();
  return got === expected;
}

/**
 * @param {{ authService: object, logger?: object }} deps
 */
export function createGenesisPlatformRouter(deps) {
  const { authService, logger } = deps;
  const { store, p2p } = getGenesisPlatformContext(logger);

  const router = Router();

  /**
   * Métricas Prometheus para scrape interno (sin usar clave admin).
   * GET /api/metrics/genesis — header X-Genesis-Metrics-Token debe coincidir con GENESIS_PROMETHEUS_SCRAPE_TOKEN.
   */
  router.get('/metrics/genesis', (req, res) => {
    const token = String(process.env.GENESIS_PROMETHEUS_SCRAPE_TOKEN || '').trim();
    if (!token) {
      res.status(404).type('text/plain').send('not_found');
      return;
    }
    const headerTok = String(req.headers['x-genesis-metrics-token'] || '').trim();
    const bearer = String(req.headers.authorization || '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (headerTok !== token && bearer !== token) {
      res.status(401).type('text/plain').send('unauthorized');
      return;
    }
    res.type('text/plain; version=0.0.4; charset=utf-8').send(renderGenesisPrometheusMetrics());
  });

  /** Auditoría ledger vs wallet (admin API key). POST /api/admin/audit/run */
  router.post(
    '/admin/audit/run',
    asyncHandler(async (req, res) => {
      if (!adminKeyOk(req)) {
        res.status(401).json({ error: 'admin_unauthorized' });
        return;
      }
      try {
        const out = await runGenesisLedgerAudit({
          store,
          logger,
          userId: req.body?.userId,
          maxUsers: req.body?.maxUsers,
        });
        recordAuditRunSummary(out);
        res.json(out);
      } catch (e) {
        if (e?.code === 'audit_unsupported') {
          res.status(501).json({ error: e.message, code: e.code });
          return;
        }
        throw e;
      }
    }),
  );

  /** Export CSV-friendly del ledger p2p (admin API key). GET /api/ledger/export */
  router.get(
    '/ledger/export',
    asyncHandler(async (req, res) => {
      if (!adminKeyOk(req)) {
        res.status(401).json({ error: 'admin_unauthorized' });
        return;
      }
      if (typeof store.exportLedgerEntries !== 'function') {
        res.status(501).json({ error: 'export_unsupported' });
        return;
      }
      const limit = Math.min(100_000, Math.max(1, Number(req.query.limit) || 50_000));
      const sinceTs = Math.max(0, Number(req.query.sinceTs) || 0);
      const userId = req.query.userId ? String(req.query.userId).toLowerCase() : null;
      const entries = await store.exportLedgerEntries({ userId, limit, sinceTs });
      res.json({ exportedAt: Date.now(), count: entries.length, entries });
    }),
  );

  const { rateLimit: mkRewardClaimLimit } = createRateLimiter({ logger });
  const rewardClaimRpm = Math.max(3, Number(process.env.GENESIS_REWARD_CLAIM_RPM || 15));
  const rewardClaimRateLimit = mkRewardClaimLimit({
    windowMs: 60_000,
    max: rewardClaimRpm,
    keyGenerator: (req) => `reward_claim:${req.genesisUserId || 'anon'}`,
  });

  const authUser = (req, res, next) => {
    const id = getUserId(req, authService);
    if (!id) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    req.genesisUserId = id;
    next();
  };

  router.get(
    '/wallet',
    authUser,
    asyncHandler(async (req, res) => {
      const w = await buildWalletView(store, req.genesisUserId);
      res.json(w);
    }),
  );

  /** Vista mínima del wallet unificado (balances + pending + notas de integración). */
  router.get(
    '/wallet/unified',
    authUser,
    asyncHandler(async (req, res) => {
      const u = await store.ensureUser(req.genesisUserId);
      res.json({ unified: formatUnifiedWalletSnapshot(u) });
    }),
  );

  router.get(
    '/earnings',
    authUser,
    asyncHandler(async (req, res) => {
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
      const entries = await listEarningsApi(store, req.genesisUserId, limit);
      res.json({ entries });
    }),
  );

  router.get(
    '/network',
    authUser,
    asyncHandler(async (req, res) => {
      const u = await store.ensureUser(req.genesisUserId);
      res.json({ leftMonth: u.network.leftMonth, rightMonth: u.network.rightMonth });
    }),
  );

  router.post(
    '/claim',
    authUser,
    asyncHandler(async (req, res) => {
      const type = String(req.body?.type || '');
      let r;
      switch (type) {
        case 'direct':
          r = await claimDirect(store, req.genesisUserId);
          break;
        case 'binary':
          r = await claimBinary(store, req.genesisUserId);
          break;
        case 'mining':
          r = await claimMining(store, req.genesisUserId);
          break;
        default:
          res.status(400).json({ error: 'invalid_claim_type' });
          return;
      }
      res.status(r.ok ? 200 : 400).json(r);
    }),
  );

  router.get(
    '/ledger',
    authUser,
    asyncHandler(async (req, res) => {
      const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 200));
      const raw = await store.listLedger(req.genesisUserId, limit);
      res.json({ entries: raw });
    }),
  );

  /** Eventos unificados: p2p_transactions + rewards_transactions (+ reconcile opcional). */
  router.get(
    '/ledger/events',
    authUser,
    asyncHandler(async (req, res) => {
      try {
        const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
        const events = await listUnifiedLedgerEvents(store, req.genesisUserId, limit);
        const recParam = String(req.query.reconcile || '').toLowerCase();
        const wantReconcile = recParam === '1' || recParam === 'true' || recParam === 'all';
        const body = { events };
        if (wantReconcile) {
          body.reconciliation =
            recParam === 'all'
              ? await reconcileUnifiedWalletVsLedger(store, req.genesisUserId)
              : await reconcileUsdWalletVsLedger(store, req.genesisUserId);
        }
        res.json(body);
      } catch (e) {
        logger?.warn?.('ledger_events_failed', { message: e?.message });
        res.status(500).json({ error: 'ledger_events_failed' });
      }
    }),
  );

  /** Rewards USD: pending → claim → balances.usd (colección rewards_transactions). */
  router.get(
    '/rewards',
    authUser,
    asyncHandler(async (req, res) => {
      try {
        const body = await getRewardsApiView(store, req.genesisUserId);
        res.json(body);
      } catch (e) {
        logger?.warn?.('rewards_summary_failed', { message: e?.message });
        res.status(500).json({ error: 'rewards_summary_failed' });
      }
    }),
  );

  router.post(
    '/rewards/claim',
    authUser,
    rewardClaimRateLimit,
    asyncHandler(async (req, res) => {
      try {
        const idempotencyKey =
          req.body?.idempotencyKey ??
          req.headers['idempotency-key'] ??
          req.headers['x-idempotency-key'];
        const r = await claimRewardsToWallet(store, req.genesisUserId, { idempotencyKey });
        const status = r.ok ? 200 : r.code === 'invalid_idempotency_key' ? 400 : 400;
        res.status(status).json(r);
      } catch (e) {
        logger?.warn?.('rewards_claim_failed', { message: e?.message });
        res.status(500).json({ ok: false, error: 'internal_error', code: 'claim_failed' });
      }
    }),
  );

  router.get(
    '/rewards/history',
    authUser,
    asyncHandler(async (req, res) => {
      try {
        const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
        const items = await listRewardsHistoryApi(store, req.genesisUserId, limit);
        res.json({ items });
      } catch (e) {
        logger?.warn?.('rewards_history_failed', { message: e?.message });
        res.status(500).json({ error: 'rewards_history_failed' });
      }
    }),
  );

  router.post(
    '/wallet/transfer',
    authUser,
    asyncHandler(async (req, res) => {
      const out = await transferInternal(
        store,
        req.genesisUserId,
        req.body?.toAddress,
        req.body?.currency,
        Number(req.body?.amount),
      );
      res.json(out);
    }),
  );

  router.post(
    '/wallet/withdraw',
    authUser,
    asyncHandler(async (req, res) => {
      const out = await withdrawRequest(
        store,
        req.genesisUserId,
        req.body?.currency,
        Number(req.body?.amount),
        req.body?.destination,
      );
      res.json(out);
    }),
  );

  /** Rutas P2P estilo exchange (alias de /p2p/orders con paths explícitos). */
  const p2pExchange = Router();
  p2pExchange.post(
    '/order/create',
    authUser,
    asyncHandler(async (req, res) => {
      const projectId = String(req.body?.projectId || 'genesis').trim() || 'genesis';
      const side = String(req.body?.side || '');
      const out = await p2p.createOrder({
        address: req.genesisUserId,
        projectId,
        side,
        amount: Number(req.body?.amount),
        price: Number(req.body?.price),
        meta: req.body?.meta,
      });
      res.status(201).json(out);
    }),
  );
  p2pExchange.post(
    '/order/execute',
    authUser,
    asyncHandler(async (req, res) => {
      const makerOrderId = String(req.body?.makerOrderId || req.body?.orderId || '').trim();
      if (!makerOrderId) {
        res.status(400).json({ error: 'makerOrderId_required' });
        return;
      }
      const qty = req.body?.qty != null ? Number(req.body.qty) : null;
      const out = await p2p.takeOrder({
        address: req.genesisUserId,
        makerOrderId,
        qty: Number.isFinite(qty) ? qty : null,
      });
      res.json(out);
    }),
  );
  p2pExchange.get(
    '/orderbook',
    authUser,
    asyncHandler(async (req, res) => {
      const projectId = String(req.query.projectId || 'genesis').trim() || 'genesis';
      const side = String(req.query.side || 'sell');
      if (!['buy', 'sell'].includes(side)) {
        res.status(400).json({ error: 'invalid_side' });
        return;
      }
      const rows = await store.listOpenOrdersBook(projectId, side);
      res.json({
        projectId,
        side,
        orders: rows.map((o) => ({
          id: o.id,
          side: o.side,
          price: o.price,
          amount: o.amountRemaining,
          userId: o.userId,
          createdAt: o.createdAt,
          status: o.status,
        })),
      });
    }),
  );
  p2pExchange.get(
    '/orders/user',
    authUser,
    asyncHandler(async (req, res) => {
      const projectId = String(req.query.projectId || 'genesis').trim() || 'genesis';
      const all = await store.listOrdersForProject(projectId, {});
      const mineRows = all.filter((o) => o.userId === req.genesisUserId);
      res.json({ orders: mineRows });
    }),
  );
  router.use('/p2p', p2pExchange);

  router.get(
    '/p2p/orderbook',
    authUser,
    asyncHandler(async (req, res) => {
      const projectId = String(req.query.projectId || 'genesis').trim() || 'genesis';
      const side = String(req.query.side || 'sell');
      if (!['buy', 'sell'].includes(side)) {
        res.status(400).json({ error: 'invalid_side' });
        return;
      }
      const rows = await store.listOpenOrdersBook(projectId, side);
      res.json({
        projectId,
        side,
        orders: rows.map((o) => ({
          id: o.id,
          side: o.side,
          price: o.price,
          amount: o.amountRemaining,
          userId: o.userId,
          createdAt: o.createdAt,
          status: o.status,
        })),
      });
    }),
  );

  router.get(
    '/p2p/orders',
    authUser,
    asyncHandler(async (req, res) => {
      const projectId = String(req.query.projectId || 'genesis').trim() || 'genesis';
      const mine = String(req.query.mine || '') === '1' || req.query.mine === 'true';
      if (mine) {
        const all = await store.listOrdersForProject(projectId, {});
        const mineRows = all.filter((o) => o.userId === req.genesisUserId);
        res.json({ orders: mineRows });
        return;
      }
      const status = req.query.status ? String(req.query.status) : null;
      const rows = await store.listOrdersForProject(projectId, {
        status: status || undefined,
      });
      res.json({ orders: rows });
    }),
  );

  router.post(
    '/p2p/orders',
    authUser,
    asyncHandler(async (req, res) => {
      const projectId = String(req.body?.projectId || 'genesis').trim() || 'genesis';
      const side = String(req.body?.side || '');
      const amount = Number(req.body?.amount);
      const price = Number(req.body?.price);
      const out = await p2p.createOrder({
        address: req.genesisUserId,
        projectId,
        side,
        amount,
        price,
        meta: req.body?.meta,
      });
      res.status(201).json(out);
    }),
  );

  router.post(
    '/p2p/orders/:id/cancel',
    authUser,
    asyncHandler(async (req, res) => {
      const order = await p2p.cancelOrder(req.genesisUserId, req.params.id);
      res.json({ order });
    }),
  );

  router.post(
    '/p2p/orders/:id/take',
    authUser,
    asyncHandler(async (req, res) => {
      const qty = req.body?.qty != null ? Number(req.body.qty) : null;
      const out = await p2p.takeOrder({
        address: req.genesisUserId,
        makerOrderId: req.params.id,
        qty: Number.isFinite(qty) ? qty : null,
      });
      res.json(out);
    }),
  );

  const admin = Router();
  admin.use((req, res, next) => {
    if (!adminKeyOk(req)) {
      res.status(401).json({ error: 'admin_unauthorized' });
      return;
    }
    next();
  });

  admin.get(
    '/config',
    asyncHandler(async (req, res) => {
      const projectId = String(req.query.projectId || 'genesis').trim() || 'genesis';
      const cfg = await store.getProjectConfig(projectId);
      res.json(cfg);
    }),
  );

  admin.put(
    '/config',
    asyncHandler(async (req, res) => {
      const projectId = String(req.body?.projectId || 'genesis').trim() || 'genesis';
      const patch = { ...req.body };
      delete patch.projectId;
      if (patch.price && typeof patch.price === 'object') {
        const p = await store.getProjectConfig(projectId);
        patch.price = { ...p.price, ...patch.price };
      }
      const next = await store.setProjectConfig(projectId, patch);
      res.json(next);
    }),
  );

  admin.post(
    '/rewards/accrue',
    asyncHandler(async (req, res) => {
      const userId = String(req.body?.userId || '').trim().toLowerCase();
      const r = await accrueRewards(store, userId, {
        direct: Number(req.body?.direct || 0),
        binary: Number(req.body?.binary || 0),
        mining: Number(req.body?.mining || 0),
      });
      res.json(r);
    }),
  );

  admin.post(
    '/rewards/bonus/direct',
    asyncHandler(async (req, res) => {
      const userId = String(req.body?.userId || '').trim().toLowerCase();
      const amount = Number(req.body?.amount);
      const idempotencyKey =
        req.body?.idempotencyKey ?? req.headers['idempotency-key'] ?? req.headers['x-idempotency-key'];
      const r = await generateDirectBonus(store, userId, amount, { idempotencyKey });
      const st = !r.ok
        ? r.code === 'idempotency_conflict'
          ? 409
          : r.code === 'invalid_idempotency_key'
            ? 400
            : 400
        : 200;
      res.status(st).json(r);
    }),
  );

  admin.post(
    '/rewards/bonus/binary',
    asyncHandler(async (req, res) => {
      const userId = String(req.body?.userId || '').trim().toLowerCase();
      const amount = Number(req.body?.amount);
      const idempotencyKey =
        req.body?.idempotencyKey ?? req.headers['idempotency-key'] ?? req.headers['x-idempotency-key'];
      const r = await generateBinaryBonus(store, userId, amount, { idempotencyKey });
      const st = !r.ok
        ? r.code === 'idempotency_conflict'
          ? 409
          : r.code === 'invalid_idempotency_key'
            ? 400
            : 400
        : 200;
      res.status(st).json(r);
    }),
  );

  admin.post(
    '/wallet/credit',
    asyncHandler(async (req, res) => {
      const userId = String(req.body?.userId || '').trim().toLowerCase();
      const u = await store.ensureUser(userId);
      const usd = Number(req.body?.usd || 0);
      const aig = Number(req.body?.aig || 0);
      if (Number.isFinite(usd) && usd !== 0) u.balances.usd = Math.round((u.balances.usd + usd) * 1e8) / 1e8;
      if (Number.isFinite(aig) && aig !== 0) u.balances.aig = Math.round((u.balances.aig + aig) * 1e8) / 1e8;
      const refBase = `credit:${Date.now()}`;
      const ledgerRows = [];
      if (Number.isFinite(usd) && usd !== 0) {
        ledgerRows.push({
          direction: 'CREDIT',
          category: 'admin_credit',
          amount: Math.abs(usd),
          currency: 'USDT',
          referenceType: 'admin',
          referenceId: `${refBase}:usd`,
          metadata: { delta: usd },
        });
      }
      if (Number.isFinite(aig) && aig !== 0) {
        ledgerRows.push({
          direction: 'CREDIT',
          category: 'admin_credit',
          amount: Math.abs(aig),
          currency: 'AIG',
          referenceType: 'admin',
          referenceId: `${refBase}:aig`,
          metadata: { delta: aig },
        });
      }
      if (!ledgerRows.length) {
        res.json({ ok: true, balances: u.balances, note: 'no_ledger_change' });
        return;
      }
      await commitWalletMutation(store, userId, { balances: { ...u.balances } }, ledgerRows);
      res.json({ ok: true, balances: u.balances });
    }),
  );

  admin.patch(
    '/user/:address',
    asyncHandler(async (req, res) => {
      const addr = String(req.params.address || '').toLowerCase();
      await store.ensureUser(addr);
      const patch = {};
      if (typeof req.body?.role === 'string') patch.role = req.body.role;
      if (req.body?.permissions && typeof req.body.permissions === 'object') patch.permissions = req.body.permissions;
      if (typeof req.body?.miningActive === 'boolean') patch.miningActive = req.body.miningActive;
      if (req.body?.network && typeof req.body.network === 'object') {
        const u = await store.getUser(addr);
        patch.network = { ...u.network, ...req.body.network };
      }
      const u = await store.updateUser(addr, patch);
      res.json({ ok: true, user: u });
    }),
  );

  admin.get(
    '/ledger-export',
    asyncHandler(async (req, res) => {
      const userId = (req.query.userId && String(req.query.userId).toLowerCase()) || null;
      const limit = Math.min(5000, Math.max(1, Number(req.query.limit) || 2000));
      if (userId) {
        const entries = await store.listLedger(userId, limit);
        return res.json({ userId, entries: entries.reverse() });
      }
      const tail = await store.tailLedger(limit);
      res.json({ entries: tail.reverse() });
    }),
  );

  admin.post(
    '/audit/run',
    asyncHandler(async (req, res) => {
      try {
        const out = await runGenesisLedgerAudit({
          store,
          logger,
          userId: req.body?.userId,
          maxUsers: req.body?.maxUsers,
        });
        recordAuditRunSummary(out);
        res.json(out);
      } catch (e) {
        if (e?.code === 'audit_unsupported') {
          res.status(501).json({ error: e.message, code: e.code });
          return;
        }
        throw e;
      }
    }),
  );

  /** Dashboard interno JSON: métricas, salud, última auditoría. GET /api/admin/genesis/observability/dashboard */
  admin.get(
    '/observability/dashboard',
    asyncHandler(async (_req, res) => {
      const snap = getGenesisObservabilitySnapshot();
      const mongoConnected = isGenesisMongoReady();
      const persistBackend = store instanceof MongoGenesisStore ? 'mongodb' : 'memory';
      let health = 'healthy';
      const notes = [];
      if (!mongoConnected) {
        health = 'degraded';
        notes.push('Mongo no conectado (readyState !== 1)');
      }
      if (persistBackend === 'memory') {
        health = health === 'healthy' ? 'degraded' : health;
        notes.push('Store en memoria — datos no duraderos entre procesos');
      }
      if (snap.lastAudit && snap.lastAudit.ok === false) {
        health = 'critical';
        notes.push(`Última auditoría: ${snap.lastAudit.driftCount} cuenta(s) con drift`);
      }
      res.json({
        at: new Date().toISOString(),
        health: { status: health, notes },
        process: { uptimeSec: snap.uptimeSec, pid: process.pid },
        persistence: { mongoConnected, persistBackend },
        observability: snap,
      });
    }),
  );

  /** Métricas estilo Prometheus. GET /api/admin/genesis/observability/prometheus */
  admin.get(
    '/observability/prometheus',
    asyncHandler(async (_req, res) => {
      res.type('text/plain; version=0.0.4; charset=utf-8').send(renderGenesisPrometheusMetrics());
    }),
  );

  router.use('/admin/genesis', admin);

  router.use((err, req, res, _next) => {
    const code = err?.code;
    const msg = err?.message || 'error';
    const path = req.originalUrl?.split('?')[0] || req.path || '';
    if (code === 'not_found') {
      recordGenesisDomainError({ code, message: msg, status: 404, path });
      res.status(404).json({ error: msg, code });
      return;
    }
    if (code === 'forbidden' || code === 'own_order' || code === 'self_match') {
      recordGenesisDomainError({ code, message: msg, status: 403, path });
      res.status(403).json({ error: msg, code });
      return;
    }
    if (code === 'invalid_reward_amount' || code === 'invalid_reward_type' || code === 'generate_failed') {
      recordGenesisDomainError({ code, message: msg, status: 400, path });
      res.status(400).json({ error: msg, code });
      return;
    }
    if (code === 'idempotency_conflict') {
      recordGenesisDomainError({ code, message: msg, status: 409, path });
      res.status(409).json({ error: msg, code });
      return;
    }
    if (code === 'invalid_idempotency_key') {
      recordGenesisDomainError({ code, message: msg, status: 400, path });
      res.status(400).json({ error: msg, code });
      return;
    }
    if (
      code &&
      [
        'invalid_amount',
        'invalid_price',
        'invalid_side',
        'below_min',
        'above_max',
        'price_band',
        'insufficient_aig',
        'insufficient_usd',
        'bad_address',
        'bad_amount',
        'bad_currency',
        'self_transfer',
        'below_min',
        'not_cancellable',
        'no_cross',
        'bad_state',
        'qty',
        'not_open',
        'mining_required',
      ].includes(code)
    ) {
      recordGenesisDomainError({ code, message: msg, status: 400, path });
      res.status(400).json({ error: msg, code });
      return;
    }
    if (code === 'market_paused') {
      recordGenesisDomainError({ code, message: msg, status: 503, path });
      res.status(503).json({ error: msg, code });
      return;
    }
    recordGenesisDomainError({ code: code || 'internal_error', message: msg, status: 500, path });
    logger?.warn?.('genesis_platform_error', { message: msg, code });
    res.status(500).json({ error: 'internal_error' });
  });

  return router;
}
