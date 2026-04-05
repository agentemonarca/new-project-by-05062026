import React from 'react';
import { motion } from 'framer-motion';
import { BookMarked } from 'lucide-react';
import { OperativeLedgerExplorer } from '../components/ledger/OperativeLedgerExplorer.jsx';
import { useLedger } from '../ledger/LedgerContext.jsx';
import { useOptionalCore } from '../core/CoreContext.jsx';
import { fadeUpBlur, staggerContainer } from '../motion/variants.js';

/**
 * Historial operativo — ledger financiero avanzado (explorer + análisis).
 */
export function LedgerPage() {
  const { events, loading, error, refetch, hasSession } = useLedger();
  const core = useOptionalCore();
  const accountFrozen = Boolean(core?.claimUi?.accountFrozen);
  const economicActive = core?.economicActive !== false;

  if (!hasSession) {
    return (
      <motion.section variants={fadeUpBlur} className="rounded-2xl border border-white/10 bg-slate-950/40 p-8 text-center md:p-10">
        <BookMarked className="mx-auto h-10 w-10 text-slate-600" strokeWidth={1.5} />
        <h2 className="mt-4 font-display text-lg font-semibold text-white">Historial operativo</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Conecta wallet e inicia sesión para ver el explorador de movimientos, conversiones y equipo.
        </p>
      </motion.section>
    );
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={fadeUpBlur} className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950/70 px-5 py-6 md:px-8 md:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_-20%,rgba(34,211,238,0.12),transparent_55%)]" />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/80">Operaciones en cadena</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-white md:text-3xl">Historial operativo</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Seguimiento financiero completo: minería (core / booster), bonos, conversiones, retiros y equipo — con validaciones y modo
            análisis.
          </p>
        </div>
      </motion.header>

      {error ? (
        <motion.div variants={fadeUpBlur} className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {error}
        </motion.div>
      ) : null}

      <motion.div variants={fadeUpBlur}>
        <OperativeLedgerExplorer
          events={events}
          loading={loading}
          onRefresh={refetch}
          accountFrozen={accountFrozen}
          economicActive={economicActive}
          hasSession={hasSession}
        />
      </motion.div>
    </motion.div>
  );
}
