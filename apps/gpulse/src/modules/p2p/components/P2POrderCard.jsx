import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightLeft, CheckCircle2, XCircle } from 'lucide-react';
import { GradientButton } from '@/ui-genesis/components/GradientButton.jsx';

/**
 * @typedef {import('../p2pTypes.js').P2POrderRow} P2POrderRow
 */

/**
 * @param {{
 *   order: P2POrderRow,
 *   onExecute?: (id: string) => void | Promise<void>,
 *   executeLabel?: string,
 *   showExecute?: boolean,
 *   isExecuting?: boolean,
 *   onCancel?: (id: string) => void | Promise<void>,
 *   showCancel?: boolean,
 *   isCancelling?: boolean,
 * }} props
 */
function P2POrderCardInner({
  order,
  onExecute,
  executeLabel = 'Tomar orden',
  showExecute = true,
  isExecuting = false,
  onCancel,
  showCancel = false,
  isCancelling = false,
}) {
  const onClickExec = useCallback(() => {
    if (isExecuting) return;
    if (onExecute) void Promise.resolve(onExecute(order.id));
  }, [isExecuting, onExecute, order.id]);

  const onClickCancel = useCallback(() => {
    if (isCancelling) return;
    if (onCancel) void Promise.resolve(onCancel(order.id));
  }, [isCancelling, onCancel, order.id]);

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
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sideClass}`}>
            {sideLabel}
          </span>
          {order.owned ? (
            <span className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
              Tú
            </span>
          ) : null}
          {order.status === 'partial' ? (
            <span className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
              Parcial
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
            disabled={isExecuting}
            className="!w-full !justify-center !py-2 !text-xs !font-semibold disabled:opacity-45"
            onClick={onClickExec}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" strokeWidth={2} />
            {isExecuting ? 'Procesando…' : executeLabel}
          </GradientButton>
        </div>
      ) : null}
      {showCancel && onCancel && order.owned ? (
        <div className="mt-3">
          <button
            type="button"
            disabled={isCancelling}
            onClick={onClickCancel}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/15 disabled:opacity-45"
          >
            <XCircle className="h-4 w-4" strokeWidth={2} />
            {isCancelling ? 'Cancelando…' : 'Cancelar mi orden'}
          </button>
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
    prev.onExecute === next.onExecute &&
    prev.isExecuting === next.isExecuting &&
    prev.showCancel === next.showCancel &&
    prev.onCancel === next.onCancel &&
    prev.isCancelling === next.isCancelling
  );
}

export const P2POrderCard = memo(P2POrderCardInner, orderCardPropsEqual);
P2POrderCard.displayName = 'P2POrderCard';
