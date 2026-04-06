import React from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useLedger } from '../ledger/LedgerContext.jsx';
import { useBinaryEngineStore } from '../binary/binaryEngineStore.js';
import { useAdminCoreSnapshot } from '../admin/useAdminCoreSnapshot.js';
import { AdminBalanceCard } from '../components/admin/AdminBalanceCard.jsx';
import { AdminGenerationCard } from '../components/admin/AdminGenerationCard.jsx';
import { AdminBinaryPanel } from '../components/admin/AdminBinaryPanel.jsx';
import { AdminLedgerConsole } from '../components/admin/AdminLedgerConsole.jsx';
import { AdminInsightsPanel } from '../components/admin/AdminInsightsPanel.jsx';
import { P2PSettings } from '@/modules/admin/components/P2PSettings.jsx';
import { P2PConfigProvider } from '@/modules/p2p/context/P2PConfigContext.jsx';
import { fadeUpBlur, staggerContainer } from '../motion/variants.js';

/**
 * High-level operator console — reuses design system; data is aggregated locally until admin API exists.
 *
 * @param {{ onNavigate?: (id: string) => void }} props
 */
export function AdminCorePanelPage({ onNavigate }) {
  const { events, loading, error, refetch, hasSession } = useLedger();
  const leftPts = useBinaryEngineStore((s) => s.leftPoints);
  const rightPts = useBinaryEngineStore((s) => s.rightPoints);

  const snap = useAdminCoreSnapshot({
    events: hasSession ? events : [],
    leftPts,
    rightPts,
  });

  const performers = [
    { id: 'p1', label: 'Pool institucional A', rateFactor: 2.31 },
    { id: 'p2', label: 'Pool retail B', rateFactor: 1.88 },
    { id: 'p3', label: 'Boosters sur', rateFactor: 1.54 },
  ];

  return (
    <motion.div className="space-y-8" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={fadeUpBlur} className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-slate-950/75 px-5 py-6 md:px-8 md:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_80%_-10%,rgba(251,191,36,0.12),transparent_55%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-500/10 text-amber-200">
              <Shield className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/80">Control plane</p>
              <h1 className="font-display text-2xl font-bold text-white md:text-3xl">Admin Core Panel</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                Métricas agregadas, libro filtrable y señales operativas. Misma estética Genesis, lógica elevada.
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      {!hasSession ? (
        <motion.p variants={fadeUpBlur} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Inicia sesión para hidratar el libro y las series administrativas en vivo.
        </motion.p>
      ) : null}
      {error ? (
        <motion.p variants={fadeUpBlur} className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {error}
        </motion.p>
      ) : null}

      <motion.div variants={fadeUpBlur} className="grid gap-4 lg:grid-cols-2">
        <AdminBalanceCard
          title="Liquidez sistema (USDT · proxy)"
          primaryValue={snap.systemTotalUsdt}
          growthPct={snap.growthPct}
          growthLabel="ventana corta"
          metrics={[
            { label: 'Vol. 24h ref.', value: `$${Math.round(snap.volume24hUsdt).toLocaleString()}` },
            { label: 'Wallets act.', value: String(snap.activeWalletsProxy) },
            {
              label: 'Red · minería',
              value: `$${Math.round(snap.byCategory.mining || 0).toLocaleString()}`,
            },
          ]}
        />
        <AdminInsightsPanel
          snapshot={snap}
          onNavigateNetwork={() => onNavigate?.('network')}
          onFocusLedger={() => onNavigate?.('history')}
        />
      </motion.div>

      <motion.div variants={fadeUpBlur}>
        <AdminGenerationCard
          globalRateUsdt={snap.globalRateUsdt}
          globalRateAig={snap.globalRateAig}
          topRateUsdt={snap.topRateUsdt}
          topRateAig={snap.topRateAig}
          inactiveNodes={snap.inactiveNodes}
          topPerformers={performers}
        />
      </motion.div>

      <motion.div variants={fadeUpBlur} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <AdminLedgerConsole events={events} loading={loading} onRefresh={refetch} />
        <AdminBinaryPanel
          totalVol={snap.totalVol}
          leftPts={snap.leftPts}
          rightPts={snap.rightPts}
          imbalancePct={snap.imbalancePct}
          severity={snap.imbalanceSeverity}
          leaders={snap.leaders}
          onOpenNetwork={() => onNavigate?.('network')}
        />
      </motion.div>

      <P2PConfigProvider>
        <P2PSettings />
      </P2PConfigProvider>
    </motion.div>
  );
}
