import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { tokens } from './tokens.js';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  /** Premium module row (G-Pulse) — glow + hierarchy */
  variant?: 'default' | 'premium';
}

export type SidebarRow =
  | { kind: 'separator' }
  | { kind: 'items'; items: NavItem[]; label?: string };

export interface SidebarProps {
  rows: SidebarRow[];
  activePath: string;
  onNavigate: (href: string) => void;
  brand?: ReactNode;
  footer?: ReactNode;
}

export function Sidebar({ rows, activePath, onNavigate, brand, footer }: SidebarProps) {
  const { colors } = tokens;

  return (
    <aside
      className="flex h-full w-[272px] shrink-0 flex-col border-r border-cyan-500/[0.08] py-6 pl-5 pr-3 backdrop-blur-[22px]"
      style={{
        background: `linear-gradient(165deg, ${colors.secondary}ee 0%, ${colors.bg} 55%, #050810 100%)`,
        boxShadow: `inset -1px 0 0 rgba(0, 240, 255, 0.04)`,
      }}
    >
      <div className="mb-7 px-2">
        <div className="font-black tracking-[0.38em] text-[10px] uppercase text-white/90">
          {brand ?? (
            <>
              <span style={{ color: colors.cyan }}>Ai</span> Génesis
            </>
          )}
        </div>
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">Control plane</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {rows.map((row, idx) => {
          if (row.kind === 'separator') {
            return (
              <div
                key={`sep-${idx}`}
                className="my-3 h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
                aria-hidden
              />
            );
          }

          return (
            <div key={`grp-${idx}`} className="space-y-1">
              {row.label ? (
                <p className="mb-1.5 px-3 font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-white/25">
                  {row.label}
                </p>
              ) : null}
              {row.items.map((item) => {
                const active = activePath === item.href;
                const premium = item.variant === 'premium';

                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.href)}
                    className={[
                      'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-300 ease-out',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40',
                      premium
                        ? 'border border-transparent'
                        : 'border border-transparent hover:border-white/[0.06]',
                      active && !premium ? 'text-white' : !premium ? 'text-white/45 hover:text-white/80' : '',
                      premium && !active ? 'text-white/85 hover:text-white' : '',
                      premium && active ? 'text-white' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={
                      premium
                        ? {
                            background: active
                              ? `linear-gradient(120deg, rgba(0,240,255,0.14) 0%, rgba(123,44,255,0.18) 100%)`
                              : `linear-gradient(120deg, rgba(0,240,255,0.06) 0%, rgba(255,0,200,0.08) 100%)`,
                            borderColor: active ? 'rgba(0, 240, 255, 0.35)' : 'rgba(0, 240, 255, 0.15)',
                            boxShadow: active
                              ? `0 0 28px rgba(0, 240, 255, 0.2), 0 0 48px rgba(123, 44, 255, 0.12), inset 0 1px 0 rgba(255,255,255,0.08)`
                              : `0 0 20px rgba(0, 240, 255, 0.08), inset 0 1px 0 rgba(255,255,255,0.04)`,
                          }
                        : active
                          ? {
                              background: `linear-gradient(90deg, ${colors.purple}2a 0%, transparent 100%)`,
                              borderLeft: `2px solid ${colors.cyan}`,
                            }
                          : { borderLeft: '2px solid transparent' }
                    }
                    whileHover={{ x: premium ? 0 : 3 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {premium ? (
                      <span
                        className="pointer-events-none absolute inset-0 rounded-xl opacity-40 blur-xl"
                        style={{
                          background: `radial-gradient(ellipse at 20% 50%, ${colors.cyan}55 0%, transparent 65%)`,
                        }}
                        aria-hidden
                      />
                    ) : null}
                    {item.icon ? (
                      <span
                        className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${
                          premium
                            ? 'bg-white/[0.08] text-cyan-200 group-hover:bg-white/[0.12]'
                            : active
                              ? 'bg-cyan-400/15 text-cyan-300'
                              : 'bg-white/[0.04] text-white/50 group-hover:bg-white/[0.07] group-hover:text-white/70'
                        }`}
                      >
                        {item.icon}
                      </span>
                    ) : null}
                    <span className="relative z-[1] flex flex-1 flex-col gap-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{item.label}</span>
                      {premium ? (
                        <span className="font-mono text-[8px] uppercase tracking-widest text-cyan-200/70">
                          Execution engine
                        </span>
                      ) : null}
                    </span>
                    {premium ? (
                      <span
                        className="relative z-[1] text-sm opacity-90"
                        style={{ filter: `drop-shadow(0 0 8px ${colors.cyan})` }}
                        aria-hidden
                      >
                        ⚡
                      </span>
                    ) : null}
                  </motion.button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {footer ? (
        <div className="mt-auto border-t border-white/[0.06] pt-4 text-[10px] text-white/35">{footer}</div>
      ) : null}
    </aside>
  );
}
