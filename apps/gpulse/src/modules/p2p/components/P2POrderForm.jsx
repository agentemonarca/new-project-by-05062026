import React, { memo, useCallback, useMemo, useState } from 'react';
import { GlassCard } from '@/ui-genesis/components/GlassCard.jsx';
import { GradientButton } from '@/ui-genesis/components/GradientButton.jsx';
import { useAigPrice } from '../hooks/useAigPrice.js';
import { useP2PValidation } from '../hooks/useP2PValidation.js';

/**
 * @typedef {import('../store/p2pOrdersStore.js').P2PSide} P2PSide
 */

/**
 * @param {{
 *   side: P2PSide,
 *   onSubmit: (payload: { side: P2PSide, priceUsd: number, amountAig: number }) => void,
 *   disabled?: boolean,
 * }} props
 */
function P2POrderFormInner({ side, onSubmit, disabled = false }) {
  const { base, min, max, suggested } = useAigPrice();
  const { validatePrice, validateAmount, validateUser, validateLimits } = useP2PValidation();

  const [price, setPrice] = useState(() => String(suggested));
  const [amount, setAmount] = useState('');
  const [touched, setTouched] = useState(false);

  const priceErr = useMemo(() => {
    if (!touched && price === '') return '';
    return validatePrice(Number(price)).message;
  }, [price, touched, validatePrice]);

  const amountErr = useMemo(() => {
    if (!touched && amount === '') return '';
    return validateAmount(Number(amount)).message;
  }, [amount, touched, validateAmount]);

  const userErr = useMemo(() => validateUser(side).message, [side, validateUser]);

  const limitsErr = useMemo(() => {
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) return '';
    return validateLimits(side, a).message;
  }, [amount, side, validateLimits]);

  const applySuggested = useCallback(() => {
    setPrice(String(suggested));
    setTouched(true);
  }, [suggested]);

  const applyBase = useCallback(() => {
    setPrice(String(base));
    setTouched(true);
  }, [base]);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setTouched(true);
      const p = Number(price);
      const a = Number(amount);
      const checks = [validateUser(side), validatePrice(p), validateAmount(a), validateLimits(side, a)];
      if (checks.some((c) => !c.ok)) return;
      onSubmit({ side, priceUsd: p, amountAig: a });
      setAmount('');
    },
    [amount, onSubmit, price, side, validateAmount, validateLimits, validatePrice, validateUser],
  );

  const blockMsg = userErr || limitsErr;

  return (
    <GlassCard className="border-cyan-500/20 bg-slate-950/55" contentClassName="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            AIG referencia: <span className="font-mono text-cyan-200/90">${base}</span>
          </span>
          <span className="font-mono text-slate-300">
            Rango permitido ${min} – ${max}
          </span>
        </div>
        <div>
          <label htmlFor="p2p-price" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Precio (USD / AIG)
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              id="p2p-price"
              type="number"
              step="0.01"
              min={min}
              max={max}
              value={price}
              onChange={(ev) => {
                setPrice(ev.target.value);
                setTouched(true);
              }}
              className="min-w-[8rem] flex-1 rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white outline-none ring-cyan-400/0 focus:border-cyan-500/40 focus:ring-2"
            />
            <button
              type="button"
              onClick={applySuggested}
              className="rounded-lg border border-violet-500/35 bg-violet-500/10 px-3 py-2 text-[11px] font-semibold text-violet-100 transition hover:bg-violet-500/15"
            >
              Sugerido ${suggested}
            </button>
            <button
              type="button"
              onClick={applyBase}
              className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.08]"
            >
              Base ${base}
            </button>
          </div>
          {priceErr ? <p className="mt-1 text-xs text-rose-300/95">{priceErr}</p> : null}
        </div>
        <div>
          <label htmlFor="p2p-amount" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Cantidad (AIG)
          </label>
          <input
            id="p2p-amount"
            type="number"
            step="1"
            min={0}
            value={amount}
            onChange={(ev) => {
              setAmount(ev.target.value);
              setTouched(true);
            }}
            className="mt-1 w-full rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-400/30"
            placeholder="Ej. 500"
          />
          {amountErr ? <p className="mt-1 text-xs text-rose-300/95">{amountErr}</p> : null}
        </div>
        {blockMsg ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">{blockMsg}</p> : null}
        <GradientButton
          type="submit"
          disabled={disabled || Boolean(userErr)}
          className="!w-full !justify-center !py-2.5 !text-sm !font-semibold disabled:opacity-40"
        >
          Publicar orden {side === 'buy' ? 'de compra' : 'de venta'}
        </GradientButton>
      </form>
    </GlassCard>
  );
}

export const P2POrderForm = memo(P2POrderFormInner);
P2POrderForm.displayName = 'P2POrderForm';
