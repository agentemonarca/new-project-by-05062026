import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Wallet } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.jsx';
import { NeonButton } from '../components/NeonButton.jsx';
import { useP2PMarketplaceStore } from '../stores/p2pMarketplaceStore.js';
import { useWallet } from '../../context/WalletContext.jsx';
import { fadeUpBlur } from '../motion/variants.js';
import { P2PConfigProvider } from '@/modules/p2p/context/P2PConfigContext.jsx';
import { P2PMarket } from '@/modules/p2p/components/P2PMarket.jsx';

const NETWORKS = ['ERC-20', 'BEP-20', 'USDC'];

const MOCK_ORDERS = [
  {
    id: '1',
    network: 'ERC-20',
    available: 125000,
    price: 0.95,
    priceDisplay: '0.98 EUR',
    limitMin: 3000,
    limitMax: 8000,
    advertiser: 'ORACLE_NODE',
    txCount: 842,
    wallet: '0x7a2f8c1e9d4b0a6f3c8e2d5147b9a0f6c2e8d134',
    firstConnection: '14/03/2024',
    reviewsPos: 312,
    reviewsNeg: 4,
    reviewsTotal: 316,
    timeLimitMin: 45,
    commission: '0.35%',
  },
  {
    id: '2',
    network: 'BEP-20',
    available: 88000,
    price: 0.97,
    priceDisplay: '0.97 USDT',
    limitMin: 1500,
    limitMax: 12000,
    advertiser: 'AIG_FLOW',
    txCount: 1204,
    wallet: '0xb91c4ee072ad823f5678901234567890abcdef12',
    firstConnection: '02/01/2024',
    reviewsPos: 428,
    reviewsNeg: 2,
    reviewsTotal: 430,
    timeLimitMin: 45,
    commission: '0.42%',
  },
  {
    id: '3',
    network: 'USDC',
    available: 45000,
    price: 0.96,
    priceDisplay: '0.96 USDT',
    limitMin: 5000,
    limitMax: 50000,
    advertiser: 'GLOBAL_P2P',
    txCount: 56,
    wallet: '0xabcd1234ef567890abcd1234',
    firstConnection: '28/11/2025',
    reviewsPos: 48,
    reviewsNeg: 8,
    reviewsTotal: 56,
    timeLimitMin: 60,
    commission: '0.50%',
  },
  {
    id: '4',
    network: 'ERC-20',
    available: 200000,
    price: 0.94,
    priceDisplay: '0.94 USDT',
    limitMin: 2000,
    limitMax: 25000,
    advertiser: 'NEXUS_TRADER',
    txCount: 3890,
    wallet: '0x2222333344445555666667777888899990000aa',
    firstConnection: '09/06/2023',
    reviewsPos: 1205,
    reviewsNeg: 12,
    reviewsTotal: 1217,
    timeLimitMin: 30,
    commission: '0.28%',
  },
];

function t(lang, key) {
  const M = {
    es: {
      connect: 'Conectar Wallet',
      filterNet: 'FILTRAR POR RED',
      buy: 'COMPRAR',
      sell: 'VENDER',
      available: 'Disponible',
      price: 'Precio',
      limit: 'Límite',
      advertiser: 'Anunciante',
      txs: 'transacciones',
      loadMore: 'CARGAR MÁS',
      footer: 'Copyright © 2025 G11 P2P - Todos los derechos reservados.',
      profile: 'Perfil',
      settings: 'Configuración',
      disconnect: 'Desconectar wallet',
      myListings: 'Mis anuncios',
      marketplace: 'Marketplace',
      myReports: 'Mis reportes',
      tgSupport: 'Soporte telegram',
      faqs: 'FAQs',
      precio: 'Precio',
      timeLimit: 'Tiempo límite',
      limits: 'Límites',
      min: 'Min',
      max: 'Max',
      avail: 'Disponible',
      fee: 'Comisión',
      wantBuyAig: 'Quiero comprar Aig...',
      wantPayUsdt: 'Quiero pagar USDT...',
      wantSellAig: 'Quiero vender Aig...',
      wantRecvUsdt: 'Quiero recibir USDT...',
      cancel: 'CANCELAR',
      minLabel: 'min',
      walletAddr: 'Wallet',
      firstConn: 'Primera conexión',
      posRev: 'Reseñas positivas',
      negRev: 'Reseñas negativas',
      totalRev: 'Total reseñas',
    },
    en: {
      connect: 'Connect Wallet',
      filterNet: 'FILTER BY NETWORK',
      buy: 'BUY',
      sell: 'SELL',
      available: 'Available',
      price: 'Price',
      limit: 'Limit',
      advertiser: 'Advertiser',
      txs: 'transactions',
      loadMore: 'LOAD MORE',
      footer: 'Copyright © 2025 G11 P2P - All rights reserved.',
      profile: 'Profile',
      settings: 'Settings',
      disconnect: 'Disconnect wallet',
      myListings: 'My listings',
      marketplace: 'Marketplace',
      myReports: 'My reports',
      tgSupport: 'Telegram support',
      faqs: 'FAQs',
      precio: 'Price',
      timeLimit: 'Time limit',
      limits: 'Limits',
      min: 'Min',
      max: 'Max',
      avail: 'Available',
      fee: 'Fee',
      wantBuyAig: 'I want to buy AIG...',
      wantPayUsdt: 'I want to pay USDT...',
      wantSellAig: 'I want to sell AIG...',
      wantRecvUsdt: 'I want to receive USDT...',
      cancel: 'CANCEL',
      minLabel: 'min',
      walletAddr: 'Wallet',
      firstConn: 'First connection',
      posRev: 'Positive reviews',
      negRev: 'Negative reviews',
      totalRev: 'Total reviews',
    },
  };
  return M[lang]?.[key] ?? M.es[key] ?? key;
}

function AigIcon({ className = '' }) {
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-400/35 bg-gradient-to-br from-cyan-500/30 to-violet-600/25 text-[10px] font-black text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.25)] ${className}`}
    >
      AIG
    </div>
  );
}

function UserTooltip({ order, lang, position }) {
  if (!order || !position) return null;
  const s = (k) => t(lang, k);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
      transition={{ duration: 0.15 }}
      className="fixed z-[200] w-[280px] rounded-xl border border-white/15 bg-slate-950/95 p-4 text-left shadow-[0_0_40px_rgba(139,92,246,0.25),0_0_60px_rgba(34,211,238,0.12)] backdrop-blur-xl"
      style={{ left: position.x, top: position.y }}
      role="tooltip"
    >
      <p className="font-mono text-[10px] text-slate-500">{s('walletAddr')}</p>
      <p className="mt-1 break-all font-mono text-xs text-cyan-200/90">{order.wallet}</p>
      <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-xs text-slate-300">
        <div className="flex justify-between">
          <span className="text-slate-500">{t(lang, 'txs')}</span>
          <span className="font-mono font-semibold text-white">{order.txCount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">{s('firstConn')}</span>
          <span>{order.firstConnection}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">{s('posRev')}</span>
          <span className="text-emerald-300">{order.reviewsPos}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">{s('negRev')}</span>
          <span className="text-rose-300">{order.reviewsNeg}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">{s('totalRev')}</span>
          <span className="font-semibold text-white">{order.reviewsTotal}</span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * G11 P2P — full marketplace UI (`nav === 'p2p'`).
 * @param {{ onNavigate?: (id: string) => void }} props
 */
export function GenesisP2PMarketplacePage({ onNavigate }) {
  const navigate = useNavigate();
  const {
    p2pMode,
    setP2pMode,
    expandedOrderId,
    toggleExpandOrder,
    closeExpanded,
    networkFilter,
    setNetworkFilter,
    uiLang,
    setUiLang,
  } = useP2PMarketplaceStore();

  const { address, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [orders, setOrders] = useState(MOCK_ORDERS);
  const [hoverTip, setHoverTip] = useState(null);
  const [amountAig, setAmountAig] = useState('');
  const [amountUsdt, setAmountUsdt] = useState('');

  const walletBtnRef = useRef(null);
  const filterRef = useRef(null);

  const filteredOrders = useMemo(
    () => orders.filter((o) => o.network === networkFilter),
    [orders, networkFilter],
  );

  const expandedOrder = useMemo(
    () => filteredOrders.find((o) => o.id === expandedOrderId) ?? null,
    [filteredOrders, expandedOrderId],
  );

  useEffect(() => {
    if (expandedOrderId && !filteredOrders.some((o) => o.id === expandedOrderId)) {
      closeExpanded();
    }
  }, [filteredOrders, expandedOrderId, closeExpanded]);

  useEffect(() => {
    if (!expandedOrder) {
      setAmountAig('');
      setAmountUsdt('');
    }
  }, [expandedOrderId, expandedOrder]);

  useEffect(() => {
    const onDoc = (e) => {
      if (walletBtnRef.current && !walletBtnRef.current.contains(e.target)) setWalletMenuOpen(false);
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const onUserHover = useCallback((order, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 300);
    const y = rect.bottom + 8;
    setHoverTip({ userId: order.id, order, x, y });
  }, []);

  const onUserLeave = useCallback(() => setHoverTip(null), []);

  const loadMore = useCallback(() => {
    const nextId = String(Number(orders[orders.length - 1]?.id ?? '0') + 1);
    setOrders((prev) => [
      ...prev,
      {
        id: nextId,
        network: networkFilter,
        available: 60000 + prev.length * 1000,
        price: 0.93 + (prev.length % 3) * 0.01,
        priceDisplay: `${(0.93 + (prev.length % 3) * 0.01).toFixed(2)} USDT`,
        limitMin: 1000,
        limitMax: 20000,
        advertiser: `P2P_USER_${nextId}`,
        txCount: 40 + prev.length,
        wallet: `0x${String(nextId).padStart(4, '0')}abcdef1234567890abcdef1234567890`,
        firstConnection: '01/01/2025',
        reviewsPos: 20 + prev.length,
        reviewsNeg: 1,
        reviewsTotal: 21 + prev.length,
        timeLimitMin: 45,
        commission: '0.40%',
      },
    ]);
  }, [orders, networkFilter]);

  const s = (k) => t(uiLang, k);

  const rowActionLabel = p2pMode === 'buy' ? s('buy') : s('sell');

  return (
    <P2PConfigProvider>
    <motion.div
      variants={fadeUpBlur}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-8"
    >
      {/* Page-local neon backdrop wash */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,92,246,0.12),transparent_55%),radial-gradient(ellipse_60%_40%_at_90%_60%,rgba(34,211,238,0.08),transparent_50%)] opacity-90" />

      {/* TOP */}
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="font-display text-2xl font-black tracking-tight md:text-[1.75rem]">
            <span className="text-white">G11 </span>
            <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
              P2P
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <div className="flex rounded-xl border border-white/15 bg-slate-950/50 p-1">
            <button
              type="button"
              onClick={() => setUiLang('es')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${uiLang === 'es' ? 'bg-gradient-to-r from-cyan-500/30 to-violet-500/30 text-white shadow-glowCyan' : 'text-slate-500 hover:text-slate-300'}`}
            >
              ES
            </button>
            <button
              type="button"
              onClick={() => setUiLang('en')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${uiLang === 'en' ? 'bg-gradient-to-r from-cyan-500/30 to-violet-500/30 text-white shadow-glowCyan' : 'text-slate-500 hover:text-slate-300'}`}
            >
              EN
            </button>
          </div>

          {!address ? (
            <NeonButton
              type="button"
              variant="primary"
              className="!min-w-0 !gap-2 !normal-case !px-5 !py-2.5 !text-sm !font-bold"
              disabled={isConnecting}
              onClick={() => connectWallet().catch(() => {})}
            >
              <Wallet className="h-4 w-4" />
              {s('connect')}
            </NeonButton>
          ) : (
            <div className="relative" ref={walletBtnRef}>
              <NeonButton
                type="button"
                variant="secondary"
                className="!min-w-0 !gap-2 !normal-case !px-4 !py-2.5 !text-sm !font-semibold"
                onClick={() => setWalletMenuOpen((o) => !o)}
              >
                <span className="max-w-[10rem] truncate font-mono text-xs">{`${address.slice(0, 6)}…${address.slice(-4)}`}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition ${walletMenuOpen ? 'rotate-180' : ''}`} />
              </NeonButton>
              <AnimatePresence>
                {walletMenuOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute right-0 z-[100] mt-2 w-64 overflow-hidden rounded-xl border border-white/15 bg-slate-950/95 py-2 shadow-[0_0_32px_rgba(139,92,246,0.2)] backdrop-blur-xl"
                  >
                    {[
                      { label: s('profile'), onClick: () => onNavigate?.('profile') },
                      { label: s('settings'), onClick: () => onNavigate?.('profile') },
                      { label: s('disconnect'), onClick: () => { disconnectWallet(); setWalletMenuOpen(false); } },
                      { label: s('myListings'), onClick: () => {} },
                      { label: s('marketplace'), onClick: () => navigate('/marketplace') },
                      { label: s('myReports'), onClick: () => {} },
                      { label: s('tgSupport'), onClick: () => window.open('https://t.me/G11P2P', '_blank', 'noopener,noreferrer') },
                      { label: s('faqs'), onClick: () => onNavigate?.('support') },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-200 transition-colors hover:bg-white/[0.06]"
                        onClick={() => {
                          item.onClick();
                          setWalletMenuOpen(false);
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          )}
        </div>
      </header>

      <P2PMarket />

      {/* Tabs + filter */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex rounded-xl border border-white/12 bg-slate-950/40 p-1">
          <button
            type="button"
            onClick={() => setP2pMode('buy')}
            className={`rounded-lg px-6 py-2.5 text-sm font-bold tracking-wide transition-all md:px-8 ${
              p2pMode === 'buy'
                ? 'bg-gradient-to-r from-cyan-500/40 via-violet-500/35 to-fuchsia-500/35 text-white shadow-[0_0_24px_rgba(34,211,238,0.2)]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {s('buy')}
          </button>
          <button
            type="button"
            onClick={() => setP2pMode('sell')}
            className={`rounded-lg px-6 py-2.5 text-sm font-bold tracking-wide transition-all md:px-8 ${
              p2pMode === 'sell'
                ? 'bg-gradient-to-r from-cyan-500/40 via-violet-500/35 to-fuchsia-500/35 text-white shadow-[0_0_24px_rgba(34,211,238,0.2)]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {s('sell')}
          </button>
        </div>

        <div className="relative flex items-center gap-2" ref={filterRef}>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{s('filterNet')}</span>
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className="flex min-w-[8rem] items-center justify-between gap-2 rounded-xl border border-cyan-500/30 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.1)]"
          >
            {networkFilter}
            <ChevronDown className={`h-4 w-4 ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {filterOpen ? (
              <motion.ul
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-full z-[90] mt-2 w-full min-w-[10rem] overflow-hidden rounded-xl border border-white/12 bg-slate-950/95 py-1 shadow-xl backdrop-blur-xl"
              >
                {NETWORKS.map((n) => (
                  <li key={n}>
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/[0.06]"
                      onClick={() => {
                        setNetworkFilter(n);
                        setFilterOpen(false);
                        closeExpanded();
                      }}
                    >
                      {n}
                    </button>
                  </li>
                ))}
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Table */}
      <GlassCard hover={false} glowClassName="shadow-[0_0_40px_-8px_rgba(139,92,246,0.18)]" contentClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 md:px-6">{s('available')}</th>
                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{s('price')}</th>
                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{s('limit')}</th>
                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{s('advertiser')}</th>
                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 md:px-6"> </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <React.Fragment key={order.id}>
                  <tr
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpandOrder(order.id, filteredOrders)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpandOrder(order.id, filteredOrders);
                      }
                    }}
                    className={`cursor-pointer border-b border-white/[0.06] transition-colors hover:bg-white/[0.04] ${expandedOrderId === order.id ? 'bg-cyan-500/[0.07]' : ''}`}
                  >
                    <td className="px-4 py-4 md:px-6">
                      <div className="flex items-center gap-3">
                        <AigIcon />
                        <span className="font-mono text-sm font-semibold tabular-nums text-white">
                          {order.available.toLocaleString(uiLang === 'en' ? 'en-US' : 'es-ES')} AIG
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-sm font-semibold text-cyan-200/95">{order.price.toFixed(2)}</td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-300 md:text-sm">
                      {order.limitMin.toLocaleString()} – {order.limitMax.toLocaleString()} USDT
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        className="block text-left"
                        onMouseEnter={(e) => onUserHover(order, e)}
                        onMouseLeave={onUserLeave}
                        onFocus={(e) => onUserHover(order, e)}
                        onBlur={onUserLeave}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-mono text-sm font-semibold text-violet-200/95 hover:underline">
                          @{order.advertiser}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {order.txCount.toLocaleString()} {s('txs')}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-4 md:px-6" onClick={(e) => e.stopPropagation()}>
                      <NeonButton
                        type="button"
                        variant="primary"
                        className="!min-w-0 !px-4 !py-2 !text-[11px]"
                        onClick={() => toggleExpandOrder(order.id, filteredOrders)}
                      >
                        {rowActionLabel}
                      </NeonButton>
                    </td>
                  </tr>
                  {expandedOrderId === order.id ? (
                    <tr className="border-b border-white/[0.06] bg-slate-950/50">
                      <td colSpan={5} className="p-0">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-cyan-500/15"
                        >
                            <div className="grid gap-6 p-5 md:grid-cols-2 md:gap-8 md:p-8">
                              <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{s('precio')}</p>
                                  <p className="mt-1 font-mono text-2xl font-bold text-cyan-200">{order.priceDisplay}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{s('timeLimit')}</p>
                                  <p className="mt-1 text-lg font-semibold text-white">
                                    {order.timeLimitMin} {s('minLabel')}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{s('limits')}</p>
                                  <div className="mt-2 flex gap-6 text-sm">
                                    <div>
                                      <span className="text-slate-500">{s('min')}</span>
                                      <p className="font-mono font-semibold text-white">{order.limitMin.toLocaleString()} USDT</p>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">{s('max')}</span>
                                      <p className="font-mono font-semibold text-white">{order.limitMax.toLocaleString()} USDT</p>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{s('avail')}</p>
                                  <p className="mt-1 font-mono text-lg text-white">{order.available.toLocaleString()} AIG</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{s('fee')}</p>
                                  <p className="mt-1 font-mono text-lg text-fuchsia-200/90">{order.commission}</p>
                                </div>
                              </div>
                              <div className="flex flex-col justify-center space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
                                <label className="block">
                                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-cyan-200/70">
                                    {p2pMode === 'buy' ? s('wantBuyAig') : s('wantSellAig')}
                                  </span>
                                  <input
                                    value={amountAig}
                                    onChange={(e) => setAmountAig(e.target.value)}
                                    className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 font-mono text-sm text-white outline-none ring-0 focus:border-cyan-400/50 focus:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                                    placeholder="0"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-cyan-200/70">
                                    {p2pMode === 'buy' ? s('wantPayUsdt') : s('wantRecvUsdt')}
                                  </span>
                                  <input
                                    value={amountUsdt}
                                    onChange={(e) => setAmountUsdt(e.target.value)}
                                    className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 font-mono text-sm text-white outline-none focus:border-cyan-400/50 focus:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                                    placeholder="0.00"
                                  />
                                </label>
                                <div className="flex flex-wrap gap-3 pt-2">
                                  <NeonButton
                                    type="button"
                                    variant="primary"
                                    className="!min-w-0 flex-1 !normal-case !font-bold"
                                    onClick={() => {
                                      if (!address) {
                                        connectWallet().catch(() => {});
                                        return;
                                      }
                                      if (!amountAig.trim() && !amountUsdt.trim()) return;
                                      /* Order execution hooks to API / contract */
                                    }}
                                  >
                                    {rowActionLabel}
                                  </NeonButton>
                                  <NeonButton
                                    type="button"
                                    variant="outline"
                                    className="!min-w-0 flex-1 !normal-case !font-semibold"
                                    onClick={closeExpanded}
                                  >
                                    {s('cancel')}
                                  </NeonButton>
                                </div>
                              </div>
                            </div>
                        </motion.div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {filteredOrders.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">—</p>
        ) : null}
      </GlassCard>

      <div className="flex justify-center pt-2">
        <NeonButton type="button" variant="secondary" className="!min-w-[200px] !font-bold !tracking-wide" onClick={loadMore}>
          {s('loadMore')}
        </NeonButton>
      </div>

      <footer className="border-t border-white/10 pt-6 text-center text-xs text-slate-600">{s('footer')}</footer>

      <AnimatePresence>
        {hoverTip ? (
          <UserTooltip
            key={hoverTip.userId}
            order={hoverTip.order}
            lang={uiLang}
            position={{ x: hoverTip.x, y: hoverTip.y }}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>
    </P2PConfigProvider>
  );
}
