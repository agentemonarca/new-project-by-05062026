import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store } from 'lucide-react';
import { fetchMarketplaceItems } from '../api/marketplaceApi.js';
import { SmartProductCard } from '../components/SmartProductCard.jsx';
import { MarketplaceQuickBuyModal } from '../components/MarketplaceQuickBuyModal.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import { normalizeMarketplaceItems } from '../marketplace/normalize.js';
import { sortMarketplaceProducts, STANDALONE_CORE_SNAPSHOT } from '../marketplace/impactEngine.js';

/** Community strip — same ROI sort as dashboard (standalone core when outside CoreProvider). */
export function MarketplaceCommunitySection() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalProduct, setModalProduct] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchMarketplaceItems()
      .then((rows) => {
        if (!cancelled) setRaw(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => {
    const normalized = normalizeMarketplaceItems(raw);
    return sortMarketplaceProducts(normalized, STANDALONE_CORE_SNAPSHOT).slice(0, 6);
  }, [raw]);

  const openQuickBuy = useCallback((p) => setModalProduct(p), []);
  const closeModal = useCallback(() => setModalProduct(null), []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="col-span-12 mt-2"
    >
      <div className="mb-4 flex items-center gap-2">
        <Store className="h-5 w-5 text-fuchsia-400" strokeWidth={1.75} />
        <h3 className="font-display text-base font-semibold tracking-tight text-white">Marketplace Comunidad</h3>
        <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-200/90">
          Live
        </span>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-hidden pb-2">
          {[1, 2, 3].map((k) => (
            <div
              key={k}
              className="h-[280px] w-[260px] shrink-0 animate-pulse rounded-2xl border border-white/10 bg-slate-900/60"
            />
          ))}
        </div>
      ) : (
        <div className="-mx-1 flex gap-4 overflow-x-auto overflow-y-visible px-1 pb-3 pt-1 [scrollbar-width:thin]">
          {items.map((product, i) => (
            <div key={product.id} className="min-w-[280px] shrink-0">
              <SmartProductCard product={product} sortedIndex={i} compact onQuickBuy={openQuickBuy} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-center sm:justify-start">
        <GradientButton
          type="button"
          className="!rounded-2xl !px-6 !py-3 !text-sm font-semibold shadow-[0_0_24px_rgba(139,92,246,0.35)]"
          onClick={() => navigate('/marketplace')}
        >
          Ver más ofertas
        </GradientButton>
      </div>
      <MarketplaceQuickBuyModal open={modalProduct != null} product={modalProduct} onClose={closeModal} />
    </motion.section>
  );
}
