import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell, Sidebar, Topbar, type GpulseIndicatorState, type SidebarRow } from '@ai-genesis/ui';
import { useExternalContext } from '@ai-genesis/bridge';
import { useGenesisStore, subscribe } from '@ai-genesis/state';
import {
  IconConsole,
  IconDashboard,
  IconGpulse,
  IconHistory,
  IconLegacy,
  IconNetwork,
  IconSettings,
  IconSupport,
  IconWallet,
} from '@/nav/icons';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/system': 'System',
  '/network': 'Network',
  '/wallet': 'Wallet',
  '/history': 'History',
  '/g-pulse': 'G-Pulse',
  '/settings': 'Settings',
  '/support': 'Support',
  '/genesis': 'Génesis',
};

const SIDEBAR_ROWS: SidebarRow[] = [
  {
    kind: 'items',
    label: 'Overview',
    items: [
      { id: 'dash', label: 'Dashboard', href: '/', icon: <IconDashboard /> },
      { id: 'system', label: 'Control plane', href: '/system', icon: <IconConsole /> },
      { id: 'wallet', label: 'Wallet', href: '/wallet', icon: <IconWallet /> },
      { id: 'network', label: 'Network', href: '/network', icon: <IconNetwork /> },
      { id: 'history', label: 'History', href: '/history', icon: <IconHistory /> },
    ],
  },
  { kind: 'separator' },
  {
    kind: 'items',
    items: [
      {
        id: 'gpulse',
        label: 'G-Pulse',
        href: '/g-pulse',
        icon: <IconGpulse />,
        variant: 'premium',
      },
    ],
  },
  { kind: 'separator' },
  {
    kind: 'items',
    label: 'System',
    items: [
      { id: 'settings', label: 'Settings', href: '/settings', icon: <IconSettings /> },
      { id: 'support', label: 'Support', href: '/support', icon: <IconSupport /> },
      {
        id: 'legacy',
        label: 'Legacy fallback',
        href: '/genesis',
        icon: <IconLegacy />,
      },
    ],
  },
];

function gpulseIndicatorFromStore(
  connected: boolean,
  status: string,
): GpulseIndicatorState {
  if (status === 'syncing') return 'syncing';
  if (connected) return 'connected';
  return 'offline';
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useExternalContext();
  const gpulse = useGenesisStore((s) => s.gpulse);
  const realtimeWs = useGenesisStore((s) => s.realtimeWs);
  const [livePulse, setLivePulse] = useState(false);
  const [aiPulse, setAiPulse] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const off = subscribe('gpulse:realtime:update', () => {
      clearTimeout(t);
      setLivePulse(true);
      t = setTimeout(() => setLivePulse(false), 2400);
    });
    return () => {
      clearTimeout(t);
      off();
    };
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const off = subscribe('gpulse:ai:update', () => {
      clearTimeout(t);
      setAiPulse(true);
      t = setTimeout(() => setAiPulse(false), 3200);
    });
    return () => {
      clearTimeout(t);
      off();
    };
  }, []);

  const showAiActive = gpulse.autoMode || aiPulse;

  const title = ROUTE_TITLES[location.pathname] ?? 'Backoffice';
  const gpulseIndicator = gpulseIndicatorFromStore(gpulse.connected, gpulse.status);

  return (
    <AppShell
      sidebar={
        <Sidebar
          rows={SIDEBAR_ROWS}
          activePath={location.pathname}
          onNavigate={(href) => navigate(href)}
          footer={<span className="font-mono">v2 · realtime handshake</span>}
        />
      }
    >
      <Topbar
        title={title}
        subtitle="Ai Génesis · Backoffice"
        banner={
          realtimeWs.reconnecting && !realtimeWs.connected ? (
            <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-amber-300/95">
              <span
                className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400"
                style={{ boxShadow: '0 0 10px rgba(251, 191, 36, 0.65)' }}
              />
              Reconnecting…
            </span>
          ) : null
        }
        gpulseIndicator={gpulseIndicator}
        actions={
          <div className="flex items-center gap-2">
            {livePulse ? (
              <span
                className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/[0.08] px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-200/95 transition-opacity duration-500 ease-out"
                style={{ boxShadow: '0 0 18px rgba(34, 211, 238, 0.12)' }}
              >
                <span
                  className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-cyan-400"
                  style={{ boxShadow: '0 0 12px rgba(34, 211, 238, 0.85)' }}
                />
                Live
              </span>
            ) : null}
            {showAiActive ? (
              <span
                className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/[0.1] px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200/95 transition-all duration-500 ease-out"
                style={{ boxShadow: '0 0 20px rgba(217, 70, 239, 0.18)' }}
              >
                <span
                  className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-fuchsia-400"
                  style={{ boxShadow: '0 0 12px rgba(217, 70, 239, 0.85)' }}
                />
                AI active
              </span>
            ) : null}
            <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-white/50 backdrop-blur-md">
              {ctx.isAuthenticated ? 'authenticated' : 'guest'}
            </span>
          </div>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </AppShell>
  );
}
