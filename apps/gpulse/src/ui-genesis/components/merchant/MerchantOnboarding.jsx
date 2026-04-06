import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import { MapPin, Store, CheckCircle2, ExternalLink, X, Crosshair } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useOptionalWallet } from '../../../context/WalletContext.jsx';
import {
  MERCHANT_CATEGORIES,
  buildMerchantFromOnboarding,
  buildProductFromOnboardingForm,
} from '../../local-marketplace/index.js';
import { useLocalMerchantDirectoryStore } from '../../stores/localMerchantDirectoryStore.js';
import { ProductForm } from './ProductForm.jsx';

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const run = () => map.invalidateSize();
    const t = window.setTimeout(run, 160);
    window.addEventListener('resize', run);
    return () => {
      window.removeEventListener('resize', run);
      window.clearTimeout(t);
    };
  }, [map]);
  return null;
}

/**
 * Click map to set store coordinates (pin updates instantly).
 * @param {{ lat: number, lng: number, onPick: (lat: number, lng: number) => void }} props
 */
function MapClickLayer({ lat, lng, onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return (
    <CircleMarker
      center={[lat, lng]}
      radius={12}
      pathOptions={{
        color: '#f472b6',
        fillColor: '#22d3ee',
        fillOpacity: 0.88,
        weight: 3,
      }}
    />
  );
}

/**
 * @param {{
 *   lat: number,
 *   lng: number,
 *   onPick: (lat: number, lng: number) => void,
 *   hint?: string,
 * }} props
 */
function OnboardingMapPicker({ lat, lng, onPick, hint }) {
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <p className="text-[11px] font-medium text-slate-500">
        <Crosshair className="mr-1 inline h-3 w-3 text-cyan-400" />
        {hint ?? 'Click the map to place your business pin (lat / lng update below).'}
      </p>
      <div className="relative isolate h-[300px] w-full overflow-hidden rounded-xl border border-white/15 bg-slate-900">
        <MapContainer center={[lat, lng]} zoom={13} className="h-full w-full" scrollWheelZoom>
          <MapResizeFix />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickLayer lat={lat} lng={lng} onPick={onPick} />
        </MapContainer>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   mode: 'modal' | 'page',
 *   open?: boolean,
 *   onClose?: () => void,
 *   defaultLat?: number,
 *   defaultLng?: number,
 *   onRegistered?: (merchantId: string) => void,
 * }} props
 */
function MerchantOnboardingInner({
  mode,
  open = true,
  onClose,
  defaultLat = 25.2048,
  defaultLng = 55.2708,
  onRegistered,
}) {
  const navigate = useNavigate();
  const wallet = useOptionalWallet();
  const owner = wallet?.address ?? null;

  const userMerchants = useLocalMerchantDirectoryStore((s) => s.userMerchants);
  const addMerchant = useLocalMerchantDirectoryStore((s) => s.addMerchant);
  const addProduct = useLocalMerchantDirectoryStore((s) => s.addProduct);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(/** @type {string} */ (MERCHANT_CATEGORIES[0]));
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(String(defaultLat));
  const [lng, setLng] = useState(String(defaultLng));
  const [acceptsAIG, setAcceptsAIG] = useState(true);

  const [activeMerchantId, setActiveMerchantId] = useState(/** @type {string | null} */ (null));
  const [banner, setBanner] = useState(/** @type {string | null} */ (null));

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const mapPickLat = Number.isFinite(latNum) ? latNum : defaultLat;
  const mapPickLng = Number.isFinite(lngNum) ? lngNum : defaultLng;

  useEffect(() => {
    if (mode === 'modal' && open) {
      setName('');
      setDescription('');
      setCategory(MERCHANT_CATEGORIES[0]);
      setAddress('');
      setLat(String(defaultLat));
      setLng(String(defaultLng));
      setAcceptsAIG(true);
      setActiveMerchantId(null);
      setBanner(null);
    }
  }, [mode, open, defaultLat, defaultLng]);

  const pickOnMap = useCallback((newLat, newLng) => {
    setLat(String(Number(newLat.toFixed(6))));
    setLng(String(Number(newLng.toFixed(6))));
  }, []);

  const myStores = useMemo(
    () => (!owner ? userMerchants : userMerchants.filter((m) => m.ownerWallet === owner)),
    [userMerchants, owner],
  );

  const activeMerchant = useMemo(
    () => (activeMerchantId ? userMerchants.find((m) => m.id === activeMerchantId) ?? null : null),
    [activeMerchantId, userMerchants],
  );

  const saveStore = useCallback(() => {
    if (!String(name).trim()) {
      setBanner('Add a business name before registering.');
      window.setTimeout(() => setBanner(null), 2800);
      return;
    }
    try {
      const merchant = buildMerchantFromOnboarding(
        { name, description, category, address, lat, lng, acceptsAIG },
        owner,
      );
      addMerchant(merchant);
      setActiveMerchantId(merchant.id);
      setBanner(`“${merchant.name}” is on the map — add products below.`);
      window.setTimeout(() => setBanner(null), 5000);
      onRegistered?.(merchant.id);
    } catch {
      setBanner('Check latitude / longitude are valid numbers.');
      window.setTimeout(() => setBanner(null), 3200);
    }
  }, [name, description, category, address, lat, lng, acceptsAIG, owner, addMerchant, onRegistered]);

  const onProductSubmit = useCallback(
    (raw) => {
      const mid = activeMerchantId;
      if (!mid) return;
      const product = buildProductFromOnboardingForm({
        name: raw.name,
        priceUSD: raw.priceUSD,
        priceAIG: raw.priceAIG,
        image: raw.image,
        description: raw.description,
      });
      addProduct(mid, product);
      setBanner('Product added.');
      window.setTimeout(() => setBanner(null), 2400);
    },
    [activeMerchantId, addProduct],
  );

  const useMyLocationPin = useCallback(() => {
    setLat(String(defaultLat));
    setLng(String(defaultLng));
    setBanner('Pin moved to your map anchor.');
    window.setTimeout(() => setBanner(null), 2200);
  }, [defaultLat, defaultLng]);

  const inner = (
    <div className="space-y-6">
      {banner ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-100">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {banner}
        </div>
      ) : null}

      <div
        className={
          mode === 'page'
            ? 'rounded-3xl border border-violet-500/30 bg-slate-950/70 p-6 backdrop-blur-md md:p-8'
            : ''
        }
      >
        {mode === 'page' ? (
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/90">
                Merchant onboarding
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold text-white md:text-3xl">Register your business</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Pins are saved in this browser (Zustand + localStorage) and appear on the local marketplace map
                immediately — no backend.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/35 px-4 py-2 text-[11px] font-mono text-slate-300">
              <span className="text-slate-500">Owner</span>{' '}
              {owner ? `${owner.slice(0, 8)}…${owner.slice(-6)}` : 'Connect wallet to attach owner'}
            </div>
          </div>
        ) : (
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/90">Register</p>
              <h2 className="mt-1 font-display text-xl font-bold text-white">Your business on the map</h2>
              <p className="mt-1 text-xs text-slate-500">Saved locally · shows instantly on this map view</p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onClose?.()}
              className="rounded-lg border border-white/15 bg-black/40 p-2 text-slate-300 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 md:p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <Store className="h-4 w-4 text-cyan-400" />
                Business details
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-4">
                <div className="order-2 grid min-w-0 gap-3 md:order-1">
                  <label className="block text-xs font-medium text-slate-400">
                    Business name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-white"
                      placeholder="e.g. Harbor Roasters"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-400">
                    Description
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="mt-1 w-full resize-y rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-slate-200"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-400">
                    Category
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-white"
                    >
                      {MERCHANT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-cyan-500" />
                      Address
                    </span>
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-white"
                      placeholder="Street, area, city"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={useMyLocationPin}
                    className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/15"
                  >
                    Use my map anchor for pin
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-medium text-slate-400">
                      Latitude
                      <input
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        inputMode="decimal"
                        className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-400">
                      Longitude
                      <input
                        value={lng}
                        onChange={(e) => setLng(e.target.value)}
                        inputMode="decimal"
                        className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
                      />
                    </label>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={acceptsAIG}
                      onChange={(e) => setAcceptsAIG(e.target.checked)}
                      className="rounded border-white/20 bg-slate-900"
                    />
                    Accepts AIG at checkout
                  </label>

                  <button
                    type="button"
                    onClick={saveStore}
                    className="mt-1 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg"
                  >
                    {mode === 'modal' ? 'Register on map' : 'Save store'}
                  </button>
                </div>

                <div className="order-1 min-h-0 md:order-2">
                  <OnboardingMapPicker lat={mapPickLat} lng={mapPickLng} onPick={pickOnMap} />
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            {activeMerchantId && activeMerchant ? (
              <>
                <ProductForm onSubmit={onProductSubmit} />
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 md:p-5">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Products · {activeMerchant.name}
                  </h3>
                  {activeMerchant.products.length === 0 ? (
                    <p className="text-sm text-slate-500">No products yet.</p>
                  ) : (
                    <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                      {activeMerchant.products.map((p) => (
                        <li
                          key={p.id}
                          className="flex gap-3 rounded-xl border border-white/10 bg-slate-900/50 p-3 text-sm"
                        >
                          {p.image ? (
                            <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-slate-800" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white">{p.name}</p>
                            <p className="font-mono text-[11px] text-slate-400">
                              <span className="text-cyan-200/90">{p.priceAIG} AIG</span>
                              <span className="text-slate-600"> · </span>
                              <span className="text-violet-200/90">${p.priceUSD}</span>
                            </p>
                            {p.description ? (
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{p.description}</p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {mode === 'modal' && onClose ? (
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-100"
                    >
                      Done — view map
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate('/marketplace/local')}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/15"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open local marketplace
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-center text-sm text-slate-500">
                Register your business to add products.
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 md:p-5">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Your stores (this device)
              </h3>
              {myStores.length === 0 ? (
                <p className="text-sm text-slate-500">None yet.</p>
              ) : (
                <ul className="space-y-2">
                  {myStores.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setActiveMerchantId(m.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                          activeMerchantId === m.id
                            ? 'border-cyan-500/40 bg-cyan-500/10 text-white'
                            : 'border-white/10 bg-slate-900/40 text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <span className="font-medium">{m.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">{m.products.length} SKUs</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (mode === 'page') {
    return inner;
  }

  const close = onClose ?? (() => {});

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="merchant-onboarding-backdrop"
          className="fixed inset-0 z-[96] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            onClick={close}
          />
          <motion.div
            key="merchant-onboarding-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="merchant-onboard-title"
            className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-y-auto overflow-x-hidden rounded-2xl border border-violet-500/40 bg-slate-950 p-4 shadow-2xl md:p-6"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span id="merchant-onboard-title" className="sr-only">
              Register your business
            </span>
            {inner}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export const MerchantOnboarding = memo(MerchantOnboardingInner);
export default MerchantOnboarding;
