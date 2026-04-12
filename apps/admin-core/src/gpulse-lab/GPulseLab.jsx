import React, { useEffect } from 'react';
import AlertPanel from './components/AlertPanel.jsx';
import CycleXRayPanel from './components/CycleXRayPanel.jsx';
import CycleReplayModal from './components/CycleReplayModal.jsx';
import ControlCenterPanel from './components/ControlCenterPanel.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import CenterPanel from './components/CenterPanel.jsx';
import GpulseLabErrorBoundary from './components/GpulseLabErrorBoundary.jsx';
import LabOperationalBar from './components/LabOperationalBar.jsx';
import MesaSelector from './components/MesaSelector.jsx';
import LeftPanel from './components/LeftPanel.jsx';
import RightPanel from './components/RightPanel.jsx';
import ValidationPanel from './components/ValidationPanel.jsx';
import MultiEngineDebugPanel from './components/MultiEngineDebugPanel.jsx';
import ToastHost from './components/ToastHost.jsx';
import { useGpulseLabPersistence } from './hooks/useGpulseLabPersistence.js';
import { useLabSocket } from './hooks/useLabSocket.js';
import { useLabStore } from './store/useLabStore.js';
import { useAutoHealingForensics } from './hooks/useAutoHealingForensics.js';
import { useAutoFocusSingleRunningEngine } from './hooks/useAutoFocusSingleRunningEngine.js';

/**
 * GPulse Lab — grid: 260px | minmax(0,1fr) (lg). Left: monitor + cycle intel + alertas; center immersive.
 */
export default function GPulseLab() {
  useLabSocket();
  useGpulseLabPersistence();
  useAutoHealingForensics();
  useAutoFocusSingleRunningEngine();

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__gpulseLabStore = useLabStore;
    return () => {
      delete window.__gpulseLabStore;
    };
  }, []);

  return (
    <div
      className="gpulse-lab-root isolate flex h-full min-h-screen w-full min-w-0 flex-col gap-[clamp(0.75rem,1.5vw,1.125rem)] overflow-y-auto overflow-x-hidden bg-gradient-to-br from-black via-zinc-950 to-slate-900 p-[clamp(0.5rem,1.5vw,1.25rem)] sm:overflow-x-auto"
    >
      <ToastHost />
      <CycleXRayPanel />
      <CycleReplayModal />

      <header className="relative z-layout flex min-h-0 min-w-0 shrink-0 flex-col gap-[clamp(0.75rem,1.4vw,1rem)] rounded-xl border border-white/[0.1] bg-zinc-900/75 p-[clamp(0.75rem,1.6vw,1.125rem)] shadow-[0_12px_40px_rgba(0,0,0,0.4)] ring-1 ring-white/[0.06]">
        <LabOperationalBar />
        <ControlPanel />
        <MesaSelector />
      </header>

      <GpulseLabErrorBoundary>
        <div className="relative z-surface flex min-h-0 min-w-0 flex-1 flex-col gap-[clamp(0.75rem,1.5vw,1.125rem)]">
          <div className="grid min-h-0 min-w-0 flex-1 auto-rows-[minmax(0,1fr)] grid-cols-1 items-stretch gap-[clamp(0.75rem,1.5vw,1.125rem)] lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-1">
            <aside className="relative z-layout hidden min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.1] bg-zinc-900/80 shadow-lg shadow-black/40 ring-1 ring-white/[0.05] lg:flex lg:min-h-0 lg:min-w-[260px] lg:max-w-[260px]">
              <div className="shrink-0 p-[clamp(0.75rem,1.4vw,1rem)] pb-2">
                <LeftPanel />
              </div>
              <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden border-t border-white/[0.08] p-[clamp(0.75rem,1.4vw,1rem)] pt-3">
                <RightPanel />
                <AlertPanel embedded />
              </div>
            </aside>

            <section
              className="relative z-surface order-first flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-auto overflow-y-auto rounded-xl border border-cyan-500/15 bg-gradient-to-b from-slate-950/95 via-zinc-950 to-black/90 shadow-[0_16px_48px_rgba(34,211,238,0.08)] ring-1 ring-cyan-500/10 lg:order-none lg:max-w-none"
              aria-label="Oracle table — immersive"
            >
              <CenterPanel />
            </section>
          </div>

          <div
            className="relative z-surface flex min-h-[clamp(12rem,26vh,18rem)] max-h-[min(40vh,28rem)] shrink-0 flex-col gap-[clamp(0.75rem,1.4vw,1rem)] overflow-y-auto overflow-x-hidden custom-scrollbar rounded-xl border border-violet-500/20 bg-zinc-950/90 p-[clamp(0.75rem,1.5vw,1.125rem)] shadow-inner shadow-black/50 ring-1 ring-violet-500/10"
            aria-label="Control center and validation"
          >
            <ControlCenterPanel variant="dock" />
            <MultiEngineDebugPanel variant="dock" />
            <ValidationPanel variant="dock" />
          </div>
        </div>
      </GpulseLabErrorBoundary>
    </div>
  );
}
