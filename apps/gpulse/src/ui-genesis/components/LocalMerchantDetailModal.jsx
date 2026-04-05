import { motion, AnimatePresence } from 'framer-motion';
import {
  BadgeCheck,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  ShoppingBag,
  Star,
  Store,
  Tag,
  X,
} from 'lucide-react';
import { formatDistanceKm, isMerchantOpenNow } from '../local-marketplace/geo.js';

/**
 * @param {{
 *   open: boolean,
 *   merchant: (import('../local-marketplace/mockMerchants.js').LocalMerchant & { distanceKm?: number | null }) | null,
 *   isFavorite: boolean,
 *   onClose: () => void,
 *   onToggleFavorite: () => void,
 *   onOpenMaps: () => void,
 *   onBuyProduct: (product: import('../local-marketplace/mockMerchants.js').LocalProduct) => void,
 *   balanceAIG: number,
 *   balanceUSD: number,
 * }} props
 */
export function LocalMerchantDetailModal({
  open,
  merchant,
  isFavorite,
  onClose,
  onToggleFavorite,
  onOpenMaps,
  onBuyProduct,
  balanceAIG,
  balanceUSD,
}) {
  if (!merchant) return null;

  const openNow = isMerchantOpenNow(merchant.schedule);
  const kindLabel = merchant.kind === 'store' ? 'Store · multi-product' : 'Offer · single product';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
            aria-label="Close"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="local-merchant-title"
            className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-violet-500/35 bg-slate-950 shadow-[0_24px_100px_-24px_rgba(139,92,246,0.55)]"
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="relative h-36 shrink-0 overflow-hidden border-b border-white/10 sm:h-44">
              <img src={merchant.coverImage} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/40 p-2 text-white backdrop-blur-sm"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-3 left-4 flex items-end gap-3">
                <img
                  src={merchant.logo}
                  alt=""
                  className="h-14 w-14 rounded-xl border border-white/20 bg-slate-900 object-cover shadow-lg"
                />
                <div className="pb-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        merchant.acceptsAIG
                          ? 'bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40'
                          : 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/35'
                      }`}
                    >
                      {merchant.acceptsAIG ? 'Accepts AIG' : 'No AIG'}
                    </span>
                    {merchant.verified ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-400/35">
                        <BadgeCheck className="h-3 w-3" />
                        Verified
                      </span>
                    ) : null}
                  </div>
                  <h2 id="local-merchant-title" className="mt-1 font-display text-xl font-bold text-white">
                    {merchant.name}
                  </h2>
                  <p className="text-[11px] text-slate-400">{kindLabel}</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 font-mono text-amber-200/95">
                  <Star className="h-4 w-4 text-amber-400" fill="currentColor" />
                  {merchant.rating.toFixed(1)}
                  <span className="text-slate-500">({merchant.reviewCount})</span>
                </span>
                <span className="text-slate-500">·</span>
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                  {formatDistanceKm(merchant.distanceKm ?? null)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    openNow ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {openNow ? 'Open now' : 'Closed'}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-slate-300">{merchant.description}</p>

              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
                <p className="flex items-start gap-2 text-slate-300">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                  {merchant.address}
                </p>
                {(merchant.pricing?.usd != null || merchant.pricing?.aig != null) && (
                  <p className="mt-2 flex items-center gap-2 font-mono text-slate-400">
                    <Tag className="h-3.5 w-3.5 text-fuchsia-400" />
                    {merchant.pricing.label ? `${merchant.pricing.label}: ` : 'From '}
                    {merchant.pricing.aig ? (
                      <span className="text-cyan-200">{merchant.pricing.aig} AIG</span>
                    ) : null}
                    {merchant.pricing.aig && merchant.pricing.usd ? <span className="text-slate-600">/</span> : null}
                    {merchant.pricing.usd != null ? (
                      <span className="text-violet-200">${merchant.pricing.usd}</span>
                    ) : null}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onOpenMaps}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Maps
                </button>
                <button
                  type="button"
                  onClick={onToggleFavorite}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold ${
                    isFavorite
                      ? 'border-rose-400/50 bg-rose-500/15 text-rose-100'
                      : 'border-white/15 bg-white/5 text-slate-200'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                  Save
                </button>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Store className="h-3.5 w-3.5" />
                  {merchant.kind === 'store' ? 'Products' : 'Offer'}
                </h3>
                <ul className="space-y-3">
                  {merchant.products.map((p) => {
                    const canAig = merchant.acceptsAIG && p.priceAIG > 0;
                    const shortCash = p.priceUSD > balanceUSD;
                    const shortAig = canAig && p.priceAIG > balanceAIG;
                    return (
                      <li
                        key={p.id}
                        className="flex gap-3 rounded-xl border border-white/10 bg-slate-900/50 p-3"
                      >
                        {p.image ? (
                          <img src={p.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                            <ShoppingBag className="h-6 w-6 text-slate-600" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white">{p.name}</p>
                          <p className="mt-0.5 font-mono text-xs text-slate-400">
                            {p.priceAIG > 0 ? (
                              <span className="text-cyan-200/90">{p.priceAIG} AIG</span>
                            ) : (
                              <span className="text-slate-500">AIG N/A</span>
                            )}
                            <span className="text-slate-600"> · </span>
                            <span className="text-violet-200/90">${p.priceUSD}</span>
                          </p>
                          {(shortCash || shortAig) && (
                            <p className="mt-1 text-[10px] text-amber-200/90">
                              Demo balance low for {shortCash ? 'USD' : ''}{shortCash && shortAig ? ' / ' : ''}
                              {shortAig ? 'AIG' : ''} — still simulates checkout.
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => onBuyProduct(p)}
                            className="mt-2 rounded-lg bg-emerald-600/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-emerald-500"
                          >
                            Buy (simulated)
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {merchant.reviews.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Reviews</h3>
                  <ul className="space-y-2">
                    {merchant.reviews.map((r) => (
                      <li key={r.id} className="rounded-lg border border-white/5 bg-black/25 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-slate-400">{r.author}</span>
                          <span className="text-amber-300">{''.padStart(r.stars, '★')}</span>
                        </div>
                        <p className="mt-1 text-slate-300">{r.text}</p>
                        <p className="mt-1 text-[10px] text-slate-600">{r.at}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
