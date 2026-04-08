import React, { memo, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';

const VIEW_META = {
  signals: { label: 'Signals', hint: 'Desk en vivo · clasificación y hero' },
  live: { label: 'Live', hint: 'Métricas API + estado de socket' },
  results: { label: 'Results', hint: 'Últimos NEW_RESULT normalizados' },
  martingale: { label: 'Martingale', hint: 'Niveles por señal reciente' },
  vistalab: { label: 'VistaLab', hint: 'Ciclo automático · fases · cooldown 4s' },
  analytics: { label: 'Analytics', hint: 'KPI agregados y Mongo' },
  debug: { label: 'Debug', hint: 'Raw events · Signal stream' },
};

/**
 * Barra contextual bajo el header global: título de vista actual (sin rutas).
 * @param {{ activeView: string }} props
 */
function AdminTopBarInner({ activeView }) {
  const meta = useMemo(() => VIEW_META[activeView] ?? VIEW_META.signals, [activeView]);

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-2 border-b border-[#2B3139] bg-[#0B0E11] px-4 transition-colors duration-200"
      style={{ transitionProperty: 'background-color, border-color' }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#848E9C]">Command</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#474D57]" aria-hidden />
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold text-[#EAECEF]">{meta.label}</h1>
        <p className="truncate text-[10px] text-[#848E9C]">{meta.hint}</p>
      </div>
    </header>
  );
}

export const AdminTopBar = memo(AdminTopBarInner);
AdminTopBar.displayName = 'AdminTopBar';
