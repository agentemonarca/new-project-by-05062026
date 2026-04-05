import type { ReactNode } from 'react';
import { tokens } from './tokens.js';

export type GpulseIndicatorState = 'connected' | 'syncing' | 'offline';

export interface TopbarProps {
  title: string;
  subtitle?: string;
  /** Optional status row under subtitle (e.g. WebSocket reconnecting). */
  banner?: ReactNode;
  actions?: ReactNode;
  /** Live G-Pulse link status for the control plane */
  gpulseIndicator?: GpulseIndicatorState | null;
}

function GpulseStatusPill({ state }: { state: GpulseIndicatorState }) {
  const cfg =
    state === 'connected'
      ? {
          label: 'G-Pulse connected',
          dot: '#34d399',
          glow: 'rgba(52, 211, 153, 0.45)',
          border: 'rgba(52, 211, 153, 0.35)',
        }
      : state === 'syncing'
        ? {
            label: 'Syncing…',
            dot: '#fbbf24',
            glow: 'rgba(251, 191, 36, 0.45)',
            border: 'rgba(251, 191, 36, 0.35)',
          }
        : {
            label: 'Offline',
            dot: '#f87171',
            glow: 'rgba(248, 113, 113, 0.4)',
            border: 'rgba(248, 113, 113, 0.35)',
          };

  return (
    <div
      className="flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur-md transition-all duration-300"
      style={{
        borderColor: cfg.border,
        background: `linear-gradient(135deg, rgba(11,15,26,0.9) 0%, rgba(7,11,20,0.75) 100%)`,
        boxShadow: `0 0 20px ${cfg.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
      role="status"
      aria-live="polite"
    >
      <span
        className="relative flex h-2 w-2 shrink-0 rounded-full"
        style={{
          backgroundColor: cfg.dot,
          boxShadow: `0 0 10px ${cfg.glow}`,
        }}
      >
        {state === 'syncing' ? (
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-60"
            style={{ backgroundColor: cfg.dot }}
          />
        ) : null}
      </span>
      <span className="text-white/90">{cfg.label}</span>
    </div>
  );
}

export function Topbar({ title, subtitle, banner, actions, gpulseIndicator }: TopbarProps) {
  const { colors } = tokens;
  return (
    <header
      className="relative flex h-16 shrink-0 items-center justify-between gap-4 overflow-hidden border-b border-white/[0.06] px-8 backdrop-blur-[22px]"
      style={{
        background: `linear-gradient(180deg, rgba(11,15,26,0.96) 0%, rgba(7,11,20,0.65) 100%)`,
        boxShadow: `inset 0 -1px 0 rgba(0, 240, 255, 0.05)`,
      }}
    >
      <div className="min-w-0">
        <h1 className="text-sm font-black uppercase tracking-[0.28em] text-white/90">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-[10px] font-mono uppercase tracking-widest text-white/40">{subtitle}</p>
        ) : null}
        {banner ? (
          <div className="mt-1.5 transition-opacity duration-300 ease-out">{banner}</div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {gpulseIndicator ? <GpulseStatusPill state={gpulseIndicator} /> : null}
        {actions}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${colors.cyan}44 40%, ${colors.magenta}33 60%, transparent 100%)`,
        }}
      />
    </header>
  );
}
