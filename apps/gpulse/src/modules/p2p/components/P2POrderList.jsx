import React, { memo, useCallback } from 'react';
import { P2POrderCard } from './P2POrderCard.jsx';

/**
 * @typedef {import('../store/p2pOrdersStore.js').P2POrderRow} P2POrderRow
 */

/**
 * @param {{
 *   orders: P2POrderRow[],
 *   sideFilter?: 'buy' | 'sell' | 'all',
 *   onExecute?: (id: string) => void,
 *   emptyHint?: string,
 * }} props
 */
function P2POrderListInner({ orders, sideFilter = 'all', onExecute, emptyHint = 'No hay órdenes en el libro.' }) {
  const filtered = sideFilter === 'all' ? orders : orders.filter((o) => o.side === sideFilter);

  const execCb = useCallback(
    (id) => {
      onExecute?.(id);
    },
    [onExecute],
  );

  if (!filtered.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">
        {emptyHint}
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((order) => (
        <li key={order.id}>
          <P2POrderCard order={order} onExecute={onExecute ? execCb : undefined} showExecute={Boolean(onExecute)} />
        </li>
      ))}
    </ul>
  );
}

export const P2POrderList = memo(P2POrderListInner);
P2POrderList.displayName = 'P2POrderList';
