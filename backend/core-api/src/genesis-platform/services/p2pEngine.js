/**
 * Motor P2P — orderbook, escrow en frozen.*, estados server-side.
 * Settlement consolida balances vía wallet unificado (mismo origen que rewards/mining claims).
 */

import { commitUnifiedBalances } from './genesisUnifiedWallet.js';
import { recordP2pTradeSettled } from './genesisObservability.js';

function assert(cond, code, msg) {
  if (!cond) {
    const e = new Error(msg);
    e.code = code;
    throw e;
  }
}

function round6(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
}

export function createP2pEngine({ store, logger }) {
  async function createOrder(
    { address, projectId, side, amount, price, meta = {} },
    opts = {},
  ) {
    const user = await store.ensureUser(address);
    const cfg = await store.getProjectConfig(projectId);
    assert(!cfg.marketPaused, 'market_paused', 'Mercado pausado');

    const skipMining = String(process.env.P2P_SKIP_MINING_CHECK || '').trim() === '1';
    if (side === 'sell' && !skipMining) {
      assert(
        user.miningActive === true,
        'mining_required',
        'Minería activa requerida para publicar ventas P2P',
      );
    }
    const amt = round6(amount);
    const px = round6(price);
    assert(Number.isFinite(amt) && amt > 0, 'invalid_amount', 'Cantidad inválida');
    assert(Number.isFinite(px) && px > 0, 'invalid_price', 'Precio inválido');
    assert(['buy', 'sell'].includes(side), 'invalid_side', 'Lado inválido');

    const notionalUsd = round6(amt * px);
    assert(notionalUsd >= cfg.minOrderUsd, 'below_min', `Mínimo orden ${cfg.minOrderUsd} USD`);
    assert(notionalUsd <= cfg.maxOrderUsd, 'above_max', `Máximo orden ${cfg.maxOrderUsd} USD`);
    assert(px >= cfg.price.minPrice && px <= cfg.price.maxPrice, 'price_band', 'Precio fuera de banda');

    if (side === 'sell') {
      const availAig = round6(user.balances.aig - user.frozen.aig);
      assert(availAig >= amt, 'insufficient_aig', 'AIG insuficiente (incl. escrow)');
      await store.adjustFrozen(address, 0, amt);
    } else {
      const availUsd = round6(user.balances.usd - user.frozen.usd);
      assert(availUsd >= notionalUsd, 'insufficient_usd', 'USD insuficiente para compra');
      await store.adjustFrozen(address, notionalUsd, 0);
    }

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const order = {
      id: orderId,
      projectId,
      userId: user.address,
      side,
      amount: amt,
      amountOriginal: amt,
      amountRemaining: amt,
      price: px,
      status: 'open',
      escrowUsd: side === 'buy' ? notionalUsd : 0,
      escrowAig: side === 'sell' ? amt : 0,
      counterpartyId: null,
      meta: typeof meta === 'object' && meta ? meta : {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await store.saveOrder(order);
    await store.appendLedger(address, {
      direction: 'CREDIT',
      category: 'p2p_order_create',
      amount: 0,
      currency: 'USDT',
      referenceType: 'p2p',
      referenceId: orderId,
      metadata: { side, amount: amt, price: px, note: 'orden_creada' },
    });
    logger?.info?.('p2p_order_created', { orderId, side, amt, px });
    let match;
    try {
      if (opts.preferMakerOrderId) {
        const spec = await tryMatchSpecific(orderId, opts.preferMakerOrderId);
        const book = await tryMatch(projectId, orderId);
        match = { specific: spec, book };
      } else {
        match = await tryMatch(projectId, orderId);
      }
    } catch (e) {
      if (order.side === 'sell') await store.adjustFrozen(address, 0, -order.escrowAig);
      else await store.adjustFrozen(address, -order.escrowUsd, 0);
      await store.deleteOrder(orderId);
      throw e;
    }
    return { order: await store.getOrder(orderId), match };
  }

  /**
   * @param {import('mongoose').ClientSession | null} [session]
   */
  async function settleTrade(buyOrder, sellOrder, qty, execPrice, session = null) {
    const notional = round6(qty * execPrice);
    const buyer = buyOrder.userId;
    const seller = sellOrder.userId;

    const remBuy = buyOrder.amountRemaining;
    const usdUnfreeze =
      remBuy > 0 ? round6((qty / remBuy) * buyOrder.escrowUsd) : round6(buyOrder.escrowUsd);

    await store.adjustFrozen(seller, 0, -qty, session);
    await store.adjustFrozen(buyer, -usdUnfreeze, 0, session);

    buyOrder.escrowUsd = round6(Math.max(0, buyOrder.escrowUsd - usdUnfreeze));
    sellOrder.escrowAig = round6(Math.max(0, sellOrder.escrowAig - qty));

    const su = await store.ensureUser(seller);
    const bu = await store.ensureUser(buyer);
    su.balances.aig = round6(su.balances.aig - qty);
    su.balances.usd = round6(su.balances.usd + notional);
    bu.balances.usd = round6(bu.balances.usd - notional);
    bu.balances.aig = round6(bu.balances.aig + qty);

    buyOrder.amountRemaining = round6(buyOrder.amountRemaining - qty);
    sellOrder.amountRemaining = round6(sellOrder.amountRemaining - qty);
    buyOrder.status = buyOrder.amountRemaining <= 1e-9 ? 'filled' : 'partial';
    sellOrder.status = sellOrder.amountRemaining <= 1e-9 ? 'filled' : 'partial';

    const ts = Date.now();
    const commitOpts = session ? { session } : null;
    await commitUnifiedBalances(
      store,
      seller,
      { usd: su.balances.usd, aig: su.balances.aig },
      [
        {
          direction: 'CREDIT',
          category: 'p2p_trade',
          amount: notional,
          currency: 'USDT',
          referenceType: 'p2p',
          referenceId: `sell:${seller}:${ts}`,
          metadata: { leg: 'usdt_in', aigOut: qty, price: execPrice },
        },
        {
          direction: 'DEBIT',
          category: 'p2p_trade',
          amount: qty,
          currency: 'AIG',
          referenceType: 'p2p',
          referenceId: `sell_aig:${seller}:${ts}`,
          metadata: { leg: 'aig_out', usdtIn: notional, price: execPrice },
        },
      ],
      commitOpts,
    );
    await commitUnifiedBalances(
      store,
      buyer,
      { usd: bu.balances.usd, aig: bu.balances.aig },
      [
        {
          direction: 'DEBIT',
          category: 'p2p_trade',
          amount: notional,
          currency: 'USDT',
          referenceType: 'p2p',
          referenceId: `buy:${buyer}:${ts}`,
          metadata: { leg: 'usdt_out', aigIn: qty, price: execPrice },
        },
        {
          direction: 'CREDIT',
          category: 'p2p_trade',
          amount: qty,
          currency: 'AIG',
          referenceType: 'p2p',
          referenceId: `buy_aig:${buyer}:${ts}`,
          metadata: { leg: 'aig_in', usdtOut: notional, price: execPrice },
        },
      ],
      commitOpts,
    );

    recordP2pTradeSettled({
      buyer,
      seller,
      qtyAig: qty,
      notionalUsd: notional,
      execPrice,
      projectId: buyOrder.projectId || 'genesis',
    });
  }

  async function oneMatch(projectId, incomingOrderId) {
    const incoming = await store.getOrder(incomingOrderId);
    if (!incoming || !['open', 'partial'].includes(incoming.status)) return { matched: false };
    if (incoming.amountRemaining <= 1e-9) return { matched: false };

    const contraSide = incoming.side === 'buy' ? 'sell' : 'buy';
    const book = await store.listOpenOrdersBook(projectId, contraSide);
    const candidates = book
      .filter((o) => o.id !== incoming.id && o.userId !== incoming.userId)
      .filter((o) => {
        if (incoming.side === 'buy') return o.price <= incoming.price;
        return o.price >= incoming.price;
      })
      .sort((a, b) => (incoming.side === 'buy' ? a.price - b.price : b.price - a.price));

    if (!candidates.length) return { matched: false };

    const maker = candidates[0];
    const taker = incoming;
    const qty = round6(Math.min(maker.amountRemaining, taker.amountRemaining));
    if (qty <= 0) return { matched: false };

    const execPrice = maker.createdAt <= taker.createdAt ? maker.price : taker.price;
    const buyOrder = incoming.side === 'buy' ? incoming : maker;
    const sellOrder = incoming.side === 'sell' ? incoming : maker;

    maker.counterpartyId = taker.userId;
    taker.counterpartyId = maker.userId;

    await store.runMongoTransaction(async (session) => {
      await settleTrade(buyOrder, sellOrder, qty, execPrice, session);
      await store.saveOrder(maker, session);
      await store.saveOrder(taker, session);
    });
    return { matched: true, qty, execPrice };
  }

  async function tryMatch(projectId, incomingOrderId) {
    const matches = [];
    while (true) {
      const r = await oneMatch(projectId, incomingOrderId);
      if (!r.matched) break;
      matches.push(r);
      const ord = await store.getOrder(incomingOrderId);
      if (!ord || ord.status === 'filled' || ord.amountRemaining <= 1e-9) break;
    }
    return { matched: matches.length > 0, matches };
  }

  async function tryMatchSpecific(takerOrderId, makerOrderId) {
    const taker = await store.getOrder(takerOrderId);
    const maker = await store.getOrder(makerOrderId);
    assert(taker && maker, 'not_found', 'Orden no encontrada');
    assert(taker.id !== maker.id, 'invalid', 'Mismo orden');
    assert(taker.userId !== maker.userId, 'self_match', 'No puede operar contra sí mismo');
    assert(taker.side !== maker.side, 'invalid', 'Lado incompatible');
    assert(
      ['open', 'partial'].includes(taker.status) && ['open', 'partial'].includes(maker.status),
      'bad_state',
      'Órdenes no activas',
    );
    const buyOrder = taker.side === 'buy' ? taker : maker;
    const sellOrder = taker.side === 'sell' ? taker : maker;
    assert(buyOrder.price >= sellOrder.price - 1e-9, 'no_cross', 'Precio no cruza');

    const qty = round6(Math.min(buyOrder.amountRemaining, sellOrder.amountRemaining));
    if (qty <= 0) return { matched: false };

    const execPrice = maker.createdAt <= taker.createdAt ? maker.price : taker.price;
    maker.counterpartyId = taker.userId;
    taker.counterpartyId = maker.userId;
    await store.runMongoTransaction(async (session) => {
      await settleTrade(buyOrder, sellOrder, qty, execPrice, session);
      await store.saveOrder(maker, session);
      await store.saveOrder(taker, session);
    });
    return { matched: true, qty, execPrice };
  }

  async function takeOrder({ address, makerOrderId, qty }) {
    const maker = await store.getOrder(makerOrderId);
    assert(maker, 'not_found', 'Orden no encontrada');
    assert(
      ['open', 'partial'].includes(maker.status),
      'not_open',
      'La orden no está disponible',
    );
    const takerAddr = String(address).toLowerCase();
    assert(maker.userId !== takerAddr, 'own_order', 'No puedes tomar tu propia orden');
    const maxQ = maker.amountRemaining;
    const q = qty != null ? round6(Math.min(maxQ, qty)) : maxQ;
    assert(q > 0, 'qty', 'Cantidad inválida');

    const takerSide = maker.side === 'sell' ? 'buy' : 'sell';
    return createOrder(
      {
        address: takerAddr,
        projectId: maker.projectId,
        side: takerSide,
        amount: q,
        price: maker.price,
        meta: { takeOf: makerOrderId },
      },
      { preferMakerOrderId: makerOrderId },
    );
  }

  async function cancelOrder(address, orderId) {
    const order = await store.getOrder(orderId);
    assert(order, 'not_found', 'Orden no encontrada');
    assert(order.userId === String(address).toLowerCase(), 'forbidden', 'No es tu orden');
    assert(['open', 'partial'].includes(order.status), 'not_cancellable', 'Orden no cancelable');

    if (order.side === 'sell') {
      await store.adjustFrozen(address, 0, -order.escrowAig);
    } else {
      await store.adjustFrozen(address, -order.escrowUsd, 0);
    }
    order.status = 'cancelled';
    order.updatedAt = Date.now();
    await store.saveOrder(order);
    await store.appendLedger(address, {
      direction: 'CREDIT',
      category: 'p2p_order_cancel',
      amount: 0,
      currency: 'USDT',
      referenceType: 'p2p',
      referenceId: orderId,
      metadata: { note: 'cancelada' },
    });
    return order;
  }

  /** Simula fill admin: libera escrow y cierra sin contraparte (solo entornos controlados). */
  async function forceExecute(address, orderId) {
    const order = await store.getOrder(orderId);
    assert(order, 'not_found', 'Orden no encontrada');
    assert(order.userId === String(address).toLowerCase(), 'forbidden', 'No es tu orden');
    assert(['open', 'partial'].includes(order.status), 'bad_state', 'Estado no ejecutable');

    if (order.side === 'sell') {
      await store.adjustFrozen(address, 0, -order.escrowAig);
    } else {
      await store.adjustFrozen(address, -order.escrowUsd, 0);
    }
    order.status = 'filled';
    order.amountRemaining = 0;
    order.escrowAig = 0;
    order.escrowUsd = 0;
    order.updatedAt = Date.now();
    await store.saveOrder(order);
    await store.appendLedger(address, {
      direction: 'CREDIT',
      category: 'p2p_order_force_fill',
      amount: 0,
      currency: 'USDT',
      referenceType: 'p2p',
      referenceId: orderId,
      metadata: { note: 'admin_only' },
    });
    return order;
  }

  return {
    createOrder,
    tryMatch,
    tryMatchSpecific,
    takeOrder,
    cancelOrder,
    forceExecute,
  };
}
