import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Crosshair,
  Filter,
  Heart,
  History,
  LayoutList,
  Map as MapIcon,
  MapPin,
  Navigation,
  Wallet,
} from 'lucide-react';
import { LivingBackground } from '../backgrounds/LivingBackground.jsx';
import { LocalMerchantMap } from '../components/LocalMerchantMap.jsx';
import { LocalMerchantDetailModal } from '../components/LocalMerchantDetailModal.jsx';
import { HybridFintechPanel } from '../components/HybridFintechPanel.jsx';
import { applyHybridPurchaseSideEffects, tickHybridFintechState } from '../marketplace/hybridPaymentIntegration.js';
import { useOptionalWallet } from '../../context/WalletContext.jsx';
import {
  MERCHANT_CATEGORIES,
  applyLocalMerchantFilters,
  formatDistanceKm,
  isMerchantOpenNow,
  useMergedLocalMerchants,
} from '../local-marketplace/index.js';
import {
  buildMarketplaceRevenueLedgerRaws,
  buildRevenueEligibilitySnapshotFromCore,
  calculateMarketplaceRevenueDistribution,
  defaultBinaryVolumePtsFromGross,
} from '../marketplace/revenueDistribution.js';
import { executeMarketplaceGrowthPayout } from '../marketplace/marketplaceGrowthRewards.js';
import { useOptionalCore } from '../core/CoreContext.jsx';
import { useLocalMarketplaceUserStore } from '../stores/localMarketplaceUserStore.js';
import { usePaymentLedgerStore } from '../stores/paymentLedgerStore.js';
import { MerchantOnboarding } from '../components/merchant/MerchantOnboarding.jsx';
import { getAigPriceUsd } from '../payment/dualTokenPayment.js';
import { getPaymentSplit } from '../payment/paymentRuleEngine.js';

const DISTANCE_OPTIONS = [
  { label: 'Any distance', value: null },
  { label: '1 km', value: 1 },
  { label: '3 km', value: 3 },
  { label: '5 km', value: 5 },
  { label: '15 km', value: 15 },
];

const ACTIVITY_BADGE = /** @type {const} */ ({
  hot: 'bg-rose-500/20 text-rose-100 ring-rose-400/35',
  busy: 'bg-amber-500/20 text-amber-100 ring-amber-400/35',
  quiet: 'bg-slate-700/80 text-slate-300 ring-white/10',
});

/**
 * Near-me economy: map + list, filters, merchant profile, mock Web3 checkout.
 */
export default function LocalMarketplacePage() {
  const wallet = useOptionalWallet();
  const core = useOptionalCore();
  const userLat = useLocalMarketplaceUserStore((s) => s.userLat);
  const userLng = useLocalMarketplaceUserStore((s) => s.userLng);
  const locationLabel = useLocalMarketplaceUserStore((s) => s.locationLabel);
  const balanceAIG = useLocalMarketplaceUserStore((s) => s.balanceAIG);
  const balanceUSD = useLocalMarketplaceUserStore((s) => s.balanceUSD);
  const walletSnapshot = useLocalMarketplaceUserStore((s) => s.walletAddress);
  const favorites = useLocalMarketplaceUserStore((s) => s.favorites);
  const setWalletSnapshot = useLocalMarketplaceUserStore((s) => s.setWalletSnapshot);
  const setUserLocation = useLocalMarketplaceUserStore((s) => s.setUserLocation);
  const toggleFavorite = useLocalMarketplaceUserStore((s) => s.toggleFavorite);
  const recordPurchase = useLocalMarketplaceUserStore((s) => s.recordPurchase);
  const purchaseHistory = useLocalMarketplaceUserStore((s) => s.purchaseHistory);
  const buyerReferrerWallet = useLocalMarketplaceUserStore((s) => s.buyerReferrerWallet);
  const appendLedgerEvents = usePaymentLedgerStore((s) => s.appendLedgerEvents);

  const [maxDistanceKm, setMaxDistanceKm] = useState(/** @type {number | null} */ (null));
  const [category, setCategory] = useState(/** @type {string | null} */ (null));
  const [aigOnly, setAigOnly] = useState(false);
  const [openNowFilter, setOpenNowFilter] = useState(false);
  const [selectedId, setSelectedId] = useState(/** @type {string | null} */ (null));
  const [detailOpen, setDetailOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(/** @type {'map' | 'list'} */ ('list'));
  const [toast, setToast] = useState(/** @type {string | null} */ (null));
  const [registerBusinessOpen, setRegisterBusinessOpen] = useState(false);
  /** Mobile map tab — when true, merchant detail + register modals must stay closed (single-layer UX). */
  const isMapOpen = useMemo(() => mobilePanel === 'map', [mobilePanel]);

  const allMerchants = useMergedLocalMerchants();

  useEffect(() => {
    setWalletSnapshot(wallet?.address ?? null);
  }, [wallet?.address, setWalletSnapshot]);

  const userLatLng = useMemo(() => ({ lat: userLat, lng: userLng }), [userLat, userLng]);

  const filters = useMemo(
    () => ({
      maxDistanceKm,
      category,
      aigOnly,
      openNow: openNowFilter,
    }),
    [maxDistanceKm, category, aigOnly, openNowFilter],
  );

  const filtered = useMemo(
    () => applyLocalMerchantFilters(allMerchants, filters, userLatLng),
    [allMerchants, filters, userLatLng],
  );

  const selectedMerchant = useMemo(
    () => (selectedId ? filtered.find((m) => m.id === selectedId) ?? allMerchants.find((m) => m.id === selectedId) : null),
    [selectedId, filtered, allMerchants],
  );

  const mapCenter = useMemo(/** @returns {[number, number]} */ () => {
    if (selectedMerchant) return [selectedMerchant.lat, selectedMerchant.lng];
    return [userLat, userLng];
  }, [selectedMerchant, userLat, userLng]);

  const mapZoom = selectedMerchant ? 14 : 11;

  const closeRegisterBusinessModal = useCallback(() => {
    setRegisterBusinessOpen(false);
  }, []);

  /** Opens map panel and clears any stacked modals (detail + onboarding). */
  const openMapPanel = useCallback(() => {
    setDetailOpen(false);
    setRegisterBusinessOpen(false);
    setMobilePanel('map');
  }, []);

  const openListPanel = useCallback(() => {
    setMobilePanel('list');
  }, []);

  /** Register-business modal excludes merchant detail; never both `true`. */
  const openRegisterBusinessModal = useCallback(() => {
    setDetailOpen(false);
    setRegisterBusinessOpen(true);
  }, []);

  /** Merchant detail excludes register modal; never both `true`. */
  const openMerchantDetail = useCallback((id) => {
    setRegisterBusinessOpen(false);
    setSelectedId(id);
    setDetailOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
  }, []);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setToast('Geolocation not available in this browser.');
      window.setTimeout(() => setToast(null), 3200);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation(pos.coords.latitude, pos.coords.longitude, 'GPS');
        setToast('Location updated from device.');
        window.setTimeout(() => setToast(null), 2800);
      },
      () => {
        setToast('Could not read location — check permissions.');
        window.setTimeout(() => setToast(null), 3200);
      },
      { enableHighAccuracy: false, timeout: 12_000 },
    );
  }, [setUserLocation]);

  const onBuyProduct = useCallback(
    (product) => {
      if (!selectedMerchant) return;
      const aigPriceUsd = getAigPriceUsd();
      const plan = getPaymentSplit('gmarket', product.priceUSD, aigPriceUsd, {
        internalAigBalance: balanceAIG,
        internalUsdtBalance: balanceUSD,
      });
      if (!plan.valid) {
        setToast(plan.validationError || 'No se puede completar el checkout (revisa saldos).');
        window.setTimeout(() => setToast(null), 3800);
        return;
      }
      const grossBinaryPts = defaultBinaryVolumePtsFromGross(plan.usdtAmount, plan.aigAmount, aigPriceUsd);
      const entry = recordPurchase({
        merchantId: selectedMerchant.id,
        merchantName: selectedMerchant.name,
        productId: product.id,
        productName: product.name,
        usd: plan.usdtAmount,
        aig: plan.aigAmount,
        binaryPts: grossBinaryPts,
      });

      const eligibilitySnap = buildRevenueEligibilitySnapshotFromCore(core);
      const distribution = calculateMarketplaceRevenueDistribution({
        grossUsd: plan.usdtAmount,
        grossAig: plan.aigAmount,
        grossBinaryPts,
        aigPriceUsd,
        merchantReferrerSnapshot: eligibilitySnap,
        buyerReferrerSnapshot: eligibilitySnap,
      });

      const ts = Date.now();
      const txHash = `sim-mkt-${entry.id}`;
      const merchantReferrerWallet = selectedMerchant.referrerWallet ?? null;
      const raws = buildMarketplaceRevenueLedgerRaws({
        ts,
        txHash,
        purchaseId: entry.id,
        merchantId: selectedMerchant.id,
        merchantName: selectedMerchant.name,
        productName: product.name,
        buyerWallet: wallet?.address ?? null,
        merchantReferrerWallet,
        buyerReferrerWallet,
        distribution,
      });
      appendLedgerEvents(raws);

      const growth = executeMarketplaceGrowthPayout({
        purchaseId: entry.id,
        productLabel: product.name,
        grossUsd: plan.usdtAmount,
        grossAig: plan.aigAmount,
        isStakingVolumeRule: product.volumeRule === 'staking',
        core: core ?? undefined,
        txHash,
        ts,
        aigPriceUsd,
      });

      applyHybridPurchaseSideEffects({
        purchaseId: entry.id,
        merchantId: selectedMerchant.id,
        merchantName: selectedMerchant.name,
        usd: plan.usdtAmount,
        aig: plan.aigAmount,
      });
      tickHybridFintechState();

      const refMsg =
        distribution.merchantReferrerEligible || distribution.buyerReferrerEligible
          ? ' · referral legs paid'
          : ' · referrals skipped → platform pool';
      const growMsg = growth.eligible
        ? ' · binary + 11% direct (growth)'
        : ' · growth skipped (staking/holding/product)';
      setToast(`Purchased · ${product.name} (demo)${refMsg}${growMsg}`);
      window.setTimeout(() => setToast(null), 3600);
      closeDetail();
    },
    [
      selectedMerchant,
      recordPurchase,
      closeDetail,
      core,
      wallet?.address,
      buyerReferrerWallet,
      appendLedgerEvents,
      balanceAIG,
      balanceUSD,
    ],
  );

  const displayWallet = wallet?.address ?? walletSnapshot;

  const favoriteLabels = useMemo(
    () =>
      favorites
        .map((id) => allMerchants.find((m) => m.id === id)?.name)
        .filter(Boolean),
    [favorites, allMerchants],
  );

  return (
    <div className="relative min-h-screen font-display text-slate-200">
      <LivingBackground />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-8">
        <MerchantOnboarding
          mode="modal"
          open={registerBusinessOpen && !detailOpen}
          onClose={closeRegisterBusinessModal}
          defaultLat={userLat}
          defaultLng={userLng}
          onRegistered={(id) => {
            setSelectedId(id);
            setDetailOpen(false);
            setMobilePanel('map');
            setToast('Your business is on the map. Scroll to see the new pin.');
            window.setTimeout(() => setToast(null), 3800);
          }}
        />

        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openRegisterBusinessModal}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-bold uppercase tracking-wide text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:border-emerald-400/60"
            >
              Register your business
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/marketplace/merchant')}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-500/35 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:border-violet-400/50"
            >
              Full merchant hub
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/marketplace')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:border-cyan-500/30 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Protocol marketplace
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white"
            >
              Home
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[11px] font-mono text-cyan-100">
              <Wallet className="h-3.5 w-3.5 text-cyan-400" />
              {displayWallet ? `${String(displayWallet).slice(0, 6)}…${String(displayWallet).slice(-4)}` : 'No wallet'}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-mono text-slate-300">
              <span className="text-slate-500">AIG</span> {Math.round(balanceAIG).toLocaleString()}
              <span className="mx-1.5 text-slate-600">|</span>
              <span className="text-slate-500">USD</span> {balanceUSD.toFixed(0)}
            </div>
          </div>
        </div>

        <section className="mb-6">
          <HybridFintechPanel claimCreditsDemoWallet />
        </section>

        <header className="mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl border border-violet-500/30 bg-slate-950/70 px-6 py-8 shadow-[0_20px_80px_-24px_rgba(139,92,246,0.4)]"
          >
            <div className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-fuchsia-600/20 blur-3xl" />
            <div className="relative z-10 max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/90">Local economy</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">Explore merchants near you</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-400 md:text-base">
                Map-first discovery with AIG-aware pins, distance-sorted lists, and one-tap navigation — Uber meets maps
                meets Web3 checkout (simulated until on-chain rails land).
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Navigation className="h-3.5 w-3.5 text-cyan-500" />
                <span>
                  Your anchor: <span className="font-mono text-slate-300">{locationLabel}</span> ·{' '}
                  <button type="button" onClick={locateMe} className="font-semibold text-cyan-400 hover:underline">
                    Use device location
                  </button>
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openRegisterBusinessModal}
                  className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-300/55 hover:bg-emerald-500/25"
                >
                  Register your business
                </button>
                <button
                  type="button"
                  onClick={() => window.location.assign('/marketplace/merchant')}
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Open full hub
                </button>
              </div>
            </div>
          </motion.div>
        </header>

        {toast ? (
          <div className="fixed bottom-6 left-1/2 z-[100] max-w-md -translate-x-1/2 rounded-xl border border-emerald-500/40 bg-emerald-950/95 px-4 py-3 text-center text-sm text-emerald-100 shadow-xl">
            {toast}
          </div>
        ) : null}

        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 backdrop-blur-md md:flex-row md:flex-wrap md:items-center">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <select
            value={category ?? ''}
            onChange={(e) => setCategory(e.target.value || null)}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
          >
            <option value="">All categories</option>
            {MERCHANT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={maxDistanceKm === null ? '' : String(maxDistanceKm)}
            onChange={(e) => {
              const v = e.target.value;
              setMaxDistanceKm(v === '' ? null : Number(v));
            }}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
          >
            {DISTANCE_OPTIONS.map((o) => (
              <option key={o.label} value={o.value === null ? '' : String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={aigOnly}
              onChange={(e) => setAigOnly(e.target.checked)}
              className="rounded border-white/20 bg-slate-900"
            />
            AIG only
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={openNowFilter}
              onChange={(e) => setOpenNowFilter(e.target.checked)}
              className="rounded border-white/20 bg-slate-900"
            />
            Open now
          </label>
          <span className="text-xs text-slate-600 md:ml-auto">{filtered.length} places match</span>
        </div>

        <details className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45 open:border-cyan-500/25 open:shadow-[0_0_30px_-8px_rgba(34,211,238,0.2)]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
            <History className="h-4 w-4 text-cyan-400" />
            Your Web3 profile (demo)
            <span className="ml-auto text-[11px] font-normal text-slate-500">
              wallet · balance · favorites · purchases · location
            </span>
          </summary>
          <div className="space-y-3 border-t border-white/10 px-4 py-3 text-xs">
            <div className="flex flex-wrap gap-4 text-slate-300">
              <span>
                <span className="text-slate-500">Wallet</span>{' '}
                <span className="font-mono text-cyan-200/90">
                  {displayWallet ? `${String(displayWallet).slice(0, 10)}…` : '—'}
                </span>
              </span>
              <span>
                <span className="text-slate-500">AIG</span> {Math.round(balanceAIG).toLocaleString()}
              </span>
              <span>
                <span className="text-slate-500">USD</span> {balanceUSD.toFixed(2)}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-400">
                <MapPin className="h-3 w-3 text-fuchsia-400" />
                {locationLabel} ({userLat.toFixed(3)}, {userLng.toFixed(3)})
              </span>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wider text-slate-500">
                <Heart className="h-3 w-3 text-rose-400" />
                Favorites ({favoriteLabels.length})
              </p>
              {favoriteLabels.length ? (
                <p className="text-slate-400">{favoriteLabels.join(' · ')}</p>
              ) : (
                <p className="text-slate-600">Save merchants from the detail panel.</p>
              )}
            </div>
            <div>
              <p className="mb-1 font-bold uppercase tracking-wider text-slate-500">Recent purchases</p>
              {purchaseHistory.length === 0 ? (
                <p className="text-slate-600">No demo purchases yet — buy from a merchant card.</p>
              ) : (
                <ul className="max-h-40 space-y-2 overflow-y-auto font-mono text-[11px]">
                  {purchaseHistory.slice(0, 12).map((p) => (
                    <li key={p.id} className="flex flex-wrap justify-between gap-2 border-b border-white/5 pb-2 text-slate-400">
                      <span className="text-slate-300">{p.productName}</span>
                      <span>
                        {p.aig > 0 ? `${p.aig} AIG` : ''}
                        {p.aig > 0 && p.usd > 0 ? ' + ' : ''}
                        {p.usd > 0 ? `$${p.usd}` : ''}
                        {p.binaryPts != null && p.binaryPts > 0 ? ` · ${p.binaryPts} pts` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </details>

        <div className="mb-4 flex gap-2 lg:hidden">
          <button
            type="button"
            onClick={openMapPanel}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold ${
              isMapOpen
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
                : 'border-white/10 bg-white/5 text-slate-400'
            }`}
          >
            <MapIcon className="h-4 w-4" />
            Map
          </button>
          <button
            type="button"
            onClick={openListPanel}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold ${
              mobilePanel === 'list'
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
                : 'border-white/10 bg-white/5 text-slate-400'
            }`}
          >
            <LayoutList className="h-4 w-4" />
            List
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className={(isMapOpen ? 'block' : 'hidden') + ' lg:block'}>
            <LocalMerchantMap
              merchants={filtered}
              mapCenter={mapCenter}
              zoom={mapZoom}
              selectedId={selectedId}
              onSelect={(id) => openMerchantDetail(id)}
            />
            <button
              type="button"
              onClick={locateMe}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              <Crosshair className="h-4 w-4 text-cyan-400" />
              Recenter on me
            </button>
          </div>

          <div
            className={
              (mobilePanel === 'list' ? 'block' : 'hidden') +
              ' max-h-[70vh] overflow-y-auto pr-1 lg:block lg:max-h-[calc(100vh-14rem)]'
            }
          >
            <ul className="space-y-3">
              {filtered.map((m) => {
                const openNow = isMerchantOpenNow(m.schedule);
                const fav = favorites.includes(m.id);
                return (
                  <li key={m.id}>
                    <motion.button
                      type="button"
                      layout
                      onClick={() => openMerchantDetail(m.id)}
                      className="group w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left shadow-lg transition hover:border-cyan-500/35 hover:shadow-[0_12px_40px_-12px_rgba(34,211,238,0.2)]"
                      whileHover={{ y: -3 }}
                    >
                      <div className="flex gap-3">
                        <img
                          src={m.logo}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-xl border border-white/10 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-white group-hover:text-cyan-100">{m.name}</span>
                            {fav ? (
                              <span className="text-[10px] font-bold text-rose-300">♥</span>
                            ) : null}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${ACTIVITY_BADGE[m.activityLevel]}`}
                            >
                              {m.activityLevel === 'hot' ? 'Hot' : m.activityLevel === 'busy' ? 'Busy' : 'Quiet'}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                            <span className="font-mono text-slate-300">{formatDistanceKm(m.distanceKm)}</span>
                            <span className="inline-flex items-center gap-0.5 text-amber-200/90">
                              ★ {m.rating.toFixed(1)}
                            </span>
                            <span
                              className={
                                m.acceptsAIG ? 'font-semibold text-cyan-300' : 'font-semibold text-violet-300'
                              }
                            >
                              {m.acceptsAIG ? 'AIG on' : 'No AIG'}
                            </span>
                            <span className={openNow ? 'text-emerald-400' : 'text-slate-500'}>
                              {openNow ? 'Open' : 'Closed'}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-[12px] text-slate-500">{m.description}</p>
                        </div>
                      </div>
                    </motion.button>
                  </li>
                );
              })}
            </ul>
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">No merchants match — widen distance or turn off filters.</p>
            ) : null}
          </div>
        </div>

        <LocalMerchantDetailModal
          open={detailOpen && !registerBusinessOpen}
          merchant={selectedMerchant}
          isFavorite={selectedMerchant ? favorites.includes(selectedMerchant.id) : false}
          onClose={closeDetail}
          onToggleFavorite={() => selectedMerchant && toggleFavorite(selectedMerchant.id)}
          onOpenMaps={() => selectedMerchant && window.open(selectedMerchant.googleMapsLink, '_blank', 'noopener,noreferrer')}
          onBuyProduct={onBuyProduct}
          balanceAIG={balanceAIG}
          balanceUSD={balanceUSD}
        />
      </div>
    </div>
  );
}
