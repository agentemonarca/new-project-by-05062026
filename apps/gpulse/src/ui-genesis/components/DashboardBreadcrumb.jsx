import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

const LABELS = {
  dashboard: 'Inicio',
  mining: 'Minería',
  booster: 'AiG Booster',
  network: 'Red Binaria',
  wallet: 'Wallet',
  marketplace: 'Marketplace',
  gpulse: 'GPulse Oracle',
  'gpulse-lobby': 'GPulse Oracle',
  'genesis-lobby': 'Genesis Lobby',
  staking: 'Staking',
  promo: 'Promo',
  p2p: 'P2P',
  topg: 'Top G',
  nft: 'NFT',
  profile: 'Perfil',
  history: 'Historial operativo',
  support: 'Soporte VIP',
};

/**
 * @param {{ nav: string, onNavigate: (id: string) => void }} props
 */
export function DashboardBreadcrumb({ nav, onNavigate }) {
  const current = LABELS[nav] ?? 'Inicio';

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
      <button
        type="button"
        onClick={() => onNavigate('dashboard')}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-slate-400 transition hover:bg-white/5 hover:text-cyan-200/90"
      >
        <Home className="h-3 w-3" />
        AiGenesis
      </button>
      <ChevronRight className="h-3 w-3 shrink-0 text-slate-600" aria-hidden />
      <span className="font-semibold text-slate-200">{current}</span>
    </nav>
  );
}
