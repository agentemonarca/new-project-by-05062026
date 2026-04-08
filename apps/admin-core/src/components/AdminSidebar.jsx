import React, { memo, useCallback } from 'react';
import {
  Activity,
  BarChart3,
  Bug,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Radio,
  Repeat2,
  Trophy,
} from 'lucide-react';

const BINANCE_BG = '#0B0E11';
const BINANCE_BORDER = '#2B3139';

const NAV_ITEMS = [
  { id: 'signals', label: 'Signals', icon: Radio },
  { id: 'live', label: 'Live', icon: Activity },
  { id: 'results', label: 'Results', icon: Trophy },
  { id: 'martingale', label: 'Martingale', icon: Repeat2 },
  { id: 'vistalab', label: 'VistaLab', icon: FlaskConical },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'debug', label: 'Debug', icon: Bug },
];

/**
 * Navegación interna por estado (sin react-router).
 * @param {{
 *   view: string,
 *   onViewChange: (id: string) => void,
 *   collapsed: boolean,
 *   onToggleCollapsed: () => void,
 * }} props
 */
function AdminSidebarInner({ view, onViewChange, collapsed, onToggleCollapsed }) {
  const width = collapsed ? 70 : 220;

  const onKeyNav = useCallback(
    (e, id) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onViewChange(id);
      }
    },
    [onViewChange],
  );

  return (
    <aside
      className="flex shrink-0 flex-col border-r transition-[width] duration-200 ease-out"
      style={{
        width,
        backgroundColor: BINANCE_BG,
        borderColor: BINANCE_BORDER,
      }}
      aria-label="Navegación del panel"
    >
      <div className="flex h-12 shrink-0 items-center justify-end border-b px-2" style={{ borderColor: BINANCE_BORDER }}>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#EAECEF] transition-colors duration-200 hover:bg-white/[0.06]"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      <nav className="custom-scrollbar flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={collapsed ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
              onClick={() => onViewChange(item.id)}
              onKeyDown={(e) => onKeyNav(e, item.id)}
              className={`flex w-full items-center gap-3 rounded-lg py-2.5 pl-3 pr-2 text-left transition-colors duration-200 ${
                active
                  ? 'bg-[rgba(252,213,53,0.08)] text-[#FCD535]'
                  : 'text-[#B7BDC6] hover:bg-white/[0.05]'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-[#FCD535]' : 'text-[#848E9C]'}`}
                strokeWidth={2}
                aria-hidden
              />
              <span
                className={`truncate text-[13px] font-medium transition-opacity duration-200 ${
                  collapsed ? 'pointer-events-none w-0 opacity-0' : 'opacity-100'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div
        className="shrink-0 border-t px-2 py-2 text-[9px] uppercase tracking-wider"
        style={{ borderColor: BINANCE_BORDER, color: '#5E6673' }}
      >
        {!collapsed ? <span className="block truncate px-1">AiGenesis · admin</span> : <span className="sr-only">Admin</span>}
      </div>
    </aside>
  );
}

export const AdminSidebar = memo(AdminSidebarInner);
AdminSidebar.displayName = 'AdminSidebar';
