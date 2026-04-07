import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalSignalBoard } from '@/ui-genesis/components/signals/ExternalSignalBoard.jsx';
import {
  isExternalSignalsBffEnabled,
  isExternalSignalsTransportActive,
} from '@/ui-genesis/lib/externalSignalsConfig.js';
import { useAdminSignalsStore } from '@/ui-genesis/stores/adminSignalsStore.js';
import { useExternalSignalsStore } from '@/ui-genesis/stores/externalSignalsStore.js';

/**
 * Simula la experiencia del usuario final (card premium + board compacto).
 */
export function AdminSignalUserView({ className = '' }) {
  const transport = isExternalSignalsTransportActive();
  const bff = isExternalSignalsBffEnabled();
  const debugShowRaw = useAdminSignalsStore((s) => s.debugShowRaw);
  const adminRawFeed = useExternalSignalsStore((s) => s.adminRawFeed);
  const activeSignals = useExternalSignalsStore((s) => s.activeSignals);
  const current = activeSignals.length ? activeSignals[activeSignals.length - 1] : null;

  const lastNewSignalRaw = useMemo(() => {
    const hit = adminRawFeed.find((e) => e.type === 'NEW_SIGNAL');
    return hit?.raw ?? null;
  }, [adminRawFeed]);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-[#071018] to-[#050814] shadow-[0_20px_60px_-24px_rgba(16,185,129,0.2),inset_0_1px_0_rgba(16,185,129,0.12)] ${className}`}
    >
      <div className="border-b border-emerald-500/15 px-4 py-3 md:px-5">
        <h3 className="text-sm font-semibold text-white">User view</h3>
        <p className="text-[11px] text-slate-500">
          PLAYER / BANKER · martingala · pending / win / loss · mismo pipeline que Genesis.
          {bff ? <span className="text-emerald-400/90"> Relay BFF.</span> : null}
        </p>
      </div>
      <div className="p-3 md:p-4">
        {!transport ? (
          <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/90">
            Activa <span className="font-mono">VITE_EXTERNAL_SIGNALS_BFF=1</span> o{' '}
            <span className="font-mono">VITE_EXTERNAL_SIGNALS_ENABLED=1</span> para cargar transporte.
          </p>
        ) : null}

        <AnimatePresence mode="wait">
          {current ? (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="mb-4 rounded-xl border border-white/[0.08] bg-black/35 px-4 py-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400/90">Señal actual</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-lg border px-3 py-1.5 text-sm font-black ${
                    current.recommendation === 'PLAYER'
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                      : current.recommendation === 'BANKER'
                        ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                        : 'border-slate-500/40 bg-slate-800 text-slate-300'
                  }`}
                >
                  {current.recommendation}
                </span>
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-slate-300">
                  MG {current.martingale}
                </span>
                <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-1 font-mono text-[11px] text-sky-200/90">
                  {current.status}
                </span>
              </div>
              <p className="mt-2 font-mono text-[10px] text-slate-500">
                mesa {current.mesa || '—'} · ronda {current.round || '—'}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <ExternalSignalBoard compact adminPreview />

        <AnimatePresence>
          {debugShowRaw && lastNewSignalRaw ? (
            <motion.pre
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="custom-scrollbar mt-3 max-h-40 overflow-auto rounded-lg border border-violet-500/25 bg-black/50 p-3 text-[10px] leading-relaxed text-violet-100/90"
            >
              {JSON.stringify(lastNewSignalRaw, null, 2)}
            </motion.pre>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
