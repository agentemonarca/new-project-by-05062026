import { useCallback, useMemo } from 'react';
import { useP2POrdersStore } from '../store/p2pOrdersStore.js';
import { useP2PValidation } from './useP2PValidation.js';

/**
 * @typedef {import('../store/p2pOrdersStore.js').P2POrderRow} P2POrderRow
 * @typedef {import('../store/p2pOrdersStore.js').P2PSide} P2PSide
 */

export function useP2POrders() {
  const orders = useP2POrdersStore((s) => s.orders);
  const appendOwnedOpenOrder = useP2POrdersStore((s) => s.appendOwnedOpenOrder);
  const setOrderStatus = useP2POrdersStore((s) => s.setOrderStatus);
  const resetBookDemo = useP2POrdersStore((s) => s.resetBookDemo);
  const setMockUser = useP2POrdersStore((s) => s.setMockUser);
  const mockUser = useP2POrdersStore((s) => s.mockUser);

  const { validatePrice, validateAmount, validateUser, validateLimits } = useP2PValidation();

  const openOrders = useMemo(() => orders.filter((o) => o.status === 'open'), [orders]);

  const createOrder = useCallback(
    (/** @type {{ side: P2PSide, priceUsd: number, amountAig: number }} */ payload) => {
      const errs = [
        validateUser(payload.side),
        validatePrice(payload.priceUsd),
        validateAmount(payload.amountAig),
        validateLimits(payload.side, payload.amountAig),
      ].filter((e) => !e.ok);
      if (errs.length) {
        return { ok: false, error: errs[0].message };
      }
      const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      /** @type {P2POrderRow} */
      const row = {
        id,
        side: payload.side,
        priceUsd: Number(payload.priceUsd),
        amountAig: Number(payload.amountAig),
        status: 'open',
        createdAt: Date.now(),
        label: 'Tú',
      };
      appendOwnedOpenOrder(row, payload.side);
      return { ok: true, order: row };
    },
    [appendOwnedOpenOrder, validateAmount, validateLimits, validatePrice, validateUser],
  );

  const executeOrder = useCallback(
    (/** @type {string} */ id) => {
      const o = orders.find((x) => x.id === id);
      if (!o || o.status !== 'open') return { ok: false, error: 'Orden no disponible' };
      setOrderStatus(id, 'filled');
      return { ok: true };
    },
    [orders, setOrderStatus],
  );

  const cancelOrder = useCallback(
    (id) => {
      const o = orders.find((x) => x.id === id);
      if (!o || o.status !== 'open') return { ok: false, error: 'Orden no cancelable' };
      setOrderStatus(id, 'cancelled');
      return { ok: true };
    },
    [orders, setOrderStatus],
  );

  return useMemo(
    () => ({
      orders: openOrders,
      allOrders: orders,
      createOrder,
      executeOrder,
      cancelOrder,
      resetBookDemo,
      setMockUser,
      mockUser,
    }),
    [openOrders, orders, createOrder, executeOrder, cancelOrder, resetBookDemo, setMockUser, mockUser],
  );
}
