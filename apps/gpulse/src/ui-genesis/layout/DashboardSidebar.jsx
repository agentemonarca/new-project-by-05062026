import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Network,
  ShoppingBag,
  Coins,
  User,
  Clock,
  LifeBuoy,
  Megaphone,
  ArrowLeftRight,
  Trophy,
  Hexagon,
  Sparkles,
} from 'lucide-react';
import { SidebarItem } from '../components/SidebarItem.jsx';

/**
 * AiGenesis navigation — core flow → ecosystem → user (product spec).
 */
/** Core flow — landing is Genesis Lobby (`/`). */
const NAV_STRUCTURE = [
  { kind: 'section', label: 'Flujo principal' },
  { kind: 'item', id: 'genesis-lobby', label: 'Inicio', icon: Sparkles },
  { kind: 'item', id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
  { kind: 'item', id: 'network', label: 'Red Binaria', icon: Network, nested: true },
  { kind: 'separator' },
  { kind: 'section', label: 'Ecosistema' },
  { kind: 'item', id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  { kind: 'item', id: 'promo', label: 'Promo', icon: Megaphone },
  { kind: 'item', id: 'p2p', label: 'P2P', icon: ArrowLeftRight },
  { kind: 'item', id: 'topg', label: 'Top G', icon: Trophy },
  { kind: 'item', id: 'staking', label: 'Staking', icon: Coins, nested: true },
  { kind: 'item', id: 'nft', label: 'NFT', icon: Hexagon },
  { kind: 'separator' },
  { kind: 'section', label: 'Usuario' },
  { kind: 'item', id: 'profile', label: 'Perfil', icon: User },
  { kind: 'item', id: 'history', label: 'Historial operativo', icon: Clock },
  { kind: 'item', id: 'support', label: 'Soporte VIP', icon: LifeBuoy },
];

function NavSeparator({ compact }) {
  return (
    <div
      className={`mx-2 my-1 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent ${compact ? 'md:mx-1.5 md:my-0.5' : ''}`}
      role="separator"
      aria-hidden
    />
  );
}

/**
 * @param {{
 *   activeId: string,
 *   onSelect?: (id: string) => void,
 *   className?: string,
 *   compact?: boolean,
 * }} props
 */
export function DashboardSidebar({ activeId, onSelect, className = '', compact = false }) {
  return (
    <motion.aside
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className={`flex h-full min-h-0 w-[min(17.5rem,85vw)] shrink-0 flex-col border-r border-white/[0.07] bg-[linear-gradient(165deg,rgba(15,23,42,0.92)_0%,rgba(2,6,23,0.88)_45%,rgba(15,23,42,0.9)_100%)] shadow-[inset_-1px_0_0_rgba(34,211,238,0.06),4px_0_48px_-12px_rgba(0,0,0,0.5)] backdrop-blur-2xl backdrop-saturate-150 md:w-[17.5rem] md:transition-[width] md:duration-300 md:ease-out ${compact ? 'md:!w-[4.5rem]' : ''} ${className}`}
    >
      <div
        className={`shrink-0 border-b border-white/[0.08] px-4 pb-5 pt-5 ${compact ? 'md:px-2 md:pb-3 md:pt-3' : ''}`}
      >
        <div
          className={`relative overflow-hidden rounded-2xl border border-violet-500/25 bg-slate-950/50 p-4 shadow-[0_0_40px_-12px_rgba(139,92,246,0.35),inset_0_1px_0_0_rgba(255,255,255,0.06)] ${compact ? 'md:p-2.5' : ''}`}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-500/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-6 left-4 h-16 w-16 rounded-full bg-violet-500/20 blur-xl" />
          <div className={compact ? 'md:flex md:justify-center' : ''}>
            <div className={compact ? 'md:sr-only' : ''}>
              <p className="font-display text-base font-semibold tracking-tight text-white">AiGenesis</p>
              <p className="mt-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/90">
                G-Pulse Core
              </p>
            </div>
            {compact ? (
              <div
                className="hidden md:flex md:h-10 md:w-10 md:items-center md:justify-center md:rounded-xl md:border md:border-cyan-500/30 md:bg-gradient-to-br md:from-cyan-500/15 md:to-violet-600/15 md:text-cyan-200 md:shadow-[0_0_20px_-8px_rgba(34,211,238,0.35)]"
                aria-hidden
              >
                <Sparkles className="h-5 w-5" strokeWidth={1.75} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <nav
        className={`flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-3 py-4 ${compact ? 'md:px-1.5 md:py-2' : ''}`}
        aria-label="Main navigation"
      >
        {NAV_STRUCTURE.map((entry, idx) => {
          if (entry.kind === 'separator') {
            return <NavSeparator key={`sep-${idx}`} compact={compact} />;
          }

          if (entry.kind === 'section') {
            return (
              <div
                key={`section-${entry.label}-${idx}`}
                className={`pt-2 ${compact ? 'md:h-2 md:shrink-0 md:pt-1' : ''}`}
              >
                <p
                  className={`px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 ${compact ? 'md:hidden' : ''}`}
                >
                  {entry.label}
                </p>
              </div>
            );
          }

          return (
            <SidebarItem
              key={entry.id}
              icon={entry.icon}
              label={entry.label}
              nested={Boolean(entry.nested)}
              compact={compact}
              active={activeId === entry.id}
              onClick={() => onSelect?.(entry.id)}
            />
          );
        })}
      </nav>

      <div className={`shrink-0 border-t border-white/[0.08] px-4 py-4 ${compact ? 'md:px-2 md:py-2' : ''}`}>
        <div
          className={`rounded-xl border border-cyan-500/20 bg-slate-950/60 shadow-[0_0_24px_-8px_rgba(34,211,238,0.15)] transition-shadow duration-300 hover:border-cyan-400/35 hover:shadow-[0_0_28px_-6px_rgba(34,211,238,0.22)] ${compact ? 'md:flex md:justify-center md:border-cyan-500/15 md:px-0 md:py-2.5' : 'px-3.5 py-3'}`}
        >
          <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 ${compact ? 'md:sr-only' : ''}`}>
            Core status
          </p>
          <div className={`mt-2 flex items-center gap-2.5 ${compact ? 'md:mt-0' : ''}`}>
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85),0_0_24px_rgba(34,211,238,0.2)]"
              aria-hidden
            />
            <span className={`text-xs font-medium text-cyan-100/95 ${compact ? 'md:sr-only' : ''}`}>Active</span>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
