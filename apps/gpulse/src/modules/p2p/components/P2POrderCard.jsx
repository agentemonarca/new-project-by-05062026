import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { GradientButton } from '@/ui-genesis/components/GradientButton.jsx';

/**
 * @typedef {import('../store/p2pOrdersStore.js').P2POrderRow} P2POrderRow
 * @typedef {import('../store/p2pOrdersStore.js').P2PSide} P2PSide
 */

/**
 * @param {{
 *   order: P2POrderRow,
 *   onExecute?: (id: string) => void,
 *   executeLabel?: string,
 *   showExecute?: boolean,
 * }} props
 */
function P2POrderCardInner({ order, onExecute, executeLabel = 'Tomar orden', showExecute = true }) {
  const onClick = useCallback(() => {
    if (onExecute) onExecute(order.id);
  }, [onExecute, order.id]);

  const sideLabel = order.side === 'buy' ? 'Compra' : 'Venta';
  const sideClass =
    order.side === 'buy'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
      : 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-100';

  return (
    <motion.article
      layout
      className="rounded-xl border border-white/10 bg-slate-950/60 p-4 backdrop-blur-md"
      initial={false}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sideClass}`}>
            {sideLabel}
          </span>
          {order.owned ? (
            <span className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
              Tú
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <ArrowRightLeft className="h-3 w-3" strokeWidth={2} />
          {order.label ?? 'P2P'}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Precio</p>
          <p className="mt-0.5 font-mono font-semibold tabular-nums text-white">${Number(order.priceUsd).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cantidad AIG</p>
          <p className="mt-0.5 font-mono font-semibold tabular-nums text-cyan-100/95">
            {Number(order.amountAig).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
      {showExecute && onExecute && !order.owned ? (
        <div className="mt-4">
          <GradientButton
            type="button"
            className="!w-full !justify-center !py-2 !text-xs !font-semibold"
            onClick={onClick}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" strokeWidth={2} />
            {executeLabel}
          </GradientButton>
        </div>
      ) : null}
    </motion.article>
  );
}

function orderCardPropsEqual(prev, next) {
  return (
    prev.order.id === next.order.id &&
    prev.order.status === next.order.status &&
    prev.order.priceUsd === next.order.priceUsd &&
    prev.order.amountAig === next.order.amountAig &&
    prev.order.side === next.order.side &&
    prev.showExecute === next.showExecute &&
    prev.executeLabel === next.executeLabel &&
    prev.onExecute === next.onExecute
  );
}

export const P2POrderCard = memo(P2POrderCardInner, orderCardPropsEqual);
P2POrderCard.displayName = 'P2POrderCard';
