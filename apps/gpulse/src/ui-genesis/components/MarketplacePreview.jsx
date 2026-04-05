import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCore } from '../core/CoreContext.jsx';
import { fetchMarketplaceItems } from '../api/marketplaceApi.js';
import { normalizeMarketplaceItems } from '../marketplace/normalize.js';
import { sortMarketplaceProducts, productAlignsWithNextAction } from '../marketplace/impactEngine.js';
import { SmartProductCard } from './SmartProductCard.jsx';
import { MarketplaceQuickBuyModal } from './MarketplaceQuickBuyModal.jsx';

const PREVIEW_COUNT = 4;

/**
 * Dashboard strip: top offers by ROI (not random), quick-buy modal, NextAction alignment hint.
 * @param {{ onViewAll?: () => void }} props
 */
export function MarketplacePreview({ onViewAll }) {
  const core = useCore();
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalProduct, setModalProduct] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchMarketplaceItems()
      .then((rows) => {
        if (!cancelled) setRaw(rows);
      })
      .catch(() => {
        if (!cancelled) setRaw([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const optimized = useMemo(() => {
    const normalized = normalizeMarketplaceItems(raw);
    return sortMarketplaceProducts(normalized, core).slice(0, PREVIEW_COUNT);
  }, [raw, core]);

  const nextAligned = useMemo(() => optimized.find((p) => productAlignsWithNextAction(p, core)), [optimized, core]);

  const openQuickBuy = useCallback((product) => setModalProduct(product), []);
  const closeModal = useCallback(() => setModalProduct(null), []);

  return (
    <>
      {nextAligned ? (
        <p className="mb-3 text-[11px] text-cyan-200/90">
          Next-step match: <span className="font-semibold text-white">{nextAligned.title}</span> — aligned with your protocol focus.
        </p>
      ) : null}
      <div className="-mx-1 flex gap-4 overflow-x-auto pb-2 pt-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-4">
        {loading
          ? [1, 2, 3, 4].map((k) => (
              <div key={k} className="h-[320px] min-w-[260px] animate-pulse rounded-2xl border border-white/10 bg-slate-900/50 md:min-w-0" />
            ))
          : optimized.map((product, i) => (
              <div key={product.id} className="min-w-[280px] shrink-0 md:min-w-0">
                <SmartProductCard product={product} sortedIndex={i} compact onQuickBuy={openQuickBuy} />
              </div>
            ))}
      </div>
      <MarketplaceQuickBuyModal open={modalProduct != null} product={modalProduct} onClose={closeModal} />
    </>
  );
}
