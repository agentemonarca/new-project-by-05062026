import { memo, useSyncExternalStore } from 'react';
import { Info, Radio } from 'lucide-react';
import {
  getSignalStreamDebugServerSnapshot,
  getSignalStreamDebugSnapshot,
  subscribeSignalStreamDebug,
} from '../realtime/signalStreamDebugStore.js';
import { RawEventsSection } from './signal-stream-debug/RawEventsSection.jsx';
import { SignalTypesSection } from './signal-stream-debug/SignalTypesSection.jsx';
import { VigilanceSection } from './signal-stream-debug/VigilanceSection.jsx';
import { PhaseSection } from './signal-stream-debug/PhaseSection.jsx';
import { SignalDetailList } from './signal-stream-debug/SignalDetailList.jsx';

function SignalStreamDebugPanelInner() {
  const snap = useSyncExternalStore(
    subscribeSignalStreamDebug,
    getSignalStreamDebugSnapshot,
    getSignalStreamDebugServerSnapshot,
  );

  const c = snap.latestCounters;

  return (
    <div className="mt-8 space-y-5">
      <header className="rounded-2xl border border-violet-500/20 bg-[#070b14]/95 p-5 shadow-[0_0_32px_rgba(139,92,246,0.08)]">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/35 bg-violet-500/10">
            <Radio className="h-5 w-5 text-violet-300" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold tracking-tight text-white">Interpretación del stream</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Socket <code className="text-slate-400">signal_stream_frame</code> · actualización en vivo · máx.{' '}
              <span className="text-slate-400">50</span> registros en buffer.
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-3 rounded-xl border border-white/[0.06] bg-slate-950/50 p-3 text-[11px] text-slate-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-400/70" aria-hidden />
          <p className="leading-relaxed">
            Orden visual: <span className="text-cyan-300/90">RAW</span> → <span className="text-violet-200/90">SEÑALES</span> →{' '}
            <span className="text-amber-200/90">ESTADO</span> → <span className="text-emerald-200/90">FASE</span> →{' '}
            <span className="text-slate-300">DETALLE</span>. Desactivar emisiones en core:{' '}
            <code className="text-slate-500">ADMIN_SIGNALS_STREAM_FRAMES_OFF=1</code>.
          </p>
        </div>
      </header>

      {/* 1 · RAW */}
      <RawEventsSection latestCounters={c} />

      {/* 2 · 3 — decisión + vigilancia */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SignalTypesSection latestCounters={c} />
        <VigilanceSection latestCounters={c} />
      </div>

      {/* 4 · FASE */}
      <PhaseSection latestCounters={c} />

      {/* 5 · DETALLE (buildFullSignalState) */}
      <SignalDetailList frames={snap.frames} />
    </div>
  );
}

export const SignalStreamDebugPanel = memo(SignalStreamDebugPanelInner);
SignalStreamDebugPanel.displayName = 'SignalStreamDebugPanel';
