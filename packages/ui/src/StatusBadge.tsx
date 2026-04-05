import { motion } from 'framer-motion';

export type ConnectionBadgeVariant = 'connected' | 'syncing' | 'offline';
export type ExecutionBadgeVariant = 'idle' | 'running' | 'paused' | 'syncing';

export interface StatusBadgeProps {
  variant: ConnectionBadgeVariant | ExecutionBadgeVariant;
  label: string;
  /** When true, render as connection-style pill (glow dot) */
  style?: 'connection' | 'execution';
}

const connectionCfg: Record<ConnectionBadgeVariant, { dot: string; glow: string; border: string }> = {
  connected: {
    dot: '#34d399',
    glow: 'rgba(52, 211, 153, 0.45)',
    border: 'rgba(52, 211, 153, 0.35)',
  },
  syncing: {
    dot: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.45)',
    border: 'rgba(251, 191, 36, 0.35)',
  },
  offline: {
    dot: '#f87171',
    glow: 'rgba(248, 113, 113, 0.4)',
    border: 'rgba(248, 113, 113, 0.35)',
  },
};

const executionCfg: Record<string, { dot: string; glow: string; border: string }> = {
  idle: { dot: '#94a3b8', glow: 'rgba(148, 163, 184, 0.35)', border: 'rgba(148, 163, 184, 0.3)' },
  running: { dot: '#22d3ee', glow: 'rgba(34, 211, 238, 0.45)', border: 'rgba(34, 211, 238, 0.35)' },
  paused: { dot: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)', border: 'rgba(192, 132, 252, 0.35)' },
  syncing: { dot: '#fbbf24', glow: 'rgba(251, 191, 36, 0.45)', border: 'rgba(251, 191, 36, 0.35)' },
};

export function StatusBadge({ variant, label, style = 'connection' }: StatusBadgeProps) {
  const cfg =
    style === 'connection'
      ? connectionCfg[variant as ConnectionBadgeVariant]
      : executionCfg[variant] ?? executionCfg.idle;

  return (
    <motion.div
      initial={{ opacity: 0.85 }}
      animate={{ opacity: 1 }}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur-md"
      style={{
        borderColor: cfg.border,
        background: `linear-gradient(135deg, rgba(11,15,26,0.92) 0%, rgba(7,11,20,0.75) 100%)`,
        boxShadow: `0 0 18px ${cfg.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      <span
        className="relative h-2 w-2 shrink-0 rounded-full"
        style={{
          backgroundColor: cfg.dot,
          boxShadow: `0 0 12px ${cfg.glow}`,
        }}
      >
        {variant === 'syncing' ? (
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-50"
            style={{ backgroundColor: cfg.dot }}
          />
        ) : null}
      </span>
      <span>{label}</span>
    </motion.div>
  );
}
