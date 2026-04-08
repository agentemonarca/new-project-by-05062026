import React from 'react';
import {
  isExternalSignalsBffEnabled,
  isExternalSignalsEnabled,
} from '@/ui-genesis/lib/externalSignalsConfig.js';
import GenesisOraclePanel from '../components/signals/GenesisOraclePanel.jsx';

/**
 * Signals Control — /admin/signals · panel Genesis Oracle (socket + ciclos en vivo).
 */
export function SignalsControlPage() {
  const bff = isExternalSignalsBffEnabled();
  const direct = isExternalSignalsEnabled();

  if (!bff && !direct) {
    return (
      <div className="space-y-6">
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100/95">
          Activa{' '}
          <span className="font-mono text-amber-200/90">VITE_EXTERNAL_SIGNALS_BFF=1</span> o{' '}
          <span className="font-mono">VITE_EXTERNAL_SIGNALS_ENABLED=1</span> en{' '}
          <span className="font-mono">apps/gpulse/.env</span>.
        </p>
      </div>
    );
  }

  return <GenesisOraclePanel />;
}
