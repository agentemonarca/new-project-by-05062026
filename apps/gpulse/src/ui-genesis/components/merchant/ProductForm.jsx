import React, { memo, useCallback, useState } from 'react';
import { PackagePlus } from 'lucide-react';

/**
 * @param {{
 *   onSubmit: (values: { name: string, priceUSD: string, priceAIG: string, image: string, description: string }) => void,
 *   disabled?: boolean,
 * }} props
 */
function ProductFormInner({ onSubmit, disabled = false }) {
  const [name, setName] = useState('');
  const [priceUSD, setPriceUSD] = useState('');
  const [priceAIG, setPriceAIG] = useState('');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (disabled) return;
      onSubmit({ name, priceUSD, priceAIG, image, description });
      setName('');
      setPriceUSD('');
      setPriceAIG('');
      setImage('');
      setDescription('');
    },
    [disabled, onSubmit, name, priceUSD, priceAIG, image, description],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-cyan-500/25 bg-slate-950/60 p-5 backdrop-blur-md"
    >
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cyan-200/90">
        <PackagePlus className="h-4 w-4" />
        Add product
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 block text-xs font-medium text-slate-400">
          Product name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="e.g. Signature blend"
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Price (AIG)
          <input
            value={priceAIG}
            onChange={(e) => setPriceAIG(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-cyan-100"
            placeholder="0"
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Price (USD)
          <input
            value={priceUSD}
            onChange={(e) => setPriceUSD(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-violet-100"
            placeholder="0"
          />
        </label>
        <label className="sm:col-span-2 block text-xs font-medium text-slate-400">
          Image URL (optional)
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="https://… Or leave empty for placeholder"
          />
        </label>
        <label className="sm:col-span-2 block text-xs font-medium text-slate-400">
          Description (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full resize-y rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-200"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg disabled:opacity-40"
      >
        Add to store
      </button>
    </form>
  );
}

export const ProductForm = memo(ProductFormInner);
