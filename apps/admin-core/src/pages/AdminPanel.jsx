import React, { memo, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AdminSidebar } from '../components/AdminSidebar.jsx';
import { AdminTopBar } from '../components/AdminTopBar.jsx';
import {
  AdminAnalyticsSection,
  AdminDebugSection,
  AdminLiveSection,
  AdminMartingaleSection,
  AdminResultsSection,
  AdminSignalsSection,
  AdminVistaLabSection,
} from '../components/admin/AdminPanelViews.jsx';
import { VistaLabAdminProvider, useVistaLabAdmin } from '@/contexts/VistaLabAdminContext.jsx';
import { useVistaLabCycle } from '@/hooks/useVistaLabCycle.js';
import { auditMesaRoundCorrelationKey } from '@/realtime/correlationKeyAudit.js';
import { createLiveResultEntry, createLiveSignalEntry } from '@/realtime/adminSignalsLiveIngest.js';
import { useAdminSignalsLiveStore } from '@/store/adminSignalsLiveStore.js';
import { ADMIN_SIGNALS_STRICT_MODE, validateResult, validateSignal } from '@/utils/adminSignalPayloadValidators.js';
import { resultMatchesSignal } from '@/utils/vistaLabCycle.js';

/**
 * Mismo pipeline que el store + VistaLab (sin bifurcar). Referencias enlazan el bundle de producción.
 * @see createLiveSignalEntry
 * @see validateSignal
 * @see auditMesaRoundCorrelationKey
 * @see resultMatchesSignal
 */
const __adminPipelineLink = {
  createLiveSignalEntry,
  createLiveResultEntry,
  ADMIN_SIGNALS_STRICT_MODE,
  validateSignal,
  validateResult,
  auditMesaRoundCorrelationKey,
  resultMatchesSignal,
};
void __adminPipelineLink;

/** Panel temporal: visibilidad del flujo señal → store (solo `import.meta.env.DEV`). */
function AdminSignalFlowDebugPanel({ signals, results, debugLogs, connected, rev, strictMode }) {
  const rejectedSignals = debugLogs.filter(
    (l) => l != null && typeof l === 'object' && !Array.isArray(l) && l.type === 'REJECT_SIGNAL',
  ).length;
  const tail = debugLogs.slice(-10);

  return (
    <div
      className="mb-4 rounded-xl border border-dashed border-cyan-500/35 bg-cyan-950/15 p-4 font-mono text-[11px] text-[#B7BDC6]"
      data-testid="admin-signal-flow-debug"
    >
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300/95">Signal flow debug (dev)</h3>
      <p className="mb-3 text-[10px] text-[#848E9C]">
        STRICT: {strictMode ? 'on' : 'off'} · socket: {connected ? 'connected' : 'disconnected'} · rev: {rev}
      </p>
      <div className="mb-3 space-y-1">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#848E9C]">Store</h4>
        <div>Signals count: {signals.length}</div>
        <div>Results count: {results.length}</div>
        <div>Rejected signals (REJECT_SIGNAL): {rejectedSignals}</div>
      </div>
      <div>
        <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#848E9C]">Debug logs (last 10)</h4>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-white/[0.06] bg-black/20 p-2">
          {tail.length === 0 ? (
            <span className="text-[#5E6673]">(empty)</span>
          ) : (
            tail.map((log, i) => (
              <pre key={i} className="whitespace-pre-wrap break-all text-[10px] leading-snug text-[#C8CDD4]">
                {typeof log === 'string' ? log : JSON.stringify(log, null, 2)}
              </pre>
            ))
          )}
        </div>
      </div>
      <p className="mt-3 text-[9px] leading-snug text-[#5E6673]">
        Opcional (solo depuración): <span className="font-mono">VITE_ADMIN_SIGNALS_STRICT=0</span> en{' '}
        <span className="font-mono">.env</span> y reiniciar Vite — no commitear si relaja validación en prod.
      </p>
    </div>
  );
}

function AdminVistaLabEngineStrip() {
  const { cycle } = useVistaLabAdmin();
  const { phase, activeSignal, start, pause } = cycle;

  useEffect(() => {
    console.log('ADMIN SIGNAL:', activeSignal);
    console.log('ADMIN PHASE:', phase);
  }, [activeSignal, phase]);

  const forecast6 =
    activeSignal && Array.isArray(activeSignal.forecast6) ? activeSignal.forecast6 : ['—', '—', '—', '—', '—', '—'];

  return (
    <div
      data-testid="admin-active-signal"
      className="mb-4 rounded-xl border p-4"
      style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.65)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#848E9C]">VistaLab engine · mismo ciclo que la pestaña VistaLab</p>
      {!activeSignal && <div className="mt-2 text-sm text-[#848E9C]">⏳ Waiting for signal…</div>}
      {activeSignal ? (
        <>
          <div className="mt-2 text-sm text-[#EAECEF]">
            Mesa: <span className="font-mono">{String(activeSignal.mesa ?? '—')}</span>
          </div>
          <div className="text-sm text-[#EAECEF]">
            Round: <span className="font-mono">{String(activeSignal.round ?? '—')}</span>
          </div>
          <div className="text-sm text-[#EAECEF]">
            Phase: <span className="font-mono text-[#0ECB81]">{phase}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">
            <span className="text-[#848E9C]">Forecast:</span>
            {forecast6.map((f, i) => (
              <span key={i} className="rounded border border-[#474D57] px-1.5 py-0.5 font-mono text-xs text-[#FCD535]">
                [{String(f)}]
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={start}
              className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200"
            >
              Start
            </button>
            <button
              type="button"
              onClick={pause}
              className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200"
            >
              Pause
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Centro de mando modular bajo `/admin`: top bar contextual + sidebar (estado) + contenido.
 * Un solo `useVistaLabCycle` alimenta la tira de motor y la pestaña VistaLab (sin segunda máquina de estados).
 */
function AdminPanelInner() {
  const snap = useAdminSignalsLiveStore();
  const { signals, results, debugLogs, connected, rev } = snap;
  const cycle = useVistaLabCycle({
    rev: snap.rev,
    connected: snap.connected,
    labMode: 'full',
    autoStart: true,
    signals: snap.signals,
    results: snap.results,
  });

  const [view, setView] = useState('signals');
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);

  useEffect(() => {
    console.log('SIGNALS:', signals);
    console.log('RESULTS:', results);
    console.log('DEBUG LOGS:', debugLogs);
    // rev es el contador del store; al bump coinciden signals/results/debugLogs actuales
  }, [rev, signals, results, debugLogs]);

  return (
    <VistaLabAdminProvider value={{ snap, cycle }}>
      <div
        className="admin-layout flex h-full min-h-0 flex-1 flex-col overflow-hidden"
        style={{ backgroundColor: '#0D1117' }}
      >
        <AdminTopBar activeView={view} />

        <div className="admin-body flex min-h-0 flex-1 overflow-hidden">
          <AdminSidebar
            view={view}
            onViewChange={setView}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />

          <div
            className="admin-content custom-scrollbar min-w-0 flex-1 overflow-y-auto p-4 lg:p-6"
            style={{ backgroundColor: '#0D1117' }}
          >
            {import.meta.env.DEV ? (
              <AdminSignalFlowDebugPanel
                signals={signals}
                results={results}
                debugLogs={debugLogs}
                connected={connected}
                rev={rev}
                strictMode={ADMIN_SIGNALS_STRICT_MODE}
              />
            ) : null}
            <AdminVistaLabEngineStrip />
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="min-h-0"
              >
                {view === 'signals' ? <AdminSignalsSection /> : null}
                {view === 'live' ? <AdminLiveSection /> : null}
                {view === 'results' ? <AdminResultsSection /> : null}
                {view === 'martingale' ? <AdminMartingaleSection /> : null}
                {view === 'vistalab' ? <AdminVistaLabSection /> : null}
                {view === 'analytics' ? <AdminAnalyticsSection /> : null}
                {view === 'debug' ? <AdminDebugSection /> : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </VistaLabAdminProvider>
  );
}

export const AdminPanel = memo(AdminPanelInner);
AdminPanel.displayName = 'AdminPanel';
