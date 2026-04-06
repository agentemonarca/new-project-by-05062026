import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, LayoutGrid, MapPin, SlidersHorizontal, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { LivingBackground } from '../backgrounds/LivingBackground.jsx';
import { SmartProductCard } from '../components/SmartProductCard.jsx';
import { MarketplaceQuickBuyModal } from '../components/MarketplaceQuickBuyModal.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import { ProtocolDisclaimer } from '../components/ProtocolDisclaimer.jsx';
import { fetchMarketplaceItems } from '../api/marketplaceApi.js';
import { staggerContainer, fadeUpBlur } from '../motion/variants.js';
import { normalizeMarketplaceItems } from '../marketplace/normalize.js';
import {
  getMarketplaceSocialProofToday,
  getPaymentSplit,
  sortMarketplaceProducts,
  STANDALONE_CORE_SNAPSHOT,
} from '../marketplace/impactEngine.js';
import { executeMarketplaceGrowthPayout } from '../marketplace/marketplaceGrowthRewards.js';
import { applyHybridPurchaseSideEffects, tickHybridFintechState } from '../marketplace/hybridPaymentIntegration.js';
import { HybridFintechPanel } from '../components/HybridFintechPanel.jsx';
import { useOptionalCore } from '../core/CoreContext.jsx';

const TABS = [
  { label: 'All', filter: null },
  { label: 'Tech', filter: 'tech' },
  { label: 'Lifestyle', filter: 'lifestyle' },
  { label: 'Luxury', filter: 'luxury' },
];

function HeroMomentumBar({ value, reduceMotion }) {
  const w = Math.min(100, Math.max(0, value));
  return (
    <div className="mt-4 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-slate-900/90 ring-1 ring-white/10">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 shadow-[0_0_18px_rgba(139,92,246,0.45)]"
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${w}%` }}
        transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/** Full marketplace — sorted by ROI; quick-buy modal; works with or without CoreProvider. */
export default function MarketplacePage() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [modalProduct, setModalProduct] = useState(null);
  const listingsRef = useRef(null);
  const reduceMotion = useReducedMotion();

  const ctx = useOptionalCore();
  const core = ctx ?? STANDALONE_CORE_SNAPSHOT;

  const socialToday = useMemo(() => getMarketplaceSocialProofToday('gpulse-market'), []);
  const heroMomentumPct = useMemo(() => 55 + (socialToday.activations % 34), [socialToday.activations]);

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

  const filteredSorted = useMemo(() => {
    const normalized = normalizeMarketplaceItems(raw);
    const tab = TABS[activeTab];
    const legacy = tab?.filter;
    const subset =
      !legacy
        ? normalized
        : normalized.filter((p) => (p.legacyCategory || '').toLowerCase() === legacy);
    return sortMarketplaceProducts(subset, core);
  }, [raw, activeTab, core]);

  const openQuickBuy = useCallback((p) => setModalProduct(p), []);
  const closeModal = useCallback(() => setModalProduct(null), []);

  const confirmProtocolPurchase = useCallback(
    (product) => {
      const internalAig = Number(core?.aigBalance ?? STANDALONE_CORE_SNAPSHOT.aigBalance);
      const ledgerUsdt = Number(core?.claimUi?.ledgerNetUsdt);
      const internalUsdt = Number.isFinite(ledgerUsdt) && ledgerUsdt > 0 ? ledgerUsdt : undefined;
      const purchaseId = `prot-${product.id}-${Date.now()}`;
      const split = getPaymentSplit(product, { internalAigBalance: internalAig, internalUsdtBalance: internalUsdt });
      executeMarketplaceGrowthPayout({
        purchaseId,
        productLabel: product.title,
        grossUsd: split.usdtAmount,
        grossAig: split.aigAmount,
        isStakingVolumeRule: product.category === 'staking',
        core: ctx ?? undefined,
        txHash: `sim-${purchaseId}`,
        recordMarketplacePurchaseLedger: true,
        aigPriceUsd: split.plan.aigPriceUsd,
      });
      applyHybridPurchaseSideEffects({
        purchaseId,
        merchantId: 'protocol-catalog',
        merchantName: 'AiGenesis Marketplace',
        usd: split.usdtAmount,
        aig: split.aigAmount,
      });
      tickHybridFintechState();
      closeModal();
    },
    [core, ctx, closeModal],
  );

  const goHome = () => {
    navigate('/');
  };

  const scrollToListings = () => {
    listingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="relative min-h-screen font-display text-slate-200">
      <LivingBackground />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-8">
          <button
            type="button"
            onClick={goHome}
            className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-500/30 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </button>

          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-3xl border border-violet-500/35 bg-slate-950/75 px-6 py-10 shadow-[0_0_0_1px_rgba(34,211,238,0.1),0_20px_80px_-20px_rgba(139,92,246,0.45)] backdrop-blur-xl md:px-12 md:py-12"
          >
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-fuchsia-600/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl" />

            <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                  <LayoutGrid className="h-3.5 w-3.5 text-cyan-300" strokeWidth={2} />
                  Marketplace
                </div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                  Boost your production
                </h1>
                <p className="text-base leading-relaxed text-slate-300 md:text-lg">
                  <span className="font-semibold text-white">Generate</span> higher base output,{' '}
                  <span className="font-semibold text-emerald-200">earn</span> more AIG per day, and{' '}
                  <span className="font-semibold text-fuchsia-200">boost</span> yields with flexible AIG + USDT
                  checkout — built to feel like a high-value opportunity, not a generic shop.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <GradientButton type="button" onClick={scrollToListings} className="!rounded-2xl !px-6 !py-3 !text-sm">
                    <TrendingUp className="h-4 w-4" />
                    Start earning
                  </GradientButton>
                  <button
                    type="button"
                    onClick={scrollToListings}
                    className="rounded-2xl border border-violet-400/40 bg-violet-500/10 px-6 py-3 text-sm font-bold uppercase tracking-wide text-violet-100 shadow-[0_0_24px_rgba(139,92,246,0.25)] transition hover:border-violet-300/60 hover:bg-violet-500/20"
                  >
                    Activate now
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/marketplace/local')}
                    className="rounded-2xl border border-cyan-400/35 bg-cyan-500/10 px-6 py-3 text-sm font-bold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15"
                  >
                    <MapPin className="mr-2 inline h-4 w-4" strokeWidth={2} />
                    Near me (map)
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/marketplace/merchant')}
                    className="rounded-2xl border border-violet-400/35 bg-violet-500/10 px-6 py-3 text-sm font-bold uppercase tracking-wide text-violet-100 transition hover:border-violet-300/50 hover:bg-violet-500/15"
                  >
                    Sell on local map
                  </button>
                </div>
                <HeroMomentumBar value={heroMomentumPct} reduceMotion={reduceMotion} />
              </div>

              <div className="relative z-10 w-full max-w-md shrink-0 rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/30 to-rose-500/20 ring-1 ring-amber-400/30">
                    <Zap className="h-5 w-5 text-amber-200" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-200/90">Live demand</p>
                    <p className="mt-1 text-sm font-medium text-slate-200">
                      <span className="font-mono font-bold text-white">{socialToday.activations.toLocaleString()}</span>{' '}
                      users activated today
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                      <Sparkles className="inline h-3.5 w-3.5 text-fuchsia-300" />
                      Limited slots ·{' '}
                      <span className="font-mono font-semibold text-rose-200">{socialToday.slotsLeft}</span> openings
                      left in this wave
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </div>

        <section className="mb-8">
          <HybridFintechPanel />
        </section>

        <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">
            Sorted by fastest payback — every card shows daily earn, boost %, and urgency.
          </p>
          <GradientButton
            type="button"
            variant="ghost"
            className="!rounded-2xl border border-white/10 !text-xs"
            disabled
            title="Advanced filters — coming soon"
          >
            <SlidersHorizontal className="mr-2 inline h-4 w-4" />
            Filters (soon)
          </GradientButton>
        </header>

        <div ref={listingsRef} id="marketplace-offers" className="scroll-mt-8">
          <div className="mb-8 flex flex-wrap gap-2">
            {TABS.map(({ label }, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                  activeTab === i
                    ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6].map((k) => (
                <div key={k} className="h-[360px] animate-pulse rounded-2xl border border-white/10 bg-slate-900/50" />
              ))}
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {filteredSorted.map((product, i) => (
                <motion.div key={product.id} variants={fadeUpBlur}>
                  <SmartProductCard product={product} sortedIndex={i} onQuickBuy={openQuickBuy} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        <div className="mt-10 space-y-4">
          <ProtocolDisclaimer variant="compact" className="mx-auto max-w-2xl text-center" />
          <p className="text-center text-xs text-slate-500">
            Demo catalogue — projected earn uses the shared impact engine; on-chain checkout can replace simulation.
          </p>
        </div>
      </div>
      <MarketplaceQuickBuyModal
        open={modalProduct != null}
        product={modalProduct}
        onClose={closeModal}
        onConfirm={confirmProtocolPurchase}
      />
    </div>
  );
}
