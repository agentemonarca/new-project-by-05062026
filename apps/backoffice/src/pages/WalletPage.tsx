import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard, GlowContainer, MetricCard, NeonButton, SignalList, type SignalEntry } from '@ai-genesis/ui';
import { useGenesisStore } from '@ai-genesis/state';
import InlineSpinner from '@/components/system/InlineSpinner';
import { LegacyGenesisFallback } from '@/components/genesis/LegacyGenesisFallback';
import { useGenesisData, useGenesisWalletSlice } from '@/hooks/useGenesisData';

const ACTIVITY_LIMIT = 18;

function shortenAddress(addr: string | null | undefined, head = 6, tail = 4): string {
  if (!addr || addr.length < head + tail + 3) return addr || '—';
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6">
      <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
      <div className="mt-4 h-10 w-48 animate-pulse rounded bg-white/10" />
    </div>
  );
}

export default function WalletPage() {
  const { loading, refreshing, error, refresh } = useGenesisData();
  const { wallet: walletStr, balance, activity } = useGenesisWalletSlice();
  const walletSnap = useGenesisStore((s) => s.wallet);

  const [copied, setCopied] = useState(false);

  const fullAddress = walletStr ?? walletSnap?.address ?? null;
  const displayAddress = shortenAddress(fullAddress);

  const signalEntries: SignalEntry[] = useMemo(() => {
    const slice = activity.slice(0, ACTIVITY_LIMIT);
    return slice.map((t) => ({
      id: t.id,
      at: t.timestamp,
      message: t.title,
      detail: t.subtitle,
    }));
  }, [activity]);

  const copyAddress = useCallback(async () => {
    if (!fullAddress) return;
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [fullAddress]);

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      {error ? <LegacyGenesisFallback message="Core API unreachable — wallet data could not be refreshed." /> : null}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.38em] text-cyan-200/65">Wallet</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Genesis wallet</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <NeonButton
              type="button"
              variant="ghost"
              onClick={() => void refresh()}
              disabled={refreshing}
              title="Refetch balance and activity from core-api"
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
            <NeonButton
              type="button"
              variant="ghost"
              onClick={copyAddress}
              disabled={!fullAddress}
              title={fullAddress ? `Copy full address: ${fullAddress}` : 'No address'}
            >
              {copied ? 'Copied' : 'Copy address'}
            </NeonButton>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <CardSkeleton />
            </div>
            <div className="lg:col-span-5">
              <CardSkeleton />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <GlowContainer className="rounded-2xl" accent="purple">
                <GlassCard className="min-h-[160px] border-purple-500/15 !p-0 lg:min-h-[180px]">
                  <div className="p-6 sm:p-8">
                    <MetricCard
                      label="Balance"
                      value={
                        balance != null && Number.isFinite(balance)
                          ? `${balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`
                          : '—'
                      }
                      hint="Core ledger · authenticated session"
                    />
                  </div>
                </GlassCard>
              </GlowContainer>
            </div>
            <div className="lg:col-span-5">
              <GlowContainer className="rounded-2xl" accent="cyan">
                <GlassCard
                  className="border-cyan-500/15"
                  title={fullAddress ?? undefined}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Address</p>
                  <p className="mt-3 font-mono text-base font-semibold tracking-tight text-cyan-100/95 sm:text-lg">
                    {displayAddress}
                  </p>
                  {fullAddress && fullAddress !== displayAddress ? (
                    <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/35" title={fullAddress}>
                      Hover the card for full address · use Copy
                    </p>
                  ) : null}
                </GlassCard>
              </GlowContainer>
            </div>
          </div>
        )}

        <GlowContainer className="rounded-2xl" accent="magenta">
          <GlassCard className="border-fuchsia-500/15">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-fuchsia-200/65">Transaction history</p>
            <h2 className="mt-2 text-lg font-bold text-white">Activity</h2>
            <p className="mt-1 text-xs text-white/40">Last {ACTIVITY_LIMIT} events · ActivityItem from @ai-genesis/types</p>
            {loading ? (
              <div className="mt-4 space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.06]" />
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <SignalList
                  entries={signalEntries}
                  maxVisible={ACTIVITY_LIMIT}
                  emptyLabel="No transactions for this session."
                />
              </div>
            )}
          </GlassCard>
        </GlowContainer>
      </motion.div>
    </div>
  );
}
