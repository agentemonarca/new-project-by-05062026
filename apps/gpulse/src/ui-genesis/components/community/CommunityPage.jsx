import React, { useCallback, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  Binary,
  Copy,
  GitBranch,
  Link2,
  Share2,
  Sparkles,
  Sprout,
} from 'lucide-react';
import { AnimatedMetric } from '../AnimatedMetric.jsx';
import { usdToAig } from '../../../utils/pricing.js';
import { staggerContainer, fadeUpBlur } from '../../motion/variants.js';
import { useGenesisDashboardStore } from '../../stores/genesisDashboardStore.js';
import { getDevMockBearer } from '../../api/genesisConfig.js';
import { useWallet } from '../../../context/WalletContext.jsx';
import { BinaryNetworkTree } from './BinaryNetworkTree.jsx';
import { BinaryControlPanel } from '../binary/BinaryControlPanel.jsx';
import { RuleHint } from '../RuleHint.jsx';

/** Demo rows when API has no referral list yet */
const DEMO_REFERRALS = [
  { id: '1', user: '0x71…3a2f', status: 'active', activity: 'Mining · booster' },
  { id: '2', user: '0x9c…e1b0', status: 'active', activity: 'Staking' },
  { id: '3', user: '0x44…9021', status: 'pending', activity: 'Joined' },
  { id: '4', user: '0x22…bba4', status: 'active', activity: 'Mining' },
];

function shortenRef(s) {
  if (!s || s.length < 14) return s || '—';
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function CommunityPage({ canViewFullNetwork = true }) {
  const reduceMotion = useReducedMotion();
  const wallet = useGenesisDashboardStore((s) => s.wallet);
  const network = useGenesisDashboardStore((s) => s.network);
  const earnings = useGenesisDashboardStore((s) => s.earnings);
  const authToken = useGenesisDashboardStore((s) => s.authToken);
  const sessionAuth = useGenesisDashboardStore((s) => s.sessionAuth);
  const hasSession = Boolean(authToken || sessionAuth || getDevMockBearer());
  const { address } = useWallet();
  const [copied, setCopied] = useState(false);

  const leftVol = Number(network?.leftMonth ?? 0);
  const rightVol = Number(network?.rightMonth ?? 0);
  const totalVol = leftVol + rightVol;
  const directClaim = Number(wallet?.directClaimableUsdt ?? 0);

  const binaryBalancePct =
    totalVol > 0 ? Math.round((100 * 2 * Math.min(leftVol, rightVol)) / totalVol) : 0;
  const imbalance = Math.abs(leftVol - rightVol);
  const imbalancePct = totalVol > 0 ? Math.round((100 * imbalance) / totalVol) : 0;

  const directAig = usdToAig(directClaim);
  const binaryAig = usdToAig(Math.min(leftVol, rightVol));
  const totalAigRewards = useMemo(
    () => directAig + binaryAig + Math.min(leftVol, rightVol) * 0.05,
    [directAig, binaryAig, leftVol, rightVol],
  );

  /** Binary bonus “accumulated” layer (UI estimate from network symmetry) */
  const binaryAccumulatedAig = usdToAig(Math.min(leftVol, rightVol)) * 0.85;

  const referralSource = useMemo(() => {
    const raw = earnings?.entries;
    if (Array.isArray(raw) && raw.length > 0) return { rows: raw.slice(0, 8), mode: 'ledger' };
    return { rows: DEMO_REFERRALS, mode: 'demo' };
  }, [earnings?.entries]);

  const referralRows = useMemo(() => {
    if (referralSource.mode === 'ledger') {
      return referralSource.rows.map((e) => {
        const row = e && typeof e === 'object' ? e : {};
        const parts = [row.category, row.referenceType].filter(Boolean);
        return {
          id: String(row.id ?? ''),
          user: shortenRef(String(row.referenceId ?? row.id ?? '')),
          status: row.direction === 'DEBIT' ? 'pending' : 'active',
          activity: parts.join(' · ') || 'Ledger',
        };
      });
    }
    return referralSource.rows;
  }, [referralSource]);

  const referralCount = useMemo(() => {
    if (referralSource.mode === 'ledger') return Math.min(earnings?.entries?.length ?? referralSource.rows.length, 99);
    return DEMO_REFERRALS.length;
  }, [referralSource, earnings?.entries?.length]);

  const referralUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const ref = address || 'your-wallet';
    return `${base}/dashboard?nav=gpulse-lobby&ref=${encodeURIComponent(ref)}`;
  }, [address]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [referralUrl]);

  const share = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'AiGenesis', text: 'Join my network', url: referralUrl });
      } catch {
        copyLink();
      }
    } else {
      copyLink();
    }
  }, [referralUrl, copyLink]);

  return (
    <motion.div className="space-y-8" variants={staggerContainer} initial="hidden" animate="show">
      {/* 1. Header */}
      <motion.header variants={fadeUpBlur} className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-950/70 p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_30%_-10%,rgba(52,211,153,0.15),transparent_55%)]" />
        <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-emerald-300/90">
              <Sprout className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Network</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Comunidad</h1>
            <p className="mt-2 max-w-xl text-sm text-emerald-100/70">Expand your network — organic growth, shared rewards.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100">
            <Activity className="h-4 w-4" />
            Live sync
          </div>
        </div>
      </motion.header>

      <motion.div variants={fadeUpBlur} className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
        <RuleHint
          variant="inline"
          message="Se paga por el lado menor del binario; el panel inferior usa tu volumen API. Las recompensas estimadas son referencia de interfaz."
          linkText="ℹ️ Reglas de red"
          modalTitle="Red binaria"
          modalContent={
            <p className="text-slate-300">
              Match y consumo de volumen siguen el motor del protocolo. Para el historial detallado abre Historial operativo.
            </p>
          }
        />
      </motion.div>

      <BinaryControlPanel hasSession={hasSession} apiLeft={leftVol} apiRight={rightVol} />

      {/* 2. Global summary */}
      <motion.section variants={fadeUpBlur} className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Total AIG rewards (est.)',
            value: totalAigRewards,
            fmt: (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }),
            suffix: ' AIG',
            sub: 'Direct + binary layers',
          },
          {
            label: 'Binary rewards',
            value: binaryAig,
            fmt: (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }),
            suffix: ' AIG',
            sub: 'From leg volume',
          },
          {
            label: 'Direct rewards',
            value: directAig,
            fmt: (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }),
            suffix: ' AIG',
            sub: 'Referral stream',
          },
        ].map((row) => (
          <div
            key={row.label}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-[0_0_32px_-12px_rgba(16,185,129,0.2)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-600/10 via-transparent to-teal-500/5" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{row.label}</p>
            <p className="relative mt-2 font-display text-2xl font-bold tabular-nums text-white">
              <AnimatedMetric value={row.value} format={(v) => `${row.fmt(v)}${row.suffix}`} />
            </p>
            <p className="relative mt-1 text-[11px] text-slate-500">{row.sub}</p>
          </div>
        ))}
      </motion.section>

      {!canViewFullNetwork ? (
        <motion.section
          variants={fadeUpBlur}
          className="rounded-xl border border-cyan-500/20 bg-slate-950/50 px-4 py-4 text-sm text-slate-300"
        >
          <p className="font-medium text-cyan-100/90">Vista de red limitada</p>
          <p className="mt-1 text-xs text-slate-500">
            Tu rol permite ver el resumen de volumen arriba; el árbol binario, bonos detallados y el listado de referidos
            están ocultos.
          </p>
        </motion.section>
      ) : null}

      {/* 3. Binary tree */}
      {canViewFullNetwork ? (
      <motion.section variants={fadeUpBlur} className="relative overflow-hidden rounded-2xl border border-teal-500/20 bg-slate-950/65 p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <motion.div
            className="absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2"
            style={{
              background: 'conic-gradient(from 0deg, rgba(45,212,191,0.15), rgba(16,185,129,0.08), rgba(45,212,191,0.15))',
            }}
            animate={reduceMotion ? { rotate: 0 } : { rotate: 360 }}
            transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <div className="relative z-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
              <GitBranch className="h-5 w-5 text-teal-400" />
              Binary tree
            </h2>
            <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs text-teal-100">
              Balance {binaryBalancePct}%
            </span>
          </div>

          <BinaryNetworkTree rootLabel="You" maxDepth={4} />

          <div className="mt-6 grid grid-cols-2 gap-4">
            {[
              { side: 'Left leg', vol: leftVol, grad: 'from-emerald-500/30 to-teal-500/10' },
              { side: 'Right leg', vol: rightVol, grad: 'from-cyan-500/25 to-emerald-500/10' },
            ].map(({ side, vol, grad }) => (
              <motion.div
                key={side}
                className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${grad} p-4 text-center`}
                whileHover={reduceMotion ? undefined : { y: -2 }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{side}</p>
                <p className="mt-2 font-display text-2xl font-bold tabular-nums text-white">{vol}</p>
                <p className="mt-1 text-[10px] text-slate-500">volume (live)</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Binary className="h-4 w-4 text-violet-400" />
              <span>Imbalance</span>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-semibold tabular-nums text-amber-200/95">{imbalancePct}%</p>
              <p className="text-[10px] text-slate-500">Δ {imbalance} pts · grow the weaker leg</p>
            </div>
          </div>
        </div>
      </motion.section>
      ) : null}

      {canViewFullNetwork ? (
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 4. Binary bonus */}
        <motion.section variants={fadeUpBlur} className="rounded-2xl border border-violet-500/20 bg-slate-950/60 p-5 md:p-6">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
            <Sparkles className="h-4 w-4 text-violet-400" />
            Binary bonus
          </h2>
          <p className="mt-1 text-xs text-slate-500">Accumulated AIG (estimate from network)</p>
          <p className="mt-4 font-display text-3xl font-bold tabular-nums text-white">
            <AnimatedMetric
              value={binaryAccumulatedAig}
              format={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} AIG`}
            />
          </p>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[10px] text-slate-500">
              <span>Progress to balance</span>
              <span>{binaryBalancePct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400"
                initial={false}
                animate={{ width: `${binaryBalancePct}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </motion.section>

        {/* 5. Direct bonus */}
        <motion.section variants={fadeUpBlur} className="rounded-2xl border border-cyan-500/20 bg-slate-950/60 p-5 md:p-6">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
            <Link2 className="h-4 w-4 text-cyan-400" />
            Direct bonus
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Referrals</p>
              <p className="mt-1 font-display text-2xl font-bold text-white">{referralCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">AIG rewards</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-cyan-200">
                <AnimatedMetric
                  value={directAig}
                  format={(v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                />
              </p>
            </div>
          </div>
        </motion.section>
      </div>
      ) : null}

      {/* 6. Referral list */}
      {canViewFullNetwork ? (
      <motion.section variants={fadeUpBlur}>
        <h2 className="font-display text-base font-semibold text-white">Referral list</h2>
        <p className="mb-3 text-xs text-slate-500">
          {referralSource.mode === 'ledger' ? 'Recent ledger lines (proxy for referrals until API exposes tree).' : 'Example rows — your invites appear here.'}
        </p>
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/50">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Activity</th>
              </tr>
            </thead>
            <tbody>
              {referralRows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-slate-200">{r.user}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        r.status === 'active'
                          ? 'border border-emerald-500/35 bg-emerald-500/15 text-emerald-200'
                          : 'border border-amber-500/35 bg-amber-500/10 text-amber-200'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{r.activity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!hasSession ? (
          <p className="mt-2 text-xs text-slate-500">Sign in to sync network and ledger data.</p>
        ) : null}
      </motion.section>
      ) : null}

      {/* 7. Referral link */}
      {canViewFullNetwork ? (
      <motion.section variants={fadeUpBlur} className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 to-slate-950/80 p-5 md:p-6">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
          <Share2 className="h-4 w-4 text-emerald-400" />
          Your referral link
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-xs text-slate-300">
            {referralUrl}
          </div>
          <div className="flex gap-2">
            <motion.button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-100"
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Copied' : 'Copy'}
            </motion.button>
            <motion.button
              type="button"
              onClick={share}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              Share
            </motion.button>
          </div>
        </div>
      </motion.section>
      ) : null}

      {/* 8. Impact */}
      {canViewFullNetwork ? (
      <motion.section variants={fadeUpBlur} className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 md:p-6">
        <h2 className="font-display text-base font-semibold text-white">How your network affects mining</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-300">
          <li className="flex gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
            Higher balanced volume increases binary reward potential feeding your cores.
          </li>
          <li className="flex gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            Direct referrals add a parallel reward stream alongside engine generation.
          </li>
          <li className="flex gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.45)]" />
            Keeping legs balanced reduces wasted imbalance — shown above in real time.
          </li>
        </ul>
      </motion.section>
      ) : null}
    </motion.div>
  );
}
