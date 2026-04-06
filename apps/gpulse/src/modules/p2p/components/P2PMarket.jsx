import React, { memo, useCallback, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { GlassCard } from '@/ui-genesis/components/GlassCard.jsx';
import { useAigPrice } from '../hooks/useAigPrice.js';
import { useP2POrders } from '../hooks/useP2POrders.js';
import { P2POrderForm } from './P2POrderForm.jsx';
import { P2POrderList } from './P2POrderList.jsx';

const TAB_BTN =
  'rounded-lg px-5 py-2.5 text-sm font-bold tracking-wide transition-all md:px-7';

/**
 * @param {{ className?: string }} props
 */
function P2PMarketInner({ className = '' }) {
  const [tab, setTab] = useState(/** @type {'buy'|'sell'} */ ('buy'));
  const { base, min, max, suggested } = useAigPrice();

  const listFilter = useMemo(() => (tab === 'buy' ? 'sell' : 'buy'), [tab]);
  const {
    useBackend,
    canOperate,
    orders,
    myOrders,
    createOrder,
    executeOrder,
    cancelOrder,
    bookLoading,
    bookError,
    refreshBook,
    submittingOrder,
    executingId,
    cancellingId,
  } = useP2POrders(listFilter);

  const [toast, setToast] = useState(/** @type {{ type: 'ok'|'err', text: string } | null} */ (null));

  const onSubmit = useCallback(
    async (payload) => {
      const res = await createOrder(payload);
      if (!res.ok) {
        setToast({ type: 'err', text: res.error ?? 'No se pudo crear la orden' });
        return res;
      }
      setToast({
        type: 'ok',
        text: useBackend ? 'Orden enviada al servidor.' : 'Orden añadida (demo en memoria).',
      });
      return res;
    },
    [createOrder, useBackend],
  );

  const onExecute = useCallback(
    async (id) => {
      const res = await executeOrder(id);
      if (!res.ok) setToast({ type: 'err', text: res.error ?? 'No se pudo ejecutar' });
      else
        setToast({
          type: 'ok',
          text: useBackend ? 'Operación registrada correctamente.' : 'Operación simulada (demo).',
        });
    },
    [executeOrder, useBackend],
  );

  const onCancel = useCallback(
    async (id) => {
      const res = await cancelOrder(id);
      if (!res.ok) setToast({ type: 'err', text: res.error ?? 'No se pudo cancelar' });
      else setToast({ type: 'ok', text: 'Orden cancelada.' });
    },
    [cancelOrder],
  );

  const setBuyTab = useCallback(() => setTab('buy'), []);
  const setSellTab = useCallback(() => setTab('sell'), []);

  const listHint = useMemo(
    () =>
      tab === 'buy'
        ? 'Ofertas de venta — tú compras AIG al precio publicado.'
        : 'Ofertas de compra — tú vendes AIG al precio publicado.',
    [tab],
  );

  const emptyHint = bookLoading
    ? 'Cargando libro…'
    : bookError
      ? `No se pudo cargar el libro. ${bookError}`
      : 'No hay órdenes en este lado del libro.';

  const title = useBackend ? 'Libro P2P (core-api)' : 'Libro P2P (demo local)';
  const subtitle = useBackend
    ? 'Datos en vivo desde el backend. Asegúrate de tener saldo y permisos (p. ej. minería activa para ventas).'
    : 'Modo demostración: órdenes solo en esta pestaña (sin MongoDB). Activa VITE_P2P_USE_BACKEND=true para producción.';

  return (
    <section className={`space-y-5 ${className}`.trim()}>
      {!useBackend ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span className="font-semibold">Modo demostración.</span> Define{' '}
          <span className="font-mono">VITE_P2P_USE_BACKEND=true</span> en <span className="font-mono">.env</span> y
          configura <span className="font-mono">VITE_API_URL</span> hacia core-api para el libro real.
        </div>
      ) : null}

      <GlassCard className="border-violet-500/20" contentClassName="p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/80">AiGenesis · AIG P2P</p>
            <h2 className="mt-1 font-display text-xl font-bold text-white md:text-2xl">{title}</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Precio sugerido <span className="font-mono text-cyan-200/90">${suggested}</span> · banda UI{' '}
              <span className="font-mono text-slate-300">
                ${min} – ${max}
              </span>{' '}
              · base <span className="font-mono">${base}</span>
            </p>
            <p className="mt-2 text-[11px] text-emerald-200/85">{subtitle}</p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void refreshBook()}
              disabled={bookLoading || (useBackend && !canOperate)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-950/50 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-40"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${bookLoading ? 'animate-spin' : ''}`} strokeWidth={2} />
              Actualizar libro
            </button>
          </div>
        </div>

        <div className="mt-5 inline-flex rounded-xl border border-white/12 bg-slate-950/40 p-1">
          <button
            type="button"
            onClick={setBuyTab}
            className={`${TAB_BTN} ${
              tab === 'buy'
                ? 'bg-gradient-to-r from-cyan-500/40 via-violet-500/35 to-fuchsia-500/35 text-white shadow-[0_0_20px_rgba(34,211,238,0.15)]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Comprar AIG
          </button>
          <button
            type="button"
            onClick={setSellTab}
            className={`${TAB_BTN} ${
              tab === 'sell'
                ? 'bg-gradient-to-r from-cyan-500/40 via-violet-500/35 to-fuchsia-500/35 text-white shadow-[0_0_20px_rgba(34,211,238,0.15)]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Vender AIG
          </button>
        </div>
      </GlassCard>

      {toast ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            toast.type === 'ok'
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-500/35 bg-rose-500/10 text-rose-100'
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      {!canOperate && useBackend ? (
        <div className="rounded-xl border border-slate-500/35 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
          Inicia sesión en Genesis para ver el libro y publicar órdenes contra el core-api.
        </div>
      ) : null}

      {!canOperate && !useBackend ? (
        <div className="rounded-xl border border-slate-500/35 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
          Conecta tu wallet para usar el modo demostración local.
        </div>
      ) : null}

      {myOrders.length > 0 ? (
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tus órdenes activas</p>
          <P2POrderList
            orders={myOrders}
            sideFilter="all"
            onExecute={undefined}
            onCancel={onCancel}
            showCancelOwned
            emptyHint="Sin órdenes activas."
            cancellingId={cancellingId}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <P2POrderForm side={tab} onSubmit={onSubmit} submitting={submittingOrder} disabled={!canOperate} />
        <div className="relative">
          {bookLoading ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end pt-2 pr-2">
              <span className="rounded-lg border border-cyan-500/30 bg-slate-950/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-100">
                Sincronizando…
              </span>
            </div>
          ) : null}
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{listHint}</p>
          <P2POrderList
            orders={orders}
            sideFilter={listFilter}
            onExecute={canOperate ? onExecute : undefined}
            emptyHint={emptyHint}
            executingId={executingId}
          />
        </div>
      </div>
    </section>
  );
}

export const P2PMarket = memo(P2PMarketInner);
P2PMarket.displayName = 'P2PMarket';
