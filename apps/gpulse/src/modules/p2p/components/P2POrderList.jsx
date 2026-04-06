import React, { memo, useCallback } from 'react';
import { P2POrderCard } from './P2POrderCard.jsx';

/**
 * @typedef {import('../p2pTypes.js').P2POrderRow} P2POrderRow
 */

/**
 * @param {{
 *   orders: P2POrderRow[],
 *   sideFilter?: 'buy' | 'sell' | 'all',
 *   onExecute?: (id: string) => void | Promise<void>,
 *   onCancel?: (id: string) => void | Promise<void>,
 *   emptyHint?: string,
 *   executingId?: string | null,
 *   cancellingId?: string | null,
 *   showCancelOwned?: boolean,
 * }} props
 */
function P2POrderListInner({
  orders,
  sideFilter = 'all',
  onExecute,
  onCancel,
  emptyHint = 'No hay órdenes en el libro.',
  executingId = null,
  cancellingId = null,
  showCancelOwned = false,
}) {
  const filtered = sideFilter === 'all' ? orders : orders.filter((o) => o.side === sideFilter);

  const execCb = useCallback(
    (id) => {
      onExecute?.(id);
    },
    [onExecute],
  );

  const cancelCb = useCallback(
    (id) => {
      onCancel?.(id);
    },
    [onCancel],
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
          <P2POrderCard
            order={order}
            onExecute={onExecute ? execCb : undefined}
            showExecute={Boolean(onExecute)}
            isExecuting={Boolean(executingId && executingId === order.id)}
            onCancel={onCancel && showCancelOwned ? cancelCb : undefined}
            showCancel={Boolean(onCancel && showCancelOwned)}
            isCancelling={Boolean(cancellingId && cancellingId === order.id)}
          />
        </li>
      ))}
    </ul>
  );
}

export const P2POrderList = memo(P2POrderListInner);
P2POrderList.displayName = 'P2POrderList';
