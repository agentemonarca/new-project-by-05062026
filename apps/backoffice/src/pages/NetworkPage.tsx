import { useId, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GlassCard, GlowContainer, MetricCard, NeonButton } from '@ai-genesis/ui';
import InlineSpinner from '@/components/system/InlineSpinner';
import { LegacyGenesisFallback } from '@/components/genesis/LegacyGenesisFallback';
import { useGenesisData, useGenesisNetworkSlice } from '@/hooks/useGenesisData';

function MetricSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-5">
      <div className="h-2.5 w-20 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-7 w-16 animate-pulse rounded bg-white/10" />
    </div>
  );
}

const CHART_H = 120;

function GrowthBars({ volume, referrals }: { volume: number; referrals: number }) {
  const bars = useMemo(() => {
    const seed = Math.max(1, volume + referrals * 2);
    return Array.from({ length: 8 }, (_, i) => {
      const wave = Math.sin((i + 1) * 0.85) * 0.25 + 0.75;
      const bump = ((seed * (i + 3)) % 37) / 100;
      return Math.min(1, Math.max(0.08, (0.35 + bump + wave * 0.22) * 0.85));
    });
  }, [volume, referrals]);

  return (
    <div className="mt-4 flex h-36 items-end justify-between gap-1.5 sm:gap-2">
      {bars.map((ratio, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col justify-end" title={`Segment ${i + 1}`}>
          <motion.div
            className="w-full rounded-t-md bg-gradient-to-t from-violet-600/40 via-cyan-500/50 to-cyan-400/80"
            initial={{ height: 0 }}
            animate={{ height: Math.round(ratio * CHART_H) }}
            transition={{ duration: 0.5, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      ))}
    </div>
  );
}

/** Lightweight sparkline from volume/referrals (illustrative). */
function NetworkSparkline({ volume, referrals }: { volume: number; referrals: number }) {
  const gradId = useId().replace(/:/g, '');
  const { points, w, h } = useMemo(() => {
    const w = 200;
    const h = 48;
    const seed = Math.max(1, volume + referrals * 3);
    const vals = Array.from({ length: 12 }, (_, i) => {
      const n = Math.sin(i * 0.5) * 0.35 + 0.5 + ((seed + i * 7) % 23) / 100;
      return Math.min(1, Math.max(0.05, n));
    });
    const pts = vals
      .map((v, i) => {
        const x = (i / (vals.length - 1)) * (w - 4) + 2;
        const y = h - 4 - v * (h - 8);
        return `${x},${y}`;
      })
      .join(' ');
    return { points: pts, w, h };
  }, [volume, referrals]);

  return (
    <svg
      width={w}
      height={h}
      className="mt-3 w-full max-w-[220px] text-cyan-400/90"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgb(34, 211, 238)" />
          <stop offset="100%" stopColor="rgb(167, 139, 250)" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function NetworkPage() {
  const { loading, refreshing, error, refresh } = useGenesisData();
  const { networkStats: ns } = useGenesisNetworkSlice();

  const referrals = ns?.referrals ?? 0;
  const volume = ns?.volume ?? 0;
  const rank = ns?.rank ?? '—';

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      {error ? <LegacyGenesisFallback message="Core API unreachable — network metrics could not be loaded." /> : null}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.38em] text-purple-200/65">Network</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Genesis network</h1>
          </div>
          <NeonButton
            type="button"
            variant="ghost"
            onClick={() => void refresh()}
            disabled={refreshing}
            title="Refetch network metrics"
          >
            {refreshing ? (
              <span className="inline-flex items-center gap-2">
                <InlineSpinner />
                Refreshing
              </span>
            ) : (
              'Refresh'
            )}
          </NeonButton>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <GlowContainer className="rounded-2xl" accent="cyan">
              <GlassCard className="border-cyan-500/12 !p-0">
                <div className="p-5">
                  <MetricCard label="Referrals" value={String(referrals)} hint="Queue completed (proxy)" />
                </div>
              </GlassCard>
            </GlowContainer>
            <GlowContainer className="rounded-2xl" accent="purple">
              <GlassCard className="border-purple-500/12 !p-0">
                <div className="p-5">
                  <MetricCard label="Team volume" value={String(volume)} hint="Active + waiting jobs" />
                </div>
              </GlassCard>
            </GlowContainer>
            <GlowContainer className="rounded-2xl sm:col-span-2 xl:col-span-1" accent="cyan">
              <GlassCard className="border-cyan-500/12 !p-0">
                <div className="p-5">
                  <MetricCard label="Rank" value={rank} hint="Health + scale signal" />
                </div>
              </GlassCard>
            </GlowContainer>
          </div>
        )}

        <GlowContainer className="rounded-2xl" accent="purple">
          <GlassCard className="border-purple-500/10">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/45">Growth</p>
            <h2 className="mt-2 text-lg font-bold text-white">Trend</h2>
            <p className="mt-1 text-xs text-white/40">
              Sparkline + bars are illustrative (seeded from live volume/referrals). Replace with time-series when
              available.
            </p>
            {loading ? (
              <div className="mt-6 h-36 animate-pulse rounded-xl bg-white/[0.05]" />
            ) : (
              <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-white/35">Sparkline</p>
                  <NetworkSparkline volume={volume} referrals={referrals} />
                </div>
                <div className="min-w-0 flex-1">
                  <GrowthBars volume={volume} referrals={referrals} />
                </div>
              </div>
            )}
          </GlassCard>
        </GlowContainer>
      </motion.div>
    </div>
  );
}
