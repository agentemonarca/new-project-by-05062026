import React, { memo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Gift,
  ArrowLeftRight,
  Share2,
  Settings,
  Landmark,
  Shield,
  ScrollText,
  BarChart3,
  Zap,
  FlaskConical,
} from 'lucide-react';

const ICONS = {
  signals: Zap,
  'signal-lab': FlaskConical,
  overview: LayoutDashboard,
  users: Users,
  wallet: Wallet,
  rewards: Gift,
  p2p: ArrowLeftRight,
  network: Share2,
  economy: Landmark,
  settings: Settings,
  security: Shield,
  auditLogs: ScrollText,
  analytics: BarChart3,
};

function AdminSidebarInner() {
  const items = [
    { id: 'signals', label: 'Señales' },
    { id: 'signal-lab', label: 'Signal Lab' },
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Usuarios' },
    { id: 'wallet', label: 'Wallet' },
    { id: 'rewards', label: 'Recompensas' },
    { id: 'p2p', label: 'P2P' },
    { id: 'network', label: 'Red' },
    { id: 'economy', label: 'Economía' },
    { id: 'settings', label: 'Configuración' },
    { id: 'security', label: 'Seguridad' },
    { id: 'auditLogs', label: 'Auditoría' },
    { id: 'analytics', label: 'Analytics' },
  ];

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-white/[0.06] bg-slate-950/50 lg:flex">
      <nav className="custom-scrollbar flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map((item) => {
          const Icon = ICONS[item.id] || LayoutDashboard;
          return (
            <NavLink
              key={item.id}
              to={`/admin/${item.id}`}
              className={({ isActive }) =>
                `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-white/[0.06] p-3 text-[10px] text-slate-600">
        AiGenesis Admin Core · mock
      </div>
    </aside>
  );
}

export const AdminSidebar = memo(AdminSidebarInner);
AdminSidebar.displayName = 'AdminSidebar';
