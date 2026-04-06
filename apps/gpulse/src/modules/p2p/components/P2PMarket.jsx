import React, { memo, useCallback, useMemo, useState } from 'react';
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
  const { orders, createOrder, executeOrder, mockUser, setMockUser } = useP2POrders();

  const [toast, setToast] = useState(/** @type {{ type: 'ok'|'err', text: string } | null} */ (null));

  const onSubmit = useCallback(
    (payload) => {
      const res = createOrder(payload);
      if (!res.ok) {
        setToast({ type: 'err', text: res.error ?? 'No se pudo crear la orden' });
        return;
      }
      setToast({ type: 'ok', text: 'Orden publicada (mock). Aparece en el libro.' });
    },
    [createOrder],
  );

  const onExecute = useCallback(
    (id) => {
      const res = executeOrder(id);
      if (!res.ok) setToast({ type: 'err', text: res.error ?? 'Ejecución no disponible' });
      else setToast({ type: 'ok', text: 'Orden marcada como ejecutada (simulación).' });
    },
    [executeOrder],
  );

  const setBuyTab = useCallback(() => setTab('buy'), []);
  const setSellTab = useCallback(() => setTab('sell'), []);

  const toggleProfile = useCallback(() => setMockUser({ hasProfile: !mockUser.hasProfile }), [mockUser.hasProfile, setMockUser]);
  const toggleMining = useCallback(() => setMockUser({ hasMining: !mockUser.hasMining }), [mockUser.hasMining, setMockUser]);

  const listFilter = useMemo(() => (tab === 'buy' ? 'sell' : 'buy'), [tab]);
  const listHint = useMemo(
    () =>
      tab === 'buy'
        ? 'Ofertas de venta — tú compras AIG al precio publicado.'
        : 'Ofertas de compra — tú vendes AIG al precio publicado.',
    [tab],
  );

  return (
    <section className={`space-y-5 ${className}`.trim()}>
      <GlassCard className="border-violet-500/20" contentClassName="p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/80">AiGenesis · AIG P2P</p>
            <h2 className="mt-1 font-display text-xl font-bold text-white md:text-2xl">Libro regulado (preview)</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Precio sugerido <span className="font-mono text-cyan-200/90">${suggested}</span> · banda admin{' '}
              <span className="font-mono text-slate-300">
                ${min} – ${max}
              </span>{' '}
              · base <span className="font-mono">${base}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-slate-500">Demo usuario (mock)</span>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={mockUser.hasProfile} onChange={toggleProfile} className="rounded border-white/20" />
              Perfil completo
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={mockUser.hasMining} onChange={toggleMining} className="rounded border-white/20" />
              Minería activa (ventas)
            </label>
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <P2POrderForm side={tab} onSubmit={onSubmit} />
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{listHint}</p>
          <P2POrderList orders={orders} sideFilter={listFilter} onExecute={onExecute} />
        </div>
      </div>
    </section>
  );
}

export const P2PMarket = memo(P2PMarketInner);
P2PMarket.displayName = 'P2PMarket';
