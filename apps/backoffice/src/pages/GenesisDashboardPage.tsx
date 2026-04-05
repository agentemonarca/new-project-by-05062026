import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { GlassCard, GlowContainer, MetricCard, NeonButton } from '@ai-genesis/ui';
import { useGenesisStore } from '@ai-genesis/state';
import { useGenesisData } from '@/hooks/useGenesisData';
import SystemPanel from '@/components/system/SystemPanel';
import ControlPanel from '@/components/system/ControlPanel';

function shortenAddress(addr: string | null | undefined, head = 6, tail = 4): string {
  if (!addr || addr.length < head + tail + 3) return addr || '—';
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

function MetricSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-4">
      <div className="h-2.5 w-24 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-8 w-20 animate-pulse rounded bg-white/10" />
      <div className="mt-2 h-2 w-32 animate-pulse rounded bg-white/5" />
    </div>
  );
}

export default function GenesisDashboardPage() {
  const navigate = useNavigate();
  const { loading, error: loadError, refresh } = useGenesisData();

  const dashboard = useGenesisStore((s) => s.dashboard);
  const walletSnap = useGenesisStore((s) => s.wallet);
  const authUser = useGenesisStore((s) => s.user);
  const gpulse = useGenesisStore((s) => s.gpulse);

  const u = dashboard.user;
  const ns = u.networkStats;
  const email =
    u.email ??
    (typeof authUser?.email === 'string' ? authUser.email : undefined) ??
    (typeof authUser?.displayName === 'string' ? authUser.displayName : undefined) ??
    'Operator';
  const walletLine = shortenAddress(u.wallet ?? walletSnap?.address);

  const gpulseConn = gpulse.connected ? 'Connected' : 'Offline';
  const gpulseRun = gpulse.status === 'running' ? 'Running' : gpulse.status === 'paused' ? 'Paused' : 'Idle';

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      {loadError ? (
        <GlowContainer className="rounded-2xl" accent="purple">
          <GlassCard className="max-w-lg border-amber-500/20">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-200/80">Warning</p>
            <h2 className="mt-2 text-lg font-bold text-white">Unable to load data</h2>
            <p className="mt-2 text-sm text-white/50">
              Core API is unreachable. Check the gateway proxy and <code className="text-cyan-300/90">VITE_CORE_API_URL</code>.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <NeonButton type="button" onClick={() => navigate('/genesis')}>
                Open Legacy Genesis
              </NeonButton>
              <NeonButton variant="ghost" type="button" onClick={() => void refresh()}>
                Retry
              </NeonButton>
            </div>
          </GlassCard>
        </GlowContainer>
      ) : (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-6"
      >
        <GlowContainer className="rounded-2xl" accent="cyan">
          <GlassCard glow className="border-cyan-500/15">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.38em] text-cyan-200/65">Genesis</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-white">
                  Welcome back{u.email ? ',' : ''}{' '}
                  <span className="text-cyan-200/95">{email}</span>
                </h1>
                <p className="mt-2 font-mono text-xs text-white/45">
                  Wallet <span className="text-white/75">{walletLine}</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <NeonButton variant="ghost" type="button" onClick={() => navigate('/wallet')}>
                    Wallet
                  </NeonButton>
                  <NeonButton variant="ghost" type="button" onClick={() => navigate('/network')}>
                    Network
                  </NeonButton>
                  <NeonButton variant="ghost" type="button" onClick={() => navigate('/system')}>
                    Control plane
                  </NeonButton>
                </div>
              </div>
              <GlowContainer className="rounded-xl" accent="purple">
                <GlassCard className="min-w-[200px] border-purple-500/20 !p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.28em] text-purple-200/70">G-Pulse</p>
                  <p className="mt-2 font-mono text-[11px] text-white/50">
                    <span className="text-white/35">WS</span>{' '}
                    <span className={gpulse.connected ? 'text-emerald-400' : 'text-rose-300'}>{gpulseConn}</span>
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-white/50">
                    <span className="text-white/35">Engine</span>{' '}
                    <span className="text-violet-300">{gpulseRun}</span>
                  </p>
                  <NeonButton className="mt-3 w-full" type="button" variant="ghost" onClick={() => navigate('/g-pulse')}>
                    Open G-Pulse
                  </NeonButton>
                </GlassCard>
              </GlowContainer>
            </div>
          </GlassCard>
        </GlowContainer>

        <div className="grid gap-4 lg:grid-cols-12">
          {loading ? (
            <>
              <div className="lg:col-span-5">
                <MetricSkeleton />
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:col-span-7">
                <MetricSkeleton />
                <MetricSkeleton />
                <MetricSkeleton />
              </div>
            </>
          ) : (
            <>
              <div className="lg:col-span-5">
                <GlowContainer className="rounded-2xl" accent="cyan">
                  <GlassCard className="h-full min-h-[140px] border-cyan-500/12 !p-0">
                    <div className="p-6">
                      <MetricCard
                        label="Balance"
                        value={
                          u.balance != null && Number.isFinite(u.balance)
                            ? `${u.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`
                            : '—'
                        }
                        hint="Core ledger (session) · native dashboard"
                      />
                    </div>
                  </GlassCard>
                </GlowContainer>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:col-span-7">
                <GlowContainer className="rounded-2xl" accent="purple">
                  <GlassCard className="h-full border-purple-500/12 !p-0">
                    <div className="p-5">
                      <MetricCard
                        label="Referrals"
                        value={ns ? String(ns.referrals) : '—'}
                        hint="Queue completed (live metric)"
                      />
                    </div>
                  </GlassCard>
                </GlowContainer>
                <GlowContainer className="rounded-2xl" accent="cyan">
                  <GlassCard className="h-full border-cyan-500/12 !p-0">
                    <div className="p-5">
                      <MetricCard
                        label="Volume"
                        value={ns ? String(ns.volume) : '—'}
                        hint="Waiting + active jobs"
                      />
                    </div>
                  </GlassCard>
                </GlowContainer>
                <GlowContainer className="rounded-2xl" accent="purple">
                  <GlassCard className="h-full border-purple-500/12 !p-0">
                    <div className="p-5">
                      <MetricCard label="Rank" value={ns?.rank ?? '—'} hint="Health + scale signal" />
                    </div>
                  </GlassCard>
                </GlowContainer>
              </div>
            </>
          )}
        </div>

        <GlowContainer className="rounded-2xl" accent="cyan">
          <GlassCard className="border-cyan-500/10">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-200/60">Recent activity</p>
            <h2 className="mt-2 text-lg font-bold text-white">Ledger</h2>
            {loading ? (
              <ul className="mt-4 space-y-3">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="h-14 animate-pulse rounded-lg bg-white/[0.05]" />
                ))}
              </ul>
            ) : (
              <ul className="mt-4 space-y-3">
                {dashboard.recentActivity.length === 0 ? (
                  <li className="text-sm text-white/40">No on-chain ledger events for this session yet.</li>
                ) : (
                  dashboard.recentActivity.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white/90">{item.title}</p>
                        {item.subtitle ? (
                          <p className="font-mono text-[11px] text-cyan-200/70">{item.subtitle}</p>
                        ) : null}
                      </div>
                      <span className="font-mono text-[10px] text-white/35">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </GlassCard>
        </GlowContainer>

        <div className="space-y-6">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/40">Live systems</p>
          <SystemPanel />
          <ControlPanel />
        </div>
      </motion.div>
      )}
    </div>
  );
}
